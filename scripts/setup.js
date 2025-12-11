#!/usr/bin/env node

/**
 * Workers for Platforms Template - Setup Script
 * 
 * This script handles the automated setup for the Workers for Platforms template:
 * - Creates the dispatch namespace for Workers for Platforms
 * - Validates configuration
 * 
 * Used by the "Deploy to Cloudflare" button for one-click deployment.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  try {
    const result = execSync(command, { 
      stdio: options.stdio || 'pipe',
      encoding: 'utf8',
      ...options
    });
    return { success: true, output: result };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      output: error.stdout || error.stderr || ''
    };
  }
}

/**
 * Gets the worker name from wrangler configuration
 */
function getWorkerNameFromConfig() {
  const configFiles = ['wrangler.jsonc', 'wrangler.json', 'wrangler.toml'];
  
  for (const configFile of configFiles) {
    const configPath = path.join(process.cwd(), configFile);
    
    if (fs.existsSync(configPath)) {
      log('blue', `📄 Found configuration: ${configFile}`);
      
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        let workerName;
        
        if (configFile.endsWith('.toml')) {
          const nameMatch = configContent.match(/^name\s*=\s*['"](.*?)['"]$/m);
          workerName = nameMatch ? nameMatch[1] : null;
        } else {
          const cleanedContent = configContent.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
          const config = JSON.parse(cleanedContent);
          workerName = config.name;
        }
        
        if (workerName) {
          log('green', `✅ Worker name: '${workerName}'`);
          return workerName;
        }
      } catch (error) {
        log('yellow', `⚠️  Could not parse ${configFile}: ${error.message}`);
      }
    }
  }
  
  return null;
}

/**
 * Gets the dispatch namespace name from wrangler configuration
 */
function getDispatchNamespaceFromConfig() {
  const configFiles = ['wrangler.jsonc', 'wrangler.json', 'wrangler.toml'];
  
  for (const configFile of configFiles) {
    const configPath = path.join(process.cwd(), configFile);
    
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        
        if (configFile.endsWith('.toml')) {
          // Look for namespace in [[dispatch_namespaces]] section
          const namespaceMatch = configContent.match(/\[\[dispatch_namespaces\]\][\s\S]*?namespace\s*=\s*['"](.*?)['"]/);
          if (namespaceMatch) {
            return namespaceMatch[1];
          }
          // Fallback to DISPATCH_NAMESPACE_NAME var
          const varMatch = configContent.match(/DISPATCH_NAMESPACE_NAME\s*=\s*['"](.*?)['"]/);
          if (varMatch) {
            return varMatch[1];
          }
        } else {
          const cleanedContent = configContent.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
          const config = JSON.parse(cleanedContent);
          if (config.dispatch_namespaces && config.dispatch_namespaces[0]) {
            return config.dispatch_namespaces[0].namespace;
          }
          if (config.vars && config.vars.DISPATCH_NAMESPACE_NAME) {
            return config.vars.DISPATCH_NAMESPACE_NAME;
          }
        }
      } catch (error) {
        // Continue to next file
      }
    }
  }
  
  return null;
}

/**
 * Checks if Workers for Platforms is available for the account
 */
function checkWorkersForPlatformsAccess() {
  log('blue', '🔍 Checking Workers for Platforms access...');
  
  const result = execCommand('npx wrangler dispatch-namespace list');
  
  if (result.success) {
    log('green', '✅ Workers for Platforms is available');
    return true;
  }
  
  if (result.output.includes('You do not have access to dispatch namespaces') || 
      result.output.includes('code: 10121') ||
      result.error?.includes('You do not have access to dispatch namespaces')) {
    log('yellow', '⚠️  Workers for Platforms is not enabled for this account');
    log('yellow', '   Purchase at: https://dash.cloudflare.com/?to=/:account/workers-for-platforms');
    log('yellow', '   Enterprise customers: Contact your account team');
    return false;
  }
  
  // Other errors - assume access is available
  log('yellow', `⚠️  Could not verify access: ${result.error || result.output}`);
  return true;
}

/**
 * Creates the dispatch namespace if it doesn't exist
 */
function ensureDispatchNamespace(namespaceName) {
  log('blue', `📦 Ensuring dispatch namespace '${namespaceName}' exists...`);
  
  // Try to create the namespace
  const createResult = execCommand(`npx wrangler dispatch-namespace create ${namespaceName}`);
  
  if (createResult.success) {
    log('green', `✅ Created dispatch namespace '${namespaceName}'`);
    return true;
  }
  
  // Check if it already exists
  if (createResult.output.includes('already exists') || 
      createResult.output.includes('namespace with that name already exists') ||
      createResult.output.includes('A namespace with this name already exists') ||
      createResult.error?.includes('already exists')) {
    log('green', `✅ Dispatch namespace '${namespaceName}' already exists`);
    return true;
  }
  
  // Check for access issues
  if (createResult.output.includes('You do not have access') ||
      createResult.error?.includes('You do not have access')) {
    log('yellow', '⚠️  Cannot create dispatch namespace - access not available');
    return false;
  }
  
  log('yellow', `⚠️  Namespace creation had issues: ${createResult.error || createResult.output}`);
  log('yellow', '   Continuing - deployment flow will handle this');
  return true;
}

/**
 * Main setup function
 */
function main() {
  console.log('');
  log('cyan', '╔══════════════════════════════════════════════════════════════╗');
  log('cyan', '║     Workers for Platforms Template - Automated Setup         ║');
  log('cyan', '╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    // Step 1: Get configuration
    const workerName = getWorkerNameFromConfig();
    
    if (!workerName) {
      log('red', '❌ Could not find worker name in configuration');
      log('yellow', '   Make sure your wrangler config has a "name" field');
      process.exit(1);
    }
    
    // Step 2: Get dispatch namespace name (may be different from worker name)
    const namespaceName = getDispatchNamespaceFromConfig() || workerName;
    log('blue', `📋 Dispatch namespace: '${namespaceName}'`);
    
    // Step 3: Check Workers for Platforms access
    const hasAccess = checkWorkersForPlatformsAccess();
    
    if (!hasAccess) {
      log('yellow', '');
      log('yellow', '⚠️  Workers for Platforms is required for this template');
      log('yellow', '   The platform will deploy but user Workers cannot be created');
      log('yellow', '   Enable Workers for Platforms to unlock full functionality');
      console.log('');
    }
    
    // Step 4: Create dispatch namespace
    if (hasAccess) {
      ensureDispatchNamespace(namespaceName);
    }
    
    // Success
    console.log('');
    log('green', '╔══════════════════════════════════════════════════════════════╗');
    log('green', '║                    Setup Complete!                           ║');
    log('green', '╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    log('blue', '📋 Next steps:');
    log('blue', '   • D1 database will be auto-provisioned during deployment');
    log('blue', '   • Database schema will auto-initialize on first request');
    if (!hasAccess) {
      log('yellow', '   • Enable Workers for Platforms for full functionality');
    }
    console.log('');
    
  } catch (error) {
    log('red', `\n❌ Setup failed: ${error.message}`);
    log('yellow', '⚠️  Continuing - deployment flow will handle resources');
    // Don't exit with error - let deployment continue
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { getWorkerNameFromConfig, getDispatchNamespaceFromConfig };
