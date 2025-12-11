// Cloudflare API integration for custom hostnames
import type { Env } from './env';

function getAuthHeaders(env: Env): Record<string, string> {
  // Use DISPATCH_NAMESPACE_API_TOKEN for all Cloudflare API calls
  // This token is auto-created by setup script with required permissions
  if (env.DISPATCH_NAMESPACE_API_TOKEN) {
    return {
      'Authorization': `Bearer ${env.DISPATCH_NAMESPACE_API_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }
  return {};
}

function isApiConfigured(env: Env): boolean {
  return !!(env.CLOUDFLARE_ZONE_ID && env.DISPATCH_NAMESPACE_API_TOKEN);
}

export async function createCustomHostname(env: Env, hostname: string): Promise<boolean> {
  if (!isApiConfigured(env)) {
    return false;
  }

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames`, {
      method: 'POST',
      headers: getAuthHeaders(env),
      body: JSON.stringify({
        hostname: hostname,
        ssl: {
          method: 'http',
          type: 'dv',
          settings: {
            http2: 'on',
            min_tls_version: '1.2',
            tls_1_3: 'on'
          }
        }
      })
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

export interface CustomHostnameStatus {
  status: 'active' | 'pending' | 'error' | 'not_found';
  ssl?: {
    status: string;
    validation_method?: string;
    validation_errors?: string[];
    validation_records?: Array<{
      txt_name?: string;
      txt_value?: string;
      http_url?: string;
      http_body?: string;
    }>;
  };
  verification_errors?: string[];
}

export async function getCustomHostnameStatus(env: Env, hostname: string): Promise<CustomHostnameStatus> {
  if (!isApiConfigured(env)) {
    return { status: 'error', verification_errors: ['API not configured'] };
  }

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=${hostname}`, {
      headers: getAuthHeaders(env),
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { status: 'error', verification_errors: ['API request failed'] };
    }

    if (!result.result || result.result.length === 0) {
      return { status: 'not_found' };
    }

    const hostnameData = result.result[0];
    
    return {
      status: hostnameData.status,
      ssl: hostnameData.ssl ? {
        status: hostnameData.ssl.status,
        validation_method: hostnameData.ssl.method || hostnameData.ssl.validation_method,
        validation_errors: hostnameData.ssl.validation_errors || [],
        validation_records: hostnameData.ssl.validation_records || []
      } : undefined,
      verification_errors: hostnameData.verification_errors || []
    };
  } catch (error) {
    return { status: 'error', verification_errors: ['Network error'] };
  }
}

export async function deleteCustomHostname(env: Env, hostname: string): Promise<boolean> {
  if (!isApiConfigured(env)) {
    return false;
  }

  try {
    // First, get the custom hostname ID
    const listResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=${hostname}`, {
      headers: getAuthHeaders(env),
    });

    const listResult = await listResponse.json();
    
    if (!listResponse.ok || !listResult.result || listResult.result.length === 0) {
      return false;
    }

    const hostnameId = listResult.result[0].id;

    // Delete the custom hostname
    const deleteResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames/${hostnameId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(env),
    });

    return deleteResponse.ok;
  } catch (error) {
    return false;
  }
}