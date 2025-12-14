#!/usr/bin/env node

/**
 * Workers for Platforms Template - Setup Script
 *
 * This script handles automated setup:
 * - Validates Cloudflare credentials
 * - Creates dispatch namespace for Workers for Platforms
 * - Auto-creates API tokens with correct permissions
 * - Generates .env file with all required secrets
 * - Updates wrangler.toml with routes and resource IDs
 */

// TODO: validate required keys on process.env

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import dotenv from 'dotenv';

dotenv.config();

const PROJECT_ROOT = path.join(__dirname, '..');

import type { CloudflareApiResponse } from '../src/types';

type Config = Partial<{
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  CUSTOM_DOMAIN: string;
  CLOUDFLARE_ZONE_ID: string;
  FALLBACK_ORIGIN: string;
  accountName: string;
  zoneName: string;
  wfpAvailable: boolean;
  existingNamespaces: { id: string; name: string }[];
  dispatchNamespaceId: string;
  dispatchToken: string;
  createdToken: boolean;
  routesAdded: boolean;
}>;

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logBold(color: keyof typeof colors, message: string) {
  console.log(`${colors.bold}${colors[color]}${message}${colors.reset}`);
}

class SetupManager {
  private config: Config;
  private rl: readline.Interface;

  constructor() {
    this.config = {};
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async setup() {
    console.log('');
    logBold(
      'cyan',
      '╔══════════════════════════════════════════════════════════════╗'
    );
    logBold(
      'cyan',
      '║     Workers for Platforms Template - Automated Setup         ║'
    );
    logBold(
      'cyan',
      '╚══════════════════════════════════════════════════════════════╝'
    );
    console.log('');

    try {
      // Collect user configuration
      await this.collectUserConfig();

      // Validate credentials
      await this.validateCredentials();

      // Setup resources
      await this.setupResources();

      // Generate config files
      await this.generateEnv();
      await this.updateWranglerConfig();

      // Display final report
      this.displayFinalReport();
    } catch (error: unknown) {
      log(
        'red',
        `\n❌ Setup failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      log('yellow', '\n💡 Troubleshooting:');
      log('yellow', '   1. Verify your Cloudflare API credentials');
      log(
        'yellow',
        '   2. Ensure Workers for Platforms is enabled on your account'
      );
      log('yellow', '   3. Check API token has required permissions');
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  async prompt(question: string) {
    return new Promise<string>((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async promptWithDefault(question: string, defaultValue: string) {
    if (defaultValue) {
      const masked = this.maskSensitiveValue(question, defaultValue);
      const answer = await this.prompt(`${question} [${masked}]: `);
      return answer || defaultValue;
    }
    return this.prompt(`${question}: `);
  }

  maskSensitiveValue(question: string, value: string) {
    const sensitivePatterns = ['TOKEN', 'SECRET', 'KEY', 'PASSWORD'];
    const isSensitive = sensitivePatterns.some((pattern) =>
      question.toUpperCase().includes(pattern)
    );
    if (isSensitive && value.length > 8) {
      return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
    }
    return value;
  }

  async collectUserConfig() {
    log('blue', '📋 Configuration Setup');
    log('blue', '──────────────────────\n');

    // Account ID
    this.config.CLOUDFLARE_ACCOUNT_ID = await this.promptWithDefault(
      'Cloudflare Account ID',
      process.env.CLOUDFLARE_ACCOUNT_ID
    );
    if (!this.config.CLOUDFLARE_ACCOUNT_ID) {
      throw new Error(
        'Account ID is required. Find it at dash.cloudflare.com in the URL.'
      );
    }

    this.config.CLOUDFLARE_API_TOKEN = await this.promptWithDefault(
      'Cloudflare API Token',
      process.env.DISPATCH_NAMESPACE_API_TOKEN ||
        process.env.CLOUDFLARE_API_TOKEN
    );
    if (!this.config.CLOUDFLARE_API_TOKEN) {
      throw new Error('API Token is required');
    }

    // Custom Domain Configuration
    log('blue', '\n🌐 Custom Domain Configuration');
    log(
      'yellow',
      '   A custom domain enables branded URLs (e.g., site.platform.com)'
    );
    log('yellow', '   Without it, sites will use workers.dev subdomains\n');

    this.config.CUSTOM_DOMAIN = await this.promptWithDefault(
      'Custom domain (optional, e.g., platform.com)',
      process.env.CUSTOM_DOMAIN
    );

    if (
      this.config.CUSTOM_DOMAIN &&
      this.config.CUSTOM_DOMAIN !== 'localhost:5173' &&
      this.config.CUSTOM_DOMAIN !== ''
    ) {
      // Try to auto-detect zone
      await this.detectZoneForDomain();

      if (!this.config.CLOUDFLARE_ZONE_ID) {
        this.config.CLOUDFLARE_ZONE_ID = await this.promptWithDefault(
          'Zone ID for custom domain',
          process.env.CLOUDFLARE_ZONE_ID
        );
      }

      this.config.FALLBACK_ORIGIN = await this.promptWithDefault(
        'Fallback origin hostname (e.g., my.platform.com)',
        process.env.FALLBACK_ORIGIN || `my.${this.config.CUSTOM_DOMAIN}`
      );

      if (this.config.FALLBACK_ORIGIN) {
        log(
          'yellow',
          `\n💡 Customers will CNAME their domains to: ${this.config.FALLBACK_ORIGIN}`
        );
      }
    }

    console.log('');
    log('green', '✅ Configuration collected\n');
  }

  getAuthHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.config.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    };
  }

  async validateCredentials() {
    log('blue', '🔐 Validating Cloudflare credentials...');

    try {
      const response = await fetch(
        'https://api.cloudflare.com/client/v4/user/tokens/verify',
        {
          headers: this.getAuthHeaders()
        }
      );

      const data = await response.json<CloudflareApiResponse>();

      if (!response.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message || 'Invalid credentials');
      }

      // drain body
      response.body?.cancel();

      log('green', '✅ Credentials validated successfully');

      // Get account info
      const accountResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.config.CLOUDFLARE_ACCOUNT_ID}`,
        { headers: this.getAuthHeaders() }
      );

      const accountData =
        await accountResponse.json<CloudflareApiResponse<{ name: string }>>();
      if (accountData.success && accountData.result) {
        log('green', `✅ Connected to account: ${accountData.result.name}`);
        this.config.accountName = accountData.result.name;
      }
    } catch (error) {
      throw new Error(
        `Credential validation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async detectZoneForDomain() {
    if (!this.config.CUSTOM_DOMAIN) return;

    log('blue', `🔍 Detecting zone for ${this.config.CUSTOM_DOMAIN}...`);

    try {
      // Try to find zone by domain name
      const domainParts = this.config.CUSTOM_DOMAIN.split('.');

      for (let i = 0; i < domainParts.length - 1; i++) {
        const zoneName = domainParts.slice(i).join('.');

        const response = await fetch(
          `https://api.cloudflare.com/client/v4/zones?name=${zoneName}&account.id=${this.config.CLOUDFLARE_ACCOUNT_ID}`,
          { headers: this.getAuthHeaders() }
        );

        const data =
          await response.json<
            CloudflareApiResponse<{ name: string; id: string }[]>
          >();

        if (data.success && data.result && data.result.length > 0) {
          const zone = data.result[0];
          log('green', `✅ Found zone: ${zone.name} (ID: ${zone.id})`);
          this.config.CLOUDFLARE_ZONE_ID = zone.id;
          this.config.zoneName = zone.name;
          return;
        }
      }

      log(
        'yellow',
        `⚠️  Could not auto-detect zone for ${this.config.CUSTOM_DOMAIN}`
      );
    } catch (error) {
      log(
        'yellow',
        `⚠️  Zone detection failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async setupResources() {
    log('blue', '\n📦 Setting up Cloudflare resources...');

    // Check Workers for Platforms access
    await this.checkWorkersForPlatformsAccess();

    // Create dispatch namespace
    await this.ensureDispatchNamespace();

    // Always create a permanent API token for runtime use
    await this.ensureDispatchToken();
  }

  async checkWorkersForPlatformsAccess() {
    log('blue', '🔍 Checking Workers for Platforms access...');

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.config.CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces`,
        { headers: this.getAuthHeaders() }
      );

      const data =
        await response.json<
          CloudflareApiResponse<{ id: string; name: string }[]>
        >();

      if (
        response.status === 403 ||
        data.errors?.some((e) => e.code === 10121)
      ) {
        log(
          'yellow',
          '⚠️  Workers for Platforms is not enabled on this account'
        );
        log(
          'yellow',
          '   Purchase at: https://dash.cloudflare.com/?to=/:account/workers-for-platforms'
        );
        log('yellow', '   Enterprise: Contact your account team\n');
        this.config.wfpAvailable = false;
      } else if (response.ok) {
        log('green', '✅ Workers for Platforms is available');
        this.config.wfpAvailable = true;
        this.config.existingNamespaces = data.result || [];
      } else {
        log(
          'yellow',
          `⚠️  Could not verify Workers for Platforms access: ${data.errors?.[0]?.message}`
        );
        this.config.wfpAvailable = false;
      }

      // drain body
      response.body?.cancel();
    } catch (error) {
      log(
        'yellow',
        `⚠️  Could not check Workers for Platforms: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      this.config.wfpAvailable = false;
    }
  }

  async ensureDispatchNamespace() {
    const namespaceName = 'workers-platform-template';

    if (!this.config.wfpAvailable) {
      log(
        'yellow',
        `⚠️  Skipping dispatch namespace creation (Workers for Platforms not available)`
      );
      return;
    }

    log('blue', `📦 Ensuring dispatch namespace '${namespaceName}' exists...`);

    // Check if already exists
    const existing = this.config.existingNamespaces?.find(
      (ns) => ns.name === namespaceName
    );
    if (existing) {
      log('green', `✅ Dispatch namespace '${namespaceName}' already exists`);
      this.config.dispatchNamespaceId = existing.id;
      return;
    }

    // Create namespace
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.config.CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ name: namespaceName })
        }
      );

      const data = await response.json<CloudflareApiResponse<{ id: string }>>();

      if (response.ok && data.success && data.result?.id) {
        log('green', `✅ Created dispatch namespace '${namespaceName}'`);
        this.config.dispatchNamespaceId = data.result.id;
      } else if (
        data.errors?.some((e) => e.message?.includes('already exists'))
      ) {
        log('green', `✅ Dispatch namespace '${namespaceName}' already exists`);
      } else {
        log(
          'yellow',
          `⚠️  Could not create dispatch namespace: ${data.errors?.[0]?.message}`
        );
      }

      // drain body
      response.body?.cancel();
    } catch (error) {
      log(
        'yellow',
        `⚠️  Could not create dispatch namespace: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async ensureDispatchToken() {
    log('blue', '🔐 Creating permanent API token for runtime operations...');

    try {
      // If using existing token, test if it has permissions
      const testResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.config.CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces`,
        { headers: this.getAuthHeaders() }
      );

      if (testResponse.ok) {
        log('green', '✅ Current token has dispatch namespace permissions');
        this.config.dispatchToken = this.config.CLOUDFLARE_API_TOKEN;
        return;
      }

      // Create a new permanent token (works with both API Token and Global API Key)
      log('blue', '🔐 Creating specialized dispatch namespace token...');

      const tokenResponse = await fetch(
        'https://api.cloudflare.com/client/v4/user/tokens',
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            name: `Workers Platform Template Token - ${
              new Date().toISOString().split('T')[0]
            }`,
            policies: [
              {
                effect: 'allow',
                resources: {
                  [`com.cloudflare.api.account.${this.config.CLOUDFLARE_ACCOUNT_ID}`]:
                    '*'
                },
                permission_groups: [
                  {
                    id: 'c1fde68c7bcc44588cbb6ddbc16d6480',
                    name: 'Account Settings Read'
                  },
                  {
                    id: '1a71c399035b4950a1bd1466bbe4f420',
                    name: 'Workers Scripts Write'
                  },
                  {
                    id: 'e086da7e2179491d91ee5f35b3ca210a',
                    name: 'Workers Scripts Read'
                  }
                ]
              }
            ],
            condition: {},
            expires_on: new Date(
              Date.now() + 365 * 24 * 60 * 60 * 1000
            ).toISOString()
          })
        }
      );

      const tokenData =
        await tokenResponse.json<
          CloudflareApiResponse<{ id: string; value: string }>
        >();

      if (tokenResponse.ok && tokenData.success && tokenData.result?.value) {
        log('green', '✅ Created permanent API token');
        log('yellow', `   Token ID: ${tokenData.result.id}`);
        this.config.dispatchToken = tokenData.result.value;
        this.config.createdToken = true;
      } else {
        log(
          'yellow',
          `⚠️  Could not create token: ${tokenData.errors?.[0]?.message}`
        );
        log(
          'yellow',
          '   Using existing token - may need manual permission setup'
        );
        this.config.dispatchToken = this.config.CLOUDFLARE_API_TOKEN;
      }
    } catch (error) {
      log(
        'yellow',
        `⚠️  Token setup error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      this.config.dispatchToken = this.config.CLOUDFLARE_API_TOKEN;
    }
  }

  async generateEnv() {
    log('blue', '\n📝 Generating .env file...');

    const envPath = path.join(PROJECT_ROOT, '.env');

    let content = `# Workers for Platforms Template - Environment Variables
# Generated by setup script on ${new Date().toISOString()}

# Cloudflare Account Configuration
ACCOUNT_ID="${this.config.CLOUDFLARE_ACCOUNT_ID}"
`;

    // Always use API token format - the setup script will create a permanent token
    content += `
# API Token for dispatch namespace operations (auto-created with correct permissions)
DISPATCH_NAMESPACE_API_TOKEN="${
      this.config.dispatchToken || this.config.CLOUDFLARE_API_TOKEN
    }"
`;

    if (this.config.CUSTOM_DOMAIN && this.config.CUSTOM_DOMAIN !== '') {
      content += `
# Custom Domain Configuration
CUSTOM_DOMAIN="${this.config.CUSTOM_DOMAIN}"
`;
      if (this.config.CLOUDFLARE_ZONE_ID) {
        content += `CLOUDFLARE_ZONE_ID="${this.config.CLOUDFLARE_ZONE_ID}"
`;
      }
      if (this.config.FALLBACK_ORIGIN) {
        content += `FALLBACK_ORIGIN="${this.config.FALLBACK_ORIGIN}"
`;
      }
    }

    // Preserve any additional existing variables
    const preserveVars = ['JWT_SECRET', 'WEBHOOK_SECRET'];
    for (const varName of preserveVars) {
      if (process.env[varName]) {
        content += `${varName}="${process.env[varName]}"
`;
      }
    }

    fs.writeFileSync(envPath, content, 'utf-8');
    log('green', '✅ .env file created');
  }

  async updateWranglerConfig() {
    log('blue', '🔧 Updating wrangler.toml...');

    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');

    if (!fs.existsSync(wranglerPath)) {
      log('yellow', '⚠️  wrangler.toml not found');
      return;
    }

    let content = fs.readFileSync(wranglerPath, 'utf-8');

    // Update vars section
    if (this.config.CUSTOM_DOMAIN && this.config.CUSTOM_DOMAIN !== '') {
      content = content.replace(
        /CUSTOM_DOMAIN = ".*"/,
        `CUSTOM_DOMAIN = "${this.config.CUSTOM_DOMAIN}"`
      );

      // Set workers_dev = false for custom domain
      content = content.replace(/workers_dev = true/, 'workers_dev = false');
    }

    if (this.config.CLOUDFLARE_ZONE_ID) {
      content = content.replace(
        /CLOUDFLARE_ZONE_ID = ".*"/,
        `CLOUDFLARE_ZONE_ID = "${this.config.CLOUDFLARE_ZONE_ID}"`
      );
    }

    if (this.config.FALLBACK_ORIGIN) {
      content = content.replace(
        /FALLBACK_ORIGIN = ".*"/,
        `FALLBACK_ORIGIN = "${this.config.FALLBACK_ORIGIN}"`
      );
    }

    // Add routes if custom domain is configured
    if (
      this.config.CUSTOM_DOMAIN &&
      this.config.CUSTOM_DOMAIN !== '' &&
      this.config.CLOUDFLARE_ZONE_ID
    ) {
      // Remove any existing routes section
      content = content.replace(
        /\n# Routes for custom domain\nroutes = \[[\s\S]*?\]\n/g,
        ''
      );

      // Add new routes section before [vars] or at the end
      const routesSection = `
# Routes for custom domain
routes = [
  { pattern = "${this.config.CUSTOM_DOMAIN}/*", zone_id = "${this.config.CLOUDFLARE_ZONE_ID}" },
  { pattern = "*.${this.config.CUSTOM_DOMAIN}/*", zone_id = "${this.config.CLOUDFLARE_ZONE_ID}" }
]
`;

      // Insert before [vars] section
      if (content.includes('[vars]')) {
        content = content.replace('[vars]', `${routesSection}\n[vars]`);
      } else {
        content += routesSection;
      }

      log('green', '✅ Added routes for custom domain');
      this.config.routesAdded = true;
    }

    fs.writeFileSync(wranglerPath, content, 'utf-8');
    log('green', '✅ wrangler.toml updated');
  }

  displayFinalReport() {
    console.log('');
    logBold(
      'green',
      '╔══════════════════════════════════════════════════════════════╗'
    );
    logBold(
      'green',
      '║                    Setup Complete!                           ║'
    );
    logBold(
      'green',
      '╚══════════════════════════════════════════════════════════════╝'
    );
    console.log('');

    log('blue', '📦 Resources:');
    if (this.config.wfpAvailable) {
      log('green', '   ✅ Workers for Platforms: Available');
      log('green', '   ✅ Dispatch Namespace: Ready');
    } else {
      log(
        'yellow',
        '   ⚠️  Workers for Platforms: Not available (requires paid plan)'
      );
    }

    if (this.config.createdToken) {
      log('green', '   ✅ API Token: Created with correct permissions');
    }

    if (this.config.routesAdded) {
      log('green', '   ✅ Routes: Added to wrangler.toml');
    }

    console.log('');
    log('blue', '📋 Configuration:');
    log('cyan', `   Account ID: ${this.config.CLOUDFLARE_ACCOUNT_ID}`);
    if (this.config.CUSTOM_DOMAIN && this.config.CUSTOM_DOMAIN !== '') {
      log('cyan', `   Custom Domain: ${this.config.CUSTOM_DOMAIN}`);
      if (this.config.CLOUDFLARE_ZONE_ID) {
        log('cyan', `   Zone ID: ${this.config.CLOUDFLARE_ZONE_ID}`);
      }
      if (this.config.FALLBACK_ORIGIN) {
        log('cyan', `   Fallback Origin: ${this.config.FALLBACK_ORIGIN}`);
      }
    } else {
      log('cyan', '   Domain: Using workers.dev subdomain');
    }

    console.log('');
    log('blue', '🎯 Next Steps:');
    log('cyan', '   1. Run `npm run deploy` to deploy to Cloudflare');
    log('cyan', '   2. Run `npm run dev` to start local development');

    if (this.config.CUSTOM_DOMAIN && this.config.CUSTOM_DOMAIN !== '') {
      console.log('');
      log('yellow', '📝 DNS Setup Required:');
      log(
        'yellow',
        `   Add these DNS records for ${this.config.CUSTOM_DOMAIN}:`
      );
      console.log('');
      log(
        'cyan',
        '   ┌───────┬──────────┬─────────────┬────────────────────────────┐'
      );
      log(
        'cyan',
        '   │ Type  │ Name     │ Content     │ Result                     │'
      );
      log(
        'cyan',
        '   ├───────┼──────────┼─────────────┼────────────────────────────┤'
      );
      log(
        'cyan',
        `   │ A     │ @        │ 192.0.2.1   │ ${this.config.CUSTOM_DOMAIN.padEnd(
          26
        )} │`
      );
      log(
        'cyan',
        `   │ A     │ *        │ 192.0.2.1   │ *.${this.config.CUSTOM_DOMAIN.padEnd(
          23
        )} │`
      );
      if (this.config.FALLBACK_ORIGIN) {
        const fbName = this.config.FALLBACK_ORIGIN.replace(
          `.${this.config.CUSTOM_DOMAIN}`,
          ''
        );
        log(
          'cyan',
          `   │ A     │ ${fbName.padEnd(
            8
          )} │ 192.0.2.1   │ ${this.config.FALLBACK_ORIGIN.padEnd(26)} │`
        );
      }
      log(
        'cyan',
        '   └───────┴──────────┴─────────────┴────────────────────────���───┘'
      );
      console.log('');
      log(
        'yellow',
        '   Note: 192.0.2.1 is a dummy IP - Cloudflare proxy handles routing.'
      );
    }

    console.log('');
    log('green', '✨ Happy building! ✨');
    console.log('');
  }
}

// Main execution
async function main() {
  const setup = new SetupManager();
  await setup.setup();
}

main().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
