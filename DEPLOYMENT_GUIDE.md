# Workers for Platforms Template - Deployment Guide

This template provides a ready-to-deploy website builder platform using Cloudflare Workers for Platforms. Users can create and deploy websites with both subdomain routing and custom domain support.

## Prerequisites

- Cloudflare account with Workers for Platforms access
- Node.js 18+ installed
- A domain you control (for custom domain support)

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/dinasaur404/workers-platform-template.git
cd workers-platform-template
npm install
```

### 2. Create D1 Database

```bash
npx wrangler d1 create workers-platform-template
```

Copy the database ID from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "workers-platform-template"
database_id = "YOUR_DATABASE_ID_HERE"  # <- Update this
```

### 3. Create Dispatch Namespace

```bash
npx wrangler dispatch-namespace create workers-platform-template
```

### 4. Configure Environment Variables

Update the `[vars]` section in `wrangler.toml`:

```toml
[vars]
DISPATCH_NAMESPACE_NAME = "workers-platform-template"
ACCOUNT_ID = "YOUR_ACCOUNT_ID"        # Get from Cloudflare dashboard

# Optional: Custom domain configuration
CUSTOM_DOMAIN = "yourdomain.com"                         # Your root domain
BUILDER_SUBDOMAIN = "build"                              # Subdomain for builder (build.yourdomain.com)
FALLBACK_ORIGIN = "my.yourdomain.com"                    # Fallback origin for custom hostnames
CLOUDFLARE_ZONE_ID = "YOUR_ZONE_ID"                      # Zone ID for custom hostname API
```

**Note**: API tokens are now stored as secrets for security (see below).

### 5. Create API Tokens

You need two API tokens:

#### Dispatch Namespace API Token
1. Go to Cloudflare Dashboard → "My Profile" → "API Tokens"
2. Click "Create Token"
3. Use "Custom token" with these permissions:
   - `Account:Workers Scripts:Edit`
   - `Zone:Zone:Read` (for your domain)
4. Set Account Resources to your account
5. Set as secret: `echo "YOUR_TOKEN_HERE" | wrangler secret put DISPATCH_NAMESPACE_API_TOKEN`

#### Custom Hostname API Token (Optional)
1. Create another custom token with these permissions:
   - `Zone:Custom Hostnames:Edit`
   - `Zone:Zone:Read`
2. Set Zone Resources to your domain
3. Set as secret: `echo "YOUR_TOKEN_HERE" | wrangler secret put CLOUDFLARE_API_TOKEN`

### 6. Configure DNS (Optional - For Custom Domain)

If using a custom domain, add these DNS records:

```
Type    Name                    Target
A/AAAA  build.yourdomain.com    100.100.100.100  # Or your CF IP
A/AAAA  my.yourdomain.com       100.100.100.100  # Fallback origin
A/AAAA  *.yourdomain.com        100.100.100.100  # Wildcard for subdomains
```

### 7. Update Routes (Optional - For Custom Domain)

If using a custom domain, update the routes in `wrangler.toml`:

```toml
routes = [
  { pattern = "*/*", zone_name = "yourdomain.com" }
]
```

### 8. Deploy

```bash
# Deploy to production
npx wrangler deploy

# Or run locally for development
npx wrangler dev --remote
```

### 9. Initialize Database

After deployment, visit your worker URL and add `/init` to initialize the database:

```
https://your-worker.workers.dev/init
```

## Usage

### Website Builder Interface

- **With Custom Domain**: `https://build.yourdomain.com`
- **Without Custom Domain**: `https://your-worker.workers.dev`

### Created Websites

- **Subdomain**: `https://projectname.yourdomain.com`
- **Custom Domain**: `https://customdomain.com` (after DNS setup)
- **Workers.dev**: `https://your-worker.workers.dev/projectname`

### Admin Interface

Access the admin dashboard at `/admin` to:
- View created projects
- See dispatch namespace scripts
- Reinitialize the database

## Features

✅ **Website Builder**: Visual interface for creating websites
✅ **Subdomain Routing**: Automatic `project.yourdomain.com` routing
✅ **Custom Domains**: Connect customer domains with automatic SSL
✅ **D1 Database**: Project storage and management
✅ **Multi-tenant**: Isolated project deployment
✅ **Real-time Deployment**: Instant website deployment

## File Structure

```
src/
├── index.ts          # Main application and routing
├── db.ts             # Database operations
├── types.ts          # TypeScript interfaces
├── env.ts            # Environment bindings
├── router.ts         # Middleware
├── render.ts         # HTML/CSS/JS templates
├── resource.ts       # Dispatch namespace API
└── cloudflare-api.ts # Custom hostname API
```

## Troubleshooting

### Common Issues

1. **Database not initialized**: Visit `/init` after deployment
2. **Dispatch namespace not found**: Ensure namespace is created and API token is correct
3. **Custom domains not working**: Check DNS records and API token permissions
4. **Script deployment fails**: Verify dispatch namespace API token has correct permissions

### Debug Commands

```bash
# Check logs
npx wrangler tail

# Test database
npx wrangler d1 execute workers-platform-template --command "SELECT * FROM projects"

# List dispatch namespace scripts
npx wrangler dispatch-namespace list workers-platform-template
```

## Security Notes

- API tokens are stored in `wrangler.toml` - keep this file secure
- For production, use environment variables or secrets management
- Consider rate limiting for the project creation endpoint
- Validate all user inputs before deployment

## Customization

### Modify Website Builder UI
Edit `src/render.ts` → `BuildWebsitePage` to customize the website builder interface.

### Add Custom Bindings
Update `src/env.ts` and `wrangler.toml` to add additional Cloudflare bindings.

### Custom Project Validation
Modify the `/projects` endpoint in `src/index.ts` to add custom validation logic.

## Support

For issues or questions:
- Check the [Cloudflare Workers for Platforms documentation](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/)
- Review the troubleshooting section above
- Open an issue in the GitHub repository

---

**Note**: This template is production-ready but you may want to add additional security measures, monitoring, and customization based on your specific requirements.