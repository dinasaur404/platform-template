#!/usr/bin/env node

/**
 * Workers for Platforms Template - Quick Setup
 * 
 * Setup script for Deploy to Cloudflare button flow.
 * - Creates dispatch namespace
 * - Creates worker routes for custom domain (if configured)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// Colors
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const reset = '\x1b[0m';

function log(color, msg) {
  console.log(`${color}${msg}${reset}`);
}

function getAuthHeaders() {
  // Check for API Token first, then fall back to API Key
  const apiToken = process.env.DISPATCH_NAMESPACE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  const apiKey = process.env.CLOUDFLARE_API_KEY;
  const apiEmail = process.env.CLOUDFLARE_API_EMAIL;

  if (apiToken) {
    return {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    };
  } else if (apiKey && apiEmail) {
    return {
      'X-Auth-Key': apiKey,
      'X-Auth-Email': apiEmail,
      'Content-Type': 'application/json'
    };
  }
  return null;
}

function getDispatchNamespaceFromConfig() {
  const configPath = path.join(PROJECT_ROOT, 'wrangler.toml');
  
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    const match = content.match(/\[\[dispatch_namespaces\]\][\s\S]*?namespace\s*=\s*['"](.*?)['"]/);
    if (match) return match[1];
    
    const varMatch = content.match(/DISPATCH_NAMESPACE_NAME\s*=\s*['"](.*?)['"]/);
    if (varMatch) return varMatch[1];
  }
  
  return 'workers-platform-template';
}

function getWorkerNameFromConfig() {
  const configPath = path.join(PROJECT_ROOT, 'wrangler.toml');
  
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    const match = content.match(/^name\s*=\s*['"](.*?)['"]$/m);
    if (match) return match[1];
  }
  
  return 'workers-platform-template';
}

function ensureDispatchNamespace(namespaceName) {
  log(blue, `📦 Ensuring dispatch namespace '${namespaceName}' exists...`);
  
  try {
    execSync(`npx wrangler dispatch-namespace create ${namespaceName}`, {
      stdio: 'pipe'
    });
    log(green, `✅ Created dispatch namespace '${namespaceName}'`);
    return true;
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    
    if (output.includes('already exists') || output.includes('A namespace with this name')) {
      log(green, `✅ Dispatch namespace '${namespaceName}' already exists`);
      return true;
    }
    
    if (output.includes('You do not have access')) {
      log(yellow, '⚠️  Workers for Platforms not available on this account');
      log(yellow, '   Purchase at: https://dash.cloudflare.com/?to=/:account/workers-for-platforms');
      return false;
    }
    
    log(yellow, `⚠️  Could not create dispatch namespace: ${error.message}`);
    return false;
  }
}

async function setupCustomDomainRoutes() {
  const customDomain = process.env.CUSTOM_DOMAIN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const accountId = process.env.ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const workerName = getWorkerNameFromConfig();

  if (!customDomain || customDomain === '' || customDomain === 'localhost:5173') {
    log(blue, 'ℹ️  No custom domain configured - skipping route setup');
    return;
  }

  if (!zoneId) {
    log(yellow, '⚠️  Custom domain set but no CLOUDFLARE_ZONE_ID - cannot create routes');
    log(yellow, '   Add routes manually in the Cloudflare dashboard');
    return;
  }

  const headers = getAuthHeaders();
  if (!headers) {
    log(yellow, '⚠️  No API credentials found - cannot create routes');
    return;
  }

  log(blue, `🌐 Setting up routes for ${customDomain}...`);

  try {
    // Get existing routes
    const existingRoutesResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
      { headers }
    );
    
    const existingRoutesData = await existingRoutesResponse.json();
    
    if (!existingRoutesResponse.ok) {
      log(yellow, `⚠️  Could not fetch existing routes: ${existingRoutesData.errors?.[0]?.message}`);
      return;
    }

    const existingRoutes = existingRoutesData.result || [];

    // Define routes we need
    const routesToCreate = [
      { pattern: `${customDomain}/*`, script: workerName },
      { pattern: `*.${customDomain}/*`, script: workerName }
    ];

    for (const route of routesToCreate) {
      // Check if route already exists
      const exists = existingRoutes.some(r => r.pattern === route.pattern);
      
      if (exists) {
        log(green, `✅ Route '${route.pattern}' already exists`);
        continue;
      }

      // Create route
      const createResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(route)
        }
      );

      const createData = await createResponse.json();

      if (createResponse.ok && createData.success) {
        log(green, `✅ Created route '${route.pattern}'`);
      } else {
        log(yellow, `⚠️  Could not create route '${route.pattern}': ${createData.errors?.[0]?.message}`);
      }
    }

  } catch (error) {
    log(yellow, `⚠️  Could not setup routes: ${error.message}`);
    log(yellow, '   You may need to add routes manually in the Cloudflare dashboard');
  }
}

async function main() {
  console.log('');
  log(blue, '🚀 Workers for Platforms - Quick Setup');
  console.log('');
  
  // Create dispatch namespace
  const namespaceName = getDispatchNamespaceFromConfig();
  ensureDispatchNamespace(namespaceName);

  // Setup custom domain routes
  await setupCustomDomainRoutes();
  
  console.log('');
  log(green, '✅ Quick setup complete');
  console.log('');
}

main().catch(error => {
  console.error('Setup error:', error);
  // Don't exit with error - let deployment continue
});
