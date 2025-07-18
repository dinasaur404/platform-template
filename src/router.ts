// Copyright (c) 2022 Cloudflare, Inc.
// Licensed under the APACHE LICENSE, VERSION 2.0 license found in the LICENSE file or at http://www.apache.org/licenses/LICENSE-2.0

import { Context, MiddlewareHandler } from 'hono';

import { D1QB } from 'workers-qb';

import { Env } from './env';

export const withDb: MiddlewareHandler<{
  Bindings: Env
  Variables: { db: D1QB }
}> = async (c, next) => {
  c.set("db", new D1QB(c.env.DB));
  await next();
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleDispatchError(c: Context, e: any): Response {
  console.log(e instanceof Error);
  if (e instanceof Error && e.message.startsWith('Worker not found')) {
    return c.text('Script does not exist', 404);
  }
  /*
   * This is a notable error that should be logged.
   */
  console.log(JSON.stringify(e, Object.getOwnPropertyNames(e)));
  return c.text('Could not connect to script', 500);
}
