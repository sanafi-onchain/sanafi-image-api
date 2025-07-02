# Sanafi Image API

A Cloudflare Worker API for image uploading with support for both direct uploads and presigned URLs using Cloudflare Images.

## Features

- 🚀 **Fast & Reliable**: Built on Cloudflare Workers for global edge deployment
- 🖼️ **Image Upload**: Direct upload or presigned URL generation
- 🔒 **CORS Protection**: Configurable origin whitelist
- 📁 **Multiple Formats**: Support for JPG, PNG, and SVG images
- 🛡️ **File Validation**: Size limits and MIME type checking
- ⚡ **Hono Framework**: Modern, fast web framework for Workers

## Quick Start

### 1. Environment Setup

**⚠️ IMPORTANT: Never commit API tokens to your repository!**

#### Local Development Setup

Set up your sensitive credentials using Wrangler secrets:

```bash
# Set your Cloudflare Images Account ID
wrangler secret put CF_IMAGES_ACCOUNT_ID
# Enter your account ID when prompted

# Set your Cloudflare Images API Token
wrangler secret put CF_IMAGES_API_TOKEN
# Enter your API token when prompted
```

Alternatively, you can set them via the Cloudflare Dashboard:
1. Go to **Workers & Pages** → **Your Worker** → **Settings** → **Variables**
2. Add `CF_IMAGES_ACCOUNT_ID` and `CF_IMAGES_API_TOKEN` as **encrypted variables**

#### GitHub Repository Setup (Optional - for future auto-deployment)

If you decide to add GitHub Actions later, you'll need these secrets:
1. Go to your repo → **Settings** → **Secrets and Variables** → **Actions**
2. Add the following **Repository Secrets**:
   - `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token (Global API Key or custom token with Workers:Edit permission)
   - `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare Account ID
   - `CF_IMAGES_ACCOUNT_ID` - Your Cloudflare Images Account ID  
   - `CF_IMAGES_API_TOKEN` - Your Cloudflare Images API Token

### 2. Local Development

```bash
# Install dependencies
yarn install

# Start local development server
yarn dev

# The API will be available at http://localhost:8787
```

## Manual Deployment

```bash
# Deploy to development
yarn deploy:dev

# Deploy to production  
yarn deploy
```

## Environment Configuration

### Sensitive Variables (Set via Wrangler Secrets)
- `CF_IMAGES_ACCOUNT_ID` - Your Cloudflare Images Account ID
- `CF_IMAGES_API_TOKEN` - Your Cloudflare Images API Token

### Public Variables (Safe in wrangler.toml)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

### Setting Secrets

```bash
# For development environment
wrangler secret put CF_IMAGES_ACCOUNT_ID --env development
wrangler secret put CF_IMAGES_API_TOKEN --env development

# For production environment  
wrangler secret put CF_IMAGES_ACCOUNT_ID --env production
wrangler secret put CF_IMAGES_API_TOKEN --env production
```

## API Endpoints

### POST /upload

Upload images or generate presigned upload URLs.

**Request Format**: `multipart/form-data`

**Required Fields**:
- `is_only_presign` (boolean): `true` for presigned URL, `false` for direct upload
- `file` (blob): Image file (JPG, PNG, or SVG, max 5MB)

**Optional Fields**:
- `new_file_name` (string): Custom filename (defaults to UUID)

### Response Formats

#### Presigned URL Response (`is_only_presign: true`)
```json
{
  "success": true,
  "presignURL": "https://upload.imagedelivery.net/...",
  "id": "image_id_here"
}
```

#### Direct Upload Response (`is_only_presign: false`)
```json
{
  "success": true,
  "publicURL": "https://imagedelivery.net/account_hash/image_id/public",
  "id": "image_id_here"
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Error description"
}
```

## Example Usage

### Direct Upload with cURL

```bash
curl -X POST http://localhost:8787/upload \
  -H "Origin: https://localhost:3000" \
  -F "is_only_presign=false" \
  -F "new_file_name=my-image" \
  -F "file=@/path/to/image.jpg"
```

### Presigned URL Generation

```bash
curl -X POST http://localhost:8787/upload \
  -H "Origin: https://localhost:3000" \
  -F "is_only_presign=true" \
  -F "file=@/path/to/image.jpg"
```

### JavaScript/TypeScript Example

```javascript
const formData = new FormData();
formData.append('is_only_presign', 'false');
formData.append('new_file_name', 'my-awesome-image');
formData.append('file', fileInput.files[0]);

const response = await fetch('https://your-worker.your-subdomain.workers.dev/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
if (result.success) {
  console.log('Image URL:', result.publicURL);
}
```

## Environment Configuration

### Per-Environment Variables

You can override public variables for different environments in `wrangler.toml`:

```toml
[env.production.vars]
ALLOWED_ORIGINS = "https://production-domain.com"

[env.development.vars]
ALLOWED_ORIGINS = "https://staging-domain.com,https://localhost:3000"
```

**Note**: Sensitive variables (API tokens) should always be set via `wrangler secret put` or the Cloudflare Dashboard, never in wrangler.toml.

### Required Cloudflare Images API Token Scopes

Your API token needs the following permissions:
- **Zone**: `Zone:Read` (for the zone containing your domain)
- **Account**: `Cloudflare Images:Edit`

## CORS Configuration

The API validates the `Origin` header against the `ALLOWED_ORIGINS` environment variable. Origins should be comma-separated:

```
ALLOWED_ORIGINS = "https://app.example.com,https://admin.example.com,https://localhost:3000"
```

Requests from non-whitelisted origins will receive a `403 Forbidden` response.

## Error Responses

| Status Code | Error | Description |
|-------------|--------|-------------|
| 400 | Bad Request | Missing required fields or invalid form data |
| 403 | Forbidden | Origin not in CORS whitelist |
| 405 | Method Not Allowed | Non-POST request to /upload endpoint |
| 413 | Payload Too Large | File size exceeds 5MB limit |
| 415 | Unsupported Media Type | Invalid MIME type or content-type |
| 500 | Internal Server Error | Server configuration or Cloudflare API error |

## File Restrictions

- **Maximum file size**: 5MB
- **Supported formats**: 
  - `image/jpeg`
  - `image/jpg` 
  - `image/png`
  - `image/svg+xml`

## Development Scripts

```bash
# Lint code
yarn lint

# Fix linting issues
yarn lint:fix

# Format code with Prettier
yarn format

# Check code formatting
yarn format:check
```

## Project Structure

```
sanafi-image-api/
├── src/
│   ├── index.js              # Main Worker entry point
│   ├── lib/
│   │   └── cf-images.js      # Cloudflare Images API wrapper
│   └── utils/
│       ├── cors.js           # CORS utilities
│       └── uuid.js           # UUID generation utilities
├── wrangler.toml             # Cloudflare Worker configuration
├── package.json              # Node.js dependencies and scripts
├── .eslintrc.json           # ESLint configuration
├── .prettierrc              # Prettier configuration
└── README.md                # This file
```

## Health Check

The API includes a health check endpoint:

```bash
curl https://your-worker.your-subdomain.workers.dev/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-02T10:30:00.000Z"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and `npm run format`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
