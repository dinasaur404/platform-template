# Workers for Platforms Template

Build a website builder platform where users can create and deploy websites with custom domains using [Cloudflare Workers for Platforms](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/).

One-click deploy not ready _yet_... use instructions below to deploy  

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dinasaur404/platform-template)

## Setup

### 1. Clone and Install
```bash
git clone https://github.com/dinasaur404/workers-platform-template.git
cd workers-platform-template
npm install
```

### 2. Create Database
Create a [D1 database](https://developers.cloudflare.com/d1/) to store project data:
```bash
npx wrangler d1 create workers-platform-template
```
Copy the database ID and update `wrangler.toml`:
```toml
database_id = "your-database-id-here"
```

### 3. Create Dispatch Namespace
Create a [dispatch namespace](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/get-started/configuration/#2-create-a-dispatch-namespace) for deploying user scripts:
```bash
npx wrangler dispatch-namespace create workers-platform-template
```

### 4. Configure Basic Settings
Update these values in `wrangler.toml`:
```toml
[vars]
DISPATCH_NAMESPACE_NAME = "workers-platform-template"
ACCOUNT_ID = "your-account-id"  # From Cloudflare dashboard sidebar
```

### 5. Create API Tokens

**Dispatch Token** — Used to deploy user websites to your [Workers for Platforms namespace](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/get-started/configuration/#3-create-an-api-token):
1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create token with permissions: `Account:Workers Scripts:Edit`
3. Set as secret: `echo "your-token" | wrangler secret put DISPATCH_NAMESPACE_API_TOKEN`

**Custom Hostnames Token** (Optional) — Used to automatically setup SSL for user domains via [Custom Hostnames](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/):
1. Create token with permissions: `Zone:Custom Hostnames:Edit` + `Zone:Zone:Read`
2. Set as secret: `echo "your-token" | wrangler secret put CLOUDFLARE_API_TOKEN`

### 6. Deploy
```bash
npx wrangler deploy
```

### 7. Initialize
Visit your worker URL and add `/init` to setup the database:
```
https://your-worker.workers.dev/init
```

## Custom Domain Setup (Optional)

If you want branded URLs like `build.yoursite.com` instead of `your-worker.workers.dev`:

### 1. Configure Domain
Add to `wrangler.toml`:
```toml
[vars]
CUSTOM_DOMAIN = "yoursite.com"
CLOUDFLARE_ZONE_ID = "your-zone-id"  # From domain overview page

routes = [
  { pattern = "*/*", zone_name = "yoursite.com" }
]
```

### 2. Add DNS Records
- `build.yoursite.com` → Your worker
- `*.yoursite.com` → Your worker (for user subdomains)

Your users can then connect their own domains which will automatically get SSL certificates via [Cloudflare for SaaS Custom Hostnames](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/).

## Local Development

Create `.dev.vars` file:
```bash
DISPATCH_NAMESPACE_API_TOKEN=your-dispatch-token
CLOUDFLARE_API_TOKEN=your-cloudflare-token
```

Run locally:
```bash
npx wrangler dev --remote
```

## How It Works

- **Builder**: Visit the root URL to create websites
- **User Sites**: Each project gets a subdomain like `projectname.yoursite.com`
- **Custom Domains**: Users can connect their own domains with automatic SSL via Custom Hostnames
- **Multi-tenant**: Each user's code runs in isolation using [Workers for Platforms](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/)

## Admin

Visit `/admin` to see all projects and debug issues.

### ⚠️ Security: Protect Admin Access

**IMPORTANT**: The admin page exposes sensitive database and infrastructure information. For production deployments, protect it with [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/):

1. **Create Access Application**:
   - Go to Cloudflare Zero Trust dashboard → Access → Applications
   - Create Self-hosted application
   - Application domain: `yourdomain.com/admin*`

2. **Configure Access Policy**:
   - Policy name: `Admin Access`
   - Action: `Allow`
   - Include rule: `Emails` → Add your email address

This ensures only authorized users can access admin functionality while keeping the rest of your platform public.
## Troubleshooting

**"Dispatch namespace not found"**: Check your API token has `Workers Scripts:Edit` permission and the namespace exists

**"Custom domain not working"**: Verify your [Custom Hostnames API token](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/api-tokens/) permissions and DNS records

**Database errors**: Visit `/init` to reset the database

**Debug logs**: Run `npx wrangler tail` to see real-time logs

---

This template is production-ready but add rate limiting and input validation for public use.
