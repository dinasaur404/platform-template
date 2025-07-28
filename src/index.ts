// Copyright (c) 2022 Cloudflare, Inc.
// Licensed under the APACHE LICENSE, VERSION 2.0 license found in the LICENSE file or at http://www.apache.org/licenses/LICENSE-2.0

import { Hono } from 'hono';

import { FetchTable, Initialize, CreateProject, GetProjectBySubdomain, GetProjectByCustomHostname } from './db';
import type { Env } from './env';
import {
  DeleteScriptInDispatchNamespace,
  GetScriptsInDispatchNamespace,
  PutScriptInDispatchNamespace,
} from './resource';
import { handleDispatchError, withDb } from './router';
import { renderPage, BuildTable, BuildWebsitePage } from './render';
import { Project } from './types';
import { createCustomHostname, getCustomHostnameStatus } from './cloudflare-api';
import { D1QB } from 'workers-qb';

const app = new Hono<{ Bindings: Env }>();

// Auto-initialization flag - tracks if DB has been initialized
let isInitialized = false;

/**
 * Automatically initialize database schema on first request
 */
async function autoInitializeDatabase(db: D1QB): Promise<void> {
  if (isInitialized) {
    return; // Already initialized in this worker instance
  }
  
  try {
    console.log('🔍 Checking database initialization...');
    
    // Check if projects table exists by trying to query it
    const tableCheck = await db.fetchOne({
      tableName: 'sqlite_master',
      fields: 'name',
      where: {
        conditions: 'type = ? AND name = ?',
        params: ['table', 'projects']
      }
    });
    
    if (!tableCheck.results) {
      console.log('🗄️  Creating database schema...');
      
      // Create projects table
      await db.createTable({
        tableName: 'projects',
        schema: 'id TEXT PRIMARY KEY, name TEXT NOT NULL, subdomain TEXT UNIQUE NOT NULL, custom_hostname TEXT, script_content TEXT NOT NULL, created_on TEXT NOT NULL, modified_on TEXT NOT NULL',
        ifNotExists: true
      });
      
      console.log('✅ Database schema created successfully');
    } else {
      console.log('✅ Database schema already exists');
    }
    
    isInitialized = true;
    
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    // Don't throw - let the app continue, it might work anyway
    // Set flag to true to avoid repeated attempts
    isInitialized = true;
  }
}

// Enhanced withDb middleware that includes auto-initialization
const withDbAndInit = async (c: any, next: any) => {
  // First apply the original withDb middleware
  await withDb(c, async () => {
    // Auto-initialize database on first request
    if (!isInitialized && c.var.db) {
      await autoInitializeDatabase(c.var.db);
    }
    await next();
  });
};

// Project routing middleware - handles both subdomains and custom hostnames
app.use('*', withDbAndInit, async (c, next) => {
  const customDomain = c.env.CUSTOM_DOMAIN;
  const builderSubdomain = c.env.BUILDER_SUBDOMAIN || 'build';
  const url = new URL(c.req.url);
  const host = url.hostname;
  const path = url.pathname;

  let project: any = null;

  if (customDomain) {
    // Check if this is a subdomain of our custom domain
    if (host.endsWith(`.${customDomain}`)) {
      const subdomain = host.replace(`.${customDomain}`, '');
      
      // Skip if this is the builder subdomain
      if (subdomain === builderSubdomain) {
        await next();
        return;
      }
      
      // Look up project by subdomain
      project = await GetProjectBySubdomain(c.var.db, subdomain);
    } else {
      // Check if this is a custom hostname (vanity domain)
      project = await GetProjectByCustomHostname(c.var.db, host);
    }
  } else {
    // Workers.dev routing: workername.workers.dev/projectname
    if (path.startsWith('/') && path.length > 1) {
      const subdomain = path.substring(1).split('/')[0];
      
      // Skip common paths
      if (['admin', 'projects', 'upload', 'init', 'dispatch', 'favicon.ico'].includes(subdomain)) {
        await next();
        return;
      }
      
      // Look up project by subdomain
      project = await GetProjectBySubdomain(c.var.db, subdomain);
    }
  }

  if (project) {
    try {
      let requestToForward = c.req.raw;
      
      // For workers.dev, strip the project path
      if (!customDomain || !host.endsWith(`.${customDomain}`)) {
        const subdomain = path.substring(1).split('/')[0];
        const newUrl = new URL(c.req.url);
        newUrl.pathname = path.substring(subdomain.length + 1) || '/';
        requestToForward = new Request(newUrl.toString(), {
          method: c.req.method,
          headers: c.req.headers,
          body: c.req.body
        });
      }

      // Deploy the project script to the dispatch namespace if it doesn't exist
      const worker = c.env.dispatcher.get(project.subdomain);
      return await worker.fetch(requestToForward);
    } catch (e) {
      // If worker doesn't exist, deploy it first
      await PutScriptInDispatchNamespace(c.env, project.subdomain, project.script_content);
      const worker = c.env.dispatcher.get(project.subdomain);
      
      let requestToForward = c.req.raw;
      if (!customDomain || !host.endsWith(`.${customDomain}`)) {
        const subdomain = path.substring(1).split('/')[0];
        const newUrl = new URL(c.req.url);
        newUrl.pathname = path.substring(subdomain.length + 1) || '/';
        requestToForward = new Request(newUrl.toString(), {
          method: c.req.method,
          headers: c.req.headers,
          body: c.req.body
        });
      }
      
      return await worker.fetch(requestToForward);
    }
  }
  
  await next();
});

app.get('/favicon.ico', () => {
  return new Response();
});

/*
 * Main page - Build a website interface
 */
app.get('/', (c) => {
  const customDomain = c.env.CUSTOM_DOMAIN;
  return c.html(renderPage(BuildWebsitePage, { customDomain }));
});

/*
 * Admin page - For debugging/management (hidden)
 */
app.get('/admin', withDbAndInit, async (c) => {
  let body = `
    <hr class="solid"><br/>
    <div>
      <form style="display: inline" action="/init"><input type="submit" value="Initialize" /></form>
      <small> - Resets db and dispatch namespace to initial state</small>
    </div>
    <h2>DB Tables</h2>`;

  /*
    * DB data
    */
  try {
    body += BuildTable('projects', await FetchTable(c.var.db, 'projects'));
  } catch (e) {
    body += '<div>No DB data. Database will auto-initialize on first project creation.</div>';
  }

  /*
    * Dispatch Namespace data
    */
  try {
    const scripts = await GetScriptsInDispatchNamespace(c.env);
    body += '</br><h2>Dispatch Namespace</h2>';
    body += BuildTable(c.env.DISPATCH_NAMESPACE_NAME, scripts);
  } catch (e) {
    console.log(JSON.stringify(e, Object.getOwnPropertyNames(e)));
    body += `<div>Dispatch namespace "${c.env.DISPATCH_NAMESPACE_NAME}" was not found.</div>`;
  }

  return c.html(renderPage(body));
});

/*
 * Initialize example data (now optional since auto-init handles schema)
 */
app.get('/init', withDbAndInit, async (c) => {
  const scripts = await GetScriptsInDispatchNamespace(c.env);
  await Promise.all(scripts.map(async (script) => DeleteScriptInDispatchNamespace(c.env, script.id)));
  await Initialize(c.var.db);
  return Response.redirect(c.req.url.replace('/init', ''));
});

/*
 * Create a new project
 */ 
app.post('/projects', withDbAndInit, async (c) => {
  try {
    const { name, subdomain, script_content, custom_hostname } = await c.req.json();
    
    // Validate input
    if (!name || !subdomain || !script_content) {
      return c.text('Missing required fields: name, subdomain, script_content', 400);
    }
    
    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return c.text('Subdomain must only contain lowercase letters, numbers, and hyphens', 400);
    }
    
    // Check if subdomain already exists
    const existingProject = await GetProjectBySubdomain(c.var.db, subdomain);
    if (existingProject) {
      return c.text('Subdomain already exists', 409);
    }
    
    // Check if custom hostname already exists
    if (custom_hostname) {
      const existingCustomHostname = await GetProjectByCustomHostname(c.var.db, custom_hostname);
      if (existingCustomHostname) {
        return c.text('Custom hostname already exists', 409);
      }
    }
    
    // Create project
    const project: Project = {
      id: `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      subdomain,
      custom_hostname: custom_hostname || null,
      script_content,
      created_on: new Date().toISOString(),
      modified_on: new Date().toISOString(),
    };
    
    // Save to database
    await CreateProject(c.var.db, project);
    
    // Deploy script to dispatch namespace
    await PutScriptInDispatchNamespace(c.env, subdomain, script_content);
    
    // Create custom hostname if provided
    if (custom_hostname) {
      const hostnameCreated = await createCustomHostname(c.env, custom_hostname);
      if (!hostnameCreated) {
        console.warn(`Failed to create custom hostname: ${custom_hostname}`);
      }
    }
    
    return c.text('Project created successfully', 201);
  } catch (error) {
    console.error('Error creating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.text(`Internal server error: ${errorMessage}`, 500);
  }
});

/*
 * Check custom domain status
 */
app.get('/projects/:subdomain/custom-domain-status', withDbAndInit, async (c) => {
  try {
    const subdomain = c.req.param('subdomain');
    
    // Get project by subdomain
    const project = await GetProjectBySubdomain(c.var.db, subdomain);
    if (!project) {
      return c.text('Project not found', 404);
    }
    
    // Check if project has custom hostname
    if (!project.custom_hostname) {
      return c.json({
        has_custom_domain: false,
        worker_url: c.env.CUSTOM_DOMAIN 
          ? `https://${subdomain}.${c.env.CUSTOM_DOMAIN}`
          : `https://${c.env.WORKERS_DEV_SUBDOMAIN || 'my-worker'}.workers.dev/${subdomain}`
      });
    }
    
    // Get custom hostname status from Cloudflare
    const status = await getCustomHostnameStatus(c.env, project.custom_hostname);
    
    return c.json({
      has_custom_domain: true,
      custom_domain: project.custom_hostname,
      status: status.status,
      ssl_status: status.ssl?.status,
      verification_errors: status.verification_errors || [],
      worker_url: c.env.CUSTOM_DOMAIN 
        ? `https://${subdomain}.${c.env.CUSTOM_DOMAIN}`
        : `https://${c.env.WORKERS_DEV_SUBDOMAIN || 'my-worker'}.workers.dev/${subdomain}`,
      is_active: status.status === 'active'
    });
  } catch (error) {
    console.error('Error checking custom domain status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.text(`Internal server error: ${errorMessage}`, 500);
  }
});

export default app;