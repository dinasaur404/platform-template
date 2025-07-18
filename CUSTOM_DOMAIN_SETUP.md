# Custom Domain Setup

This platform supports both subdomain routing and custom hostname (vanity domain) routing.

## Configuration

1. **Update wrangler.toml** - Set your custom domain variables:
   ```toml
   [vars]
   CUSTOM_DOMAIN = "saasysite.me"           # Your root domain
   BUILDER_SUBDOMAIN = "build"              # Subdomain for the builder (build.saasysite.me)
   CLOUDFLARE_ZONE_ID = "your-zone-id"      # Zone ID for custom hostname API
   # CLOUDFLARE_API_TOKEN is set as a secret (see below)
   ```

2. **Set API Token Secret** - Store the Cloudflare API token securely:
   ```bash
   echo "your-api-token-here" | wrangler secret put CLOUDFLARE_API_TOKEN
   ```

3. **Update routes** - Use wildcard pattern for maximum compatibility:
   ```toml
   routes = [
     { pattern = "*/*", zone_name = "saasysite.me" }
   ]
   ```

4. **DNS Setup** - Add these DNS records in your Cloudflare dashboard:
   - `build.saasysite.me` → Your worker (for the builder interface)
   - `my.saasysite.me` → Your worker (fallback origin for custom hostnames)
   - `*.saasysite.me` → Your worker (for all project subdomains)

## Usage

### Subdomain Routing
- **Builder**: `https://build.saasysite.me`
- **Projects**: `https://projectname.saasysite.me`

### Custom Hostname Routing (Vanity Domains)
- **Customer Domain**: `https://mystore.com` (customer owns this domain)
- **DNS Setup**: Customer adds `CNAME mystore.com → my.saasysite.me`
- **Platform**: Automatically creates custom hostname via Cloudflare API
- **Routing**: Dispatcher looks up `mystore.com` and routes to the correct project

### Without Custom Domain (Default)
- **Builder**: `https://your-worker.workers.dev`
- **Projects**: `https://your-worker.workers.dev/projectname`

## Setup Instructions for Custom Hostnames

When a user wants to use their own domain (e.g., `mystore.com`):

1. **User provides domain**: In the platform UI, they enter `mystore.com`
2. **Platform creates hostname**: Automatically calls Cloudflare API to create custom hostname
3. **DNS Instructions**: User adds `CNAME mystore.com → my.saasysite.me`
4. **SSL Certificate**: Cloudflare automatically provisions SSL certificate
5. **Routing**: Platform routes `mystore.com` requests to the user's project

## API Token Permissions

Your Cloudflare API token needs these permissions:
- `Custom Hostnames:Edit` for your zone
- `Zone:Read` for your zone

## Example Flow

1. User creates project "My Store" with custom domain "mystore.com"
2. Platform calls Cloudflare API to create custom hostname
3. User adds DNS record: `CNAME mystore.com → my.saasysite.me`
4. Visitors to `mystore.com` see the user's website
5. Platform dispatcher routes based on hostname lookup in database