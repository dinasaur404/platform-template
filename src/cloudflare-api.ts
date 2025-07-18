// Cloudflare API integration for custom hostnames
import type { Env } from './env';

export async function createCustomHostname(env: Env, hostname: string): Promise<boolean> {
  if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN) {
    console.warn('Custom hostname API not configured');
    return false;
  }

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
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

    const result = await response.json();
    
    if (response.ok) {
      console.log(`Custom hostname created: ${hostname}`);
      return true;
    } else {
      console.error('Failed to create custom hostname:', result);
      return false;
    }
  } catch (error) {
    console.error('Error creating custom hostname:', error);
    return false;
  }
}

export interface CustomHostnameStatus {
  status: 'active' | 'pending' | 'error' | 'not_found';
  ssl?: {
    status: 'active' | 'pending' | 'error';
    validation_method?: string;
  };
  verification_errors?: string[];
}

export async function getCustomHostnameStatus(env: Env, hostname: string): Promise<CustomHostnameStatus> {
  if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN) {
    return { status: 'error', verification_errors: ['API not configured'] };
  }

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=${hostname}`, {
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      },
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Failed to get custom hostname status:', result);
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
        validation_method: hostnameData.ssl.validation_method
      } : undefined,
      verification_errors: hostnameData.verification_errors || []
    };
  } catch (error) {
    console.error('Error getting custom hostname status:', error);
    return { status: 'error', verification_errors: ['Network error'] };
  }
}

export async function deleteCustomHostname(env: Env, hostname: string): Promise<boolean> {
  if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN) {
    return false;
  }

  try {
    // First, get the custom hostname ID
    const listResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=${hostname}`, {
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      },
    });

    const listResult = await listResponse.json();
    
    if (!listResponse.ok || !listResult.result || listResult.result.length === 0) {
      console.warn(`Custom hostname not found: ${hostname}`);
      return false;
    }

    const hostnameId = listResult.result[0].id;

    // Delete the custom hostname
    const deleteResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames/${hostnameId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      },
    });

    if (deleteResponse.ok) {
      console.log(`Custom hostname deleted: ${hostname}`);
      return true;
    } else {
      console.error('Failed to delete custom hostname:', await deleteResponse.json());
      return false;
    }
  } catch (error) {
    console.error('Error deleting custom hostname:', error);
    return false;
  }
}