const { execSync } = require('child_process');

const NAMESPACE_NAME = 'workers-platform-template';

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

function main() {
  log('blue', '🚀 Setting up dispatch namespace for Workers for Platforms...\n');
  
  try {
    // Create the dispatch namespace
    // In Deploy to Cloudflare environment, Wrangler has authenticated access automatically
    log('yellow', `📦 Creating dispatch namespace '${NAMESPACE_NAME}'...`);
    const createResult = execCommand(`npx wrangler dispatch-namespace create ${NAMESPACE_NAME}`);
    
    if (createResult.success) {
      log('green', `✅ Successfully created dispatch namespace '${NAMESPACE_NAME}'`);
    } else if (
      createResult.output.includes('already exists') || 
      createResult.output.includes('namespace with that name already exists') ||
      createResult.output.includes('A namespace with this name already exists')
    ) {
      log('green', `✅ Dispatch namespace '${NAMESPACE_NAME}' already exists`);
    } else {
      // If namespace creation fails, log the error but don't fail the build
      // The deploy might still work if namespace was created through other means
      log('yellow', `⚠️  Namespace creation had issues: ${createResult.error}`);
      log('yellow', '   Continuing with deployment - namespace might already exist');
    }
    
    log('green', '\n✅ Namespace setup completed!');
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