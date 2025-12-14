// Copyright (c) 2022 Cloudflare, Inc.
// Licensed under the APACHE LICENSE, VERSION 2.0 license found in the LICENSE file or at http://www.apache.org/licenses/LICENSE-2.0

import { D1QB } from 'workers-qb';
import { env } from 'cloudflare:workers';
import type { Project } from './types';

export const db = new D1QB(env.DB);

// Auto-initialization flag - tracks if DB has been initialized
let isInitialized = false;

/**
 * Automatically initialize database schema on first request
 */
export async function autoInitializeDatabase(): Promise<void> {
  if (isInitialized) {
    return; // Already initialized in this worker instance
  }

  try {
    // Check if projects table exists by trying to query it
    const tableCheck = await db
      .fetchOne({
        tableName: 'sqlite_master',
        fields: 'name',
        where: {
          conditions: 'type = ? AND name = ?',
          params: ['table', 'projects']
        }
      })
      .execute();

    if (!tableCheck.results) {
      // Create projects table
      await db
        .createTable({
          tableName: 'projects',
          schema:
            'id TEXT PRIMARY KEY, name TEXT NOT NULL, subdomain TEXT UNIQUE NOT NULL, custom_hostname TEXT, script_content TEXT NOT NULL, created_on TEXT NOT NULL, modified_on TEXT NOT NULL',
          ifNotExists: true
        })
        .execute();
    }

    isInitialized = true;
  } catch (error) {
    // Don't throw - let the app continue, it might work anyway
    // Set flag to true to avoid repeated attempts
    isInitialized = true;
  }
}

export async function Initialize() {
  const tables: { name: string; schema: string }[] = [
    {
      name: 'projects',
      schema:
        'id TEXT PRIMARY KEY, name TEXT NOT NULL, subdomain TEXT UNIQUE NOT NULL, custom_hostname TEXT, script_content TEXT NOT NULL, created_on TEXT NOT NULL, modified_on TEXT NOT NULL'
    }
  ];

  for (const table of tables) {
    await db
      .dropTable({
        tableName: table.name,
        ifExists: true
      })
      .execute();
  }
  for (const table of tables) {
    await db
      .createTable({
        tableName: table.name,
        schema: table.schema,
        ifNotExists: true
      })
      .execute();
  }
}

export async function CreateProject(project: Project) {
  // Convert undefined to null for database
  const dbProject = {
    ...project,
    custom_hostname: project.custom_hostname || null
  };

  return db
    .insert({
      tableName: 'projects',
      data: dbProject as unknown as Record<string, string | null>
    })
    .execute();
}

export async function GetProjectBySubdomain(
  subdomain: string
): Promise<Project | null> {
  const result = await db
    .fetchOne({
      tableName: 'projects',
      fields: '*',
      where: {
        conditions: 'projects.subdomain IS ?',
        params: [subdomain]
      }
    })
    .execute();
  return result.results as unknown as Project | null;
}

export async function GetProjectByCustomHostname(
  hostname: string
): Promise<Project | null> {
  const result = await db
    .fetchOne({
      tableName: 'projects',
      fields: '*',
      where: {
        conditions: 'projects.custom_hostname IS ?',
        params: [hostname]
      }
    })
    .execute();
  return result.results as unknown as Project | null;
}

export async function GetAllProjects(): Promise<Project[]> {
  const result = await db
    .fetchAll({
      tableName: 'projects',
      fields: '*'
    })
    .execute();
  return (result.results as unknown as Project[]) || [];
}

export async function UpdateProject(
  projectId: string,
  updates: Partial<Project>
) {
  return db
    .update({
      tableName: 'projects',
      data: updates as unknown as Record<string, string>,
      where: {
        conditions: 'projects.id IS ?',
        params: [projectId]
      }
    })
    .execute();
}
