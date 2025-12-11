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
| `FALLBACK_ORIGIN` | A subdomain for custom hostname CNAMEs (e.g., `proxy.yourdomain.com`) |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Your Platform (this template)                              │
├─────────────────────────────────────────────────────────────┤
│  build.yoursite.com        → Website Builder UI             │
│  build.yoursite.com/admin  → Admin Dashboard                │
├─────────────────────────────────────────────────────────────┤
│  User Sites (Workers for Platforms)                         │
│  ├── site1.yoursite.com    → User's deployed Worker         │
│  ├── site2.yoursite.com    → User's deployed Worker         │
│  └── custom.userdomain.com → Custom domain with SSL         │
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
CUSTOM_DOMAIN = "yoursite.com"
CLOUDFLARE_ZONE_ID = "your-zone-id-here"
FALLBACK_ORIGIN = "proxy.yoursite.com"

routes = [
  { pattern = "*/*", zone_name = "yoursite.com" }
]

workers_dev = false
```

### 2. Add DNS Records

In your Cloudflare DNS settings:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `build` | `your-worker.workers.dev` | Proxied |
| CNAME | `*` | `your-worker.workers.dev` | Proxied |
| CNAME | `proxy` | `your-worker.workers.dev` | Proxied |

**About the `proxy` record (Fallback Origin):**

This is the hostname that your customers will CNAME their custom domains to. When a user wants to connect their own domain (e.g., `shop.example.com`), they'll add a DNS record:

```
CNAME  shop.example.com  →  proxy.yoursite.com
```

Cloudflare uses this fallback origin to route traffic for custom hostnames. The `FALLBACK_ORIGIN` variable in your config should match this record (e.g., `proxy.yoursite.com`).

### 3. Redeploy

```bash
npm run deploy
```

---

## Security

The admin page (`/admin`) shows all projects. Protect it with [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/):

1. Go to **Zero Trust** → **Access** → **Applications**
2. Add application for `yourdomain.com/admin*`
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
