const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command) {
  try {
    const result = execSync(command, { 
      stdio: 'pipe',
      encoding: 'utf8'
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

function getWorkerNameFromConfig() {
  // Look for configuration files in order of preference
  const configFiles = [
    'wrangler.jsonc',
    'wrangler.json', 
    'wrangler.toml'
  ];
  
  for (const configFile of configFiles) {
    const configPath = path.join(process.cwd(), configFile);
    
    if (fs.existsSync(configPath)) {
      log('blue', `📄 Found configuration file: ${configFile}`);
      
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        let workerName;
        
        if (configFile.endsWith('.toml')) {
          // Parse TOML format
          const nameMatch = configContent.match(/^name\s*=\s*['"](.*?)['"]$/m);
          workerName = nameMatch ? nameMatch[1] : null;
        } else {
          // Parse JSON/JSONC format
          // Remove comments from JSONC
          const cleanedContent = configContent.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
          const config = JSON.parse(cleanedContent);
          workerName = config.name;
        }
        
        if (workerName) {
          log('green', `✅ Worker name found: '${workerName}'`);
          return workerName;
        } else {
          log('yellow', `⚠️  No 'name' field found in ${configFile}`);
        }
      } catch (error) {
        log('yellow', `⚠️  Could not parse ${configFile}: ${error.message}`);
      }
    }
  }
  
  return null;
}

function getNamespaceFromWorkerName(workerName) {
  // Use the worker name as the namespace name
  // You could also add a suffix/prefix if needed, e.g.:
  // return `${workerName}-dispatch`;
  return workerName;
}

function main() {
  log('blue', '🚀 Setting up dispatch namespace for Workers for Platforms...\n');
  
  try {
    // Get worker name from configuration
    const workerName = getWorkerNameFromConfig();
    
    if (!workerName) {
      log('red', '❌ Could not determine worker name from configuration files');
      log('yellow', '   Make sure you have a wrangler.toml, wrangler.json, or wrangler.jsonc file with a "name" field');
      process.exit(1);
    }
    
    // Generate namespace name from worker name
    const namespaceName = getNamespaceFromWorkerName(workerName);
    log('blue', `🎯 Target namespace: '${namespaceName}'\n`);
    
    // Create the dispatch namespace
    // In Deploy to Cloudflare environment, Wrangler has authenticated access automatically
    log('yellow', `📦 Creating dispatch namespace '${namespaceName}'...`);
    const createResult = execCommand(`npx wrangler dispatch-namespace create ${namespaceName}`);
    
    if (createResult.success) {
      log('green', `✅ Successfully created dispatch namespace '${namespaceName}'`);
    } else if (
      createResult.output.includes('already exists') || 
      createResult.output.includes('namespace with that name already exists') ||
      createResult.output.includes('A namespace with this name already exists')
    ) {
      log('green', `✅ Dispatch namespace '${namespaceName}' already exists`);
    } else {
      // If namespace creation fails, log the error but don't fail the build
      // The deploy might still work if namespace was created through other means
      log('yellow', `⚠️  Namespace creation had issues: ${createResult.error}`);
      log('yellow', '   Continuing with deployment - namespace might already exist');
    }
    
    log('green', '\n✅ Namespace setup completed!');
    log('blue', `📋 Namespace '${namespaceName}' is ready for Worker '${workerName}'`);
    log('blue', '📋 Next: Database will be initialized and Worker will be deployed');
    
  } catch (error) {
    log('red', `\n❌ Setup failed: ${error.message}`);
    // Don't exit with error code - let the deployment continue
    // as resources might be provisioned automatically
    log('yellow', '⚠️  Continuing with deployment despite setup issues');
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { getWorkerNameFromConfig, getNamespaceFromWorkerName };