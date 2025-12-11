# Workers for Platforms Template

Build your own website hosting platform using [Cloudflare Workers for Platforms](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/). Users can create and deploy websites through a simple web interface.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dinasaur404/platform-template)

## What You Get

- **Website Builder UI** - Web interface for creating and deploying sites
- **Static Site Hosting** - Drag & drop HTML/CSS/JS files
- **Custom Worker Code** - Write dynamic sites with Workers
- **Subdomain Routing** - Each site gets `sitename.yourdomain.com`
- **Custom Domains** - Users can connect their own domains with SSL
- **Admin Dashboard** - Manage all sites at `/admin`

---

## Quick Start

Click the **Deploy to Cloudflare** button above. You'll be prompted for the following:

### Required Secrets

| Secret | Where to Find It |
|--------|------------------|
| `CLOUDFLARE_API_KEY` | [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Global API Key** → View |
| `CLOUDFLARE_API_EMAIL` | The email you use to log into Cloudflare |
| `ACCOUNT_ID` | [dash.cloudflare.com](https://dash.cloudflare.com) → Select account → URL shows `https://dash.cloudflare.com/<ACCOUNT_ID>` |
| `DISPATCH_NAMESPACE_API_TOKEN` | [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → Use "Edit Cloudflare Workers" template |

### Optional Settings (for Custom Domains)

| Variable | Where to Find It |
|----------|------------------|
| `CUSTOM_DOMAIN` | Your root domain (e.g., `myplatform.com`). Leave empty to use `*.workers.dev` only |
| `CLOUDFLARE_ZONE_ID` | Cloudflare Dashboard → Select your domain → **Overview** page → right sidebar → **Zone ID** |
| `FALLBACK_ORIGIN` | Subdomain for customer CNAMEs (e.g., `my.platform.com`) - see Custom Domain Setup |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Your Platform (this template)                              │
├─────────────────────────────────────────────────────────────┤
│  platform.com              → Website Builder UI             │
│  platform.com/admin        → Admin Dashboard                │
├─────────────────────────────────────────────────────────────┤
│  User Sites (Workers for Platforms)                         │
│  ├── site1.platform.com    → User's deployed Worker         │
│  ├── site2.platform.com    → User's deployed Worker         │
│  └── custom.userdomain.com → Custom domain with SSL         │
├─────────────────────────────────────────────────────────────┤
│  my.platform.com           → Fallback origin for CNAMEs     │
└─────────────────────────────────────────────────────────────┘
```

---

## Manual Deployment

```bash
# Clone
git clone https://github.com/dinasaur404/platform-template.git
cd platform-template

# Install
npm install

# Configure secrets
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your values

# Deploy
npm run deploy
```

---

## Custom Domain Setup

To use your own domain instead of `*.workers.dev`:

### 1. Update `wrangler.toml`

```toml
[vars]
CUSTOM_DOMAIN = "platform.com"
CLOUDFLARE_ZONE_ID = "your-zone-id-here"
FALLBACK_ORIGIN = "my.platform.com"

routes = [
  { pattern = "*/*", zone_name = "platform.com" }
]

workers_dev = false
```

### 2. Add DNS Records

In your Cloudflare DNS settings:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| A | `*` | `192.0.2.1` | Proxied |
| A | `my` | `192.0.2.1` | Proxied |

> **Note:** The root domain (`platform.com`) is automatically configured when you add a custom domain to your Worker in the Cloudflare dashboard. The `192.0.2.1` is a dummy IP - Cloudflare's proxy handles the actual routing.

**About the Fallback Origin (`my.platform.com`):**

This is the hostname your customers will CNAME their custom domains to. When a user wants to connect their own domain (e.g., `shop.example.com`), they add:

```
CNAME  shop.example.com  →  my.platform.com
```

Cloudflare uses this fallback origin to route traffic for custom hostnames.

### 3. Redeploy

```bash
npm run deploy
```

---

## Security

The admin page (`/admin`) shows all projects. Protect it with [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/):

1. Go to **Zero Trust** → **Access** → **Applications**
2. Add application for `platform.com/admin*`
3. Configure authentication policy

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Dispatch namespace not found" | Enable Workers for Platforms: [dash.cloudflare.com/?to=/:account/workers-for-platforms](https://dash.cloudflare.com/?to=/:account/workers-for-platforms) |
| "Custom domain not working" | Check Zone ID and DNS records are correct |
| "404 on deployed sites" | Ensure uploaded files include `index.html` at the root |
| Database errors | Visit `/admin` to check status, or `/init` to reset |

**View logs:**
```bash
npx wrangler tail
```

---

## Prerequisites

- **Cloudflare Account** with Workers for Platforms enabled
  - [Purchase Workers for Platforms](https://dash.cloudflare.com/?to=/:account/workers-for-platforms) or contact sales (Enterprise)
- **Node.js 18+**

---

## Learn More

- [Workers for Platforms Docs](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/)
- [Custom Hostnames (Cloudflare for SaaS)](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/)
- [Workers Assets](https://developers.cloudflare.com/workers/static-assets/)
- [D1 Database](https://developers.cloudflare.com/d1/)

## License

Apache-2.0
