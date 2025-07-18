// Copyright (c) 2022 Cloudflare, Inc.
// Licensed under the APACHE LICENSE, VERSION 2.0 license found in the LICENSE file or at http://www.apache.org/licenses/LICENSE-2.0

import { Env } from './env';

const BaseURI = (env: Env) => `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers`;
const ScriptsURI = (env: Env) => `${BaseURI(env)}/dispatch/namespaces/${env.DISPATCH_NAMESPACE_NAME}/scripts`;
const MakeHeaders = (env: Env) => ({
  'Authorization': `Bearer ${env.DISPATCH_NAMESPACE_API_TOKEN}`,
});

export async function GetScriptsInDispatchNamespace(env: Env) {
  const data = (await (
    await fetch(ScriptsURI(env), {
      method: 'GET',
      headers: MakeHeaders(env),
    })
  ).json()) as { result: Array<{ id: string; modified_on: string; created_on: string }> };
  return data.result;
}

export async function PutScriptInDispatchNamespace(env: Env, scriptName: string, scriptContent: string): Promise<Response> {
  const scriptFileName = `${scriptName}.mjs`;

  const formData = new FormData();
  const metadata = {
    main_module: scriptFileName,
  };
  formData.append('metadata', new File([JSON.stringify(metadata)], 'metadata.json', { type: 'application/json' }));

  formData.append('script', new File([scriptContent], scriptFileName, { type: 'application/javascript+module' }));

  return await fetch(`${ScriptsURI(env)}/${scriptName}`, {
    method: 'PUT',
    body: formData,
    headers: {
      ...MakeHeaders(env),
    },
  });
}

export async function DeleteScriptInDispatchNamespace(env: Env, scriptName: string): Promise<Response> {
  return await fetch(`${ScriptsURI(env)}/${scriptName}`, {
    method: 'DELETE',
    headers: MakeHeaders(env),
  });
}
