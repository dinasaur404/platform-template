#!/usr/bin/env node

/**
 * Workers for Platforms Template - Quick Setup
 * 
 * Minimal setup script for Deploy to Cloudflare button flow.
 * Just ensures the dispatch namespace exists.
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
      log(yellow, '   Purchase at: https://dash.cloudflare.com/?to=/:account/workers-for-platforms');
      return false;
    }
    
    log(yellow, `⚠️  Could not create dispatch namespace: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('');
  log(blue, '🚀 Workers for Platforms - Quick Setup');
  console.log('');
  
  const namespaceName = getDispatchNamespaceFromConfig();
  ensureDispatchNamespace(namespaceName);
  
  console.log('');
  log(green, '✅ Quick setup complete');
  console.log('');
}

main();
