#!/usr/bin/env node

/**
 * Workers for Platforms Template - Quick Setup
 * 
 * Setup script for Deploy to Cloudflare button flow.
 * - Creates dispatch namespace
 * - Auto-detects zone ID for custom domain
 * - Updates wrangler.toml with routes
 * 
 * Only requires CUSTOM_DOMAIN from user - everything else is auto-detected.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// Colors
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const cyan = '\x1b[36m';
const reset = '\x1b[0m';

function log(color, msg) {
  console.log(`${color}${msg}${reset}`);
}

function getConfig() {
  // Read from environment variables (set by Deploy to Cloudflare flow)
  // The deploy system auto-provides CF_ACCOUNT_ID and CF_API_TOKEN
  return {
    accountId: process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || process.env.ACCOUNT_ID,
    apiToken: process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.DISPATCH_NAMESPACE_API_TOKEN,
    apiKey: process.env.CLOUDFLARE_API_KEY,
    apiEmail: process.env.CLOUDFLARE_API_EMAIL,
    customDomain: process.env.CUSTOM_DOMAIN,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    fallbackOrigin: process.env.FALLBACK_ORIGIN
  };
}

function getAuthHeaders(config) {
  if (config.apiToken) {
    return {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json'
    };
  } else if (config.apiKey && config.apiEmail) {
    return {
      'X-Auth-Key': config.apiKey,
      'X-Auth-Email': config.apiEmail,
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
      return false;
    }
    
    log(yellow, `⚠️  Could not create dispatch namespace: ${output || error.message}`);
    return false;
  }
}

async function detectZoneId(config) {
  if (!config.customDomain || config.customDomain === '') {
    return null;
  }

  if (config.zoneId) {
    log(green, `✅ Using provided Zone ID: ${config.zoneId}`);
    return config.zoneId;
  }

  const headers = getAuthHeaders(config);
  if (!headers) {
    log(yellow, '⚠️  No API credentials - cannot auto-detect zone ID');
    return null;
  }

  log(blue, `🔍 Auto-detecting zone ID for ${config.customDomain}...`);

  try {
    // Try to find zone by domain name
    const domainParts = config.customDomain.split('.');
    
    for (let i = 0; i < domainParts.length - 1; i++) {
      const zoneName = domainParts.slice(i).join('.');
      
      let url = `https://api.cloudflare.com/client/v4/zones?name=${zoneName}`;
      if (config.accountId) {
        url += `&account.id=${config.accountId}`;
      }

      const response = await fetch(url, { headers });
      const data = await response.json();

      if (data.success && data.result && data.result.length > 0) {
        const zone = data.result[0];
        log(green, `✅ Found zone: ${zone.name} (ID: ${zone.id})`);
        return zone.id;
      }
    }

    log(yellow, `⚠️  Could not auto-detect zone ID for ${config.customDomain}`);
    log(yellow, '   You may need to add routes manually in the Cloudflare dashboard');
    return null;
  } catch (error) {
    log(yellow, `⚠️  Zone detection failed: ${error.message}`);
    return null;
  }
}

function updateWranglerConfig(config) {
  const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
  
  if (!fs.existsSync(wranglerPath)) {
    log(yellow, '⚠️  wrangler.toml not found');
    return false;
  }

  let content = fs.readFileSync(wranglerPath, 'utf-8');
  let modified = false;

  // Update CUSTOM_DOMAIN if set
  if (config.customDomain && config.customDomain !== '') {
    content = content.replace(
      /CUSTOM_DOMAIN = ".*"/,
      `CUSTOM_DOMAIN = "${config.customDomain}"`
    );

    // Set workers_dev = false for custom domain
    content = content.replace(
      /workers_dev = true/,
      'workers_dev = false'
    );
    modified = true;
    log(green, `✅ Set CUSTOM_DOMAIN = "${config.customDomain}"`);
  }

  // Update CLOUDFLARE_ZONE_ID if set
  if (config.zoneId) {
    content = content.replace(
      /CLOUDFLARE_ZONE_ID = ".*"/,
      `CLOUDFLARE_ZONE_ID = "${config.zoneId}"`
    );
    modified = true;
  }

  // Set fallback origin (default to my.{domain})
  const fallbackOrigin = config.fallbackOrigin || (config.customDomain ? `my.${config.customDomain}` : '');
  if (fallbackOrigin) {
    content = content.replace(
      /FALLBACK_ORIGIN = ".*"/,
      `FALLBACK_ORIGIN = "${fallbackOrigin}"`
    );
    modified = true;
    log(green, `✅ Set FALLBACK_ORIGIN = "${fallbackOrigin}"`);
  }

  // Add routes if custom domain and zone ID are configured
  if (config.customDomain && config.customDomain !== '' && config.zoneId) {
    // Remove any existing routes section
    content = content.replace(/\n# Routes for custom domain\nroutes = \[[\s\S]*?\]\n/g, '');
    
    // Add new routes section before [vars] or at the end
    const routesSection = `
# Routes for custom domain
routes = [
  { pattern = "${config.customDomain}/*", zone_id = "${config.zoneId}" },
  { pattern = "*.${config.customDomain}/*", zone_id = "${config.zoneId}" }
]
`;

    // Insert before [vars] section
    if (content.includes('[vars]')) {
      content = content.replace('[vars]', `${routesSection}\n[vars]`);
    } else {
      content += routesSection;
    }

    modified = true;
    log(green, `✅ Added routes for ${config.customDomain}`);
  }

  if (modified) {
    fs.writeFileSync(wranglerPath, content, 'utf-8');
    log(green, '✅ wrangler.toml updated');
  }

  return modified;
}

async function main() {
  console.log('');
  log(blue, '🚀 Workers for Platforms - Quick Setup');
  log(blue, '──────────────────────────────────────');
  console.log('');
  
  const config = getConfig();

  // Log what we found from environment
  log(cyan, '📋 Configuration detected:');
  if (config.accountId) {
    log(cyan, `   Account ID: ${config.accountId.substring(0, 8)}...`);
  }
  if (config.apiToken) {
    log(cyan, `   API Token: ${config.apiToken.substring(0, 8)}...`);
  }
  if (config.customDomain) {
    log(cyan, `   Custom Domain: ${config.customDomain}`);
  } else {
    log(cyan, '   Custom Domain: (not set - using workers.dev)');
  }
  console.log('');

  // Create dispatch namespace
  const namespaceName = getDispatchNamespaceFromConfig();
  ensureDispatchNamespace(namespaceName);

  // Auto-detect zone ID if custom domain is set
  if (config.customDomain && config.customDomain !== '' && !config.zoneId) {
    config.zoneId = await detectZoneId(config);
  }

  // Update wrangler.toml with config
  updateWranglerConfig(config);
  
  console.log('');
  log(green, '✅ Quick setup complete');
  console.log('');
}

main().catch(error => {
  console.error('Setup error:', error);
  // Don't exit with error - let deployment continue
});
