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

Click the **Deploy to Cloudflare** button above. Everything is auto-configured!

### Optional: Custom Domain

If you want to use your own domain instead of `*.workers.dev`, you can optionally provide:

| Variable | Description |
|----------|-------------|
| `CUSTOM_DOMAIN` | Your root domain (e.g., `platform.com`) |

All other configuration (API tokens, account ID, zone ID) is automatically detected and provisioned during deployment.

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

# Run interactive setup (creates tokens, configures everything)
npm run setup

# Deploy
npm run deploy
```

The setup script will:
- Validate your Cloudflare credentials
- Create the dispatch namespace for Workers for Platforms
- Auto-create API tokens with correct permissions (if needed)
- Generate `.dev.vars` with all required configuration
- Update `wrangler.toml` with your settings

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

In your Cloudflare DNS settings for `platform.com`:

| Type | Name | Content | Result | Proxy |
|------|------|---------|--------|-------|
| A | `*` | `192.0.2.1` | `*.platform.com` | Proxied |
| A | `my` | `192.0.2.1` | `my.platform.com` | Proxied |

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
