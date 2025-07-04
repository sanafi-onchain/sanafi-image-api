# Sanafi Image API

A Cloudflare Worker API for image uploading with support for both direct uploads and presigned URLs using Cloudflare Images.

## Features

- 🚀 **Fast & Reliable**: Built on Cloudflare Workers for global edge deployment
- 🖼️ **Image Upload**: Direct upload with multiple variant support
- 🗄️ **Database Integration**: Cloudflare D1 for persistent image metadata storage
- 🔒 **CORS Protection**: Configurable origin whitelist
- 📁 **Multiple Formats**: Support for JPG, PNG, and SVG images
- 🛡️ **File Validation**: Size limits and MIME type checking
- 📄 **Pagination**: Efficient image listing with pagination support
- ⚡ **Hono Framework**: Modern, fast web framework for Workers

## Database Setup

This API uses Cloudflare D1 (SQLite) database to store image metadata and variant URLs.

### Initial Database Setup

**For new projects** (first time setup):

1. **Create D1 database** (if not already created):
   ```bash
   wrangler d1 create sanafi-general
   ```

2. **Setup database schema**:
   ```bash
   ./setup-db.sh
   ```

   This script will:
   - Apply the schema to both local and remote databases
   - Create `images` and `image_variants` tables
   - Set up necessary indexes

### Database Migration

**For existing projects** that need schema updates:

#### Local Database Migration
```bash
# Apply migration to local database (for development)
wrangler d1 execute sanafi-general --file=./database/migration-add-description.sql
```

#### Remote Database Migration
```bash
# Apply migration to remote database (for production)
wrangler d1 execute sanafi-general --remote --file=./database/migration-add-description.sql
```

### When to Use Setup vs Migration

| Scenario | Command | Purpose |
|----------|---------|---------|
| **New Project** | `./setup-db.sh` | Creates all tables from scratch |
| **Schema Updates** | `wrangler d1 execute sanafi-general --file=./database/migration-*.sql` | Applies incremental changes |
| **Local Development** | Add `--local` flag | Test changes locally first |
| **Production Deployment** | Remove `--local` flag | Apply to live database |

### Database Schema

The database consists of two main tables:

#### `images` Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-incrementing internal ID |
| image_id | TEXT NOT NULL UNIQUE | Cloudflare Images ID |
| file_name | TEXT | Original or custom file name |
| description | TEXT | Optional image description |
| mime_type | TEXT | MIME type (image/jpeg, etc.) |
| size_in_bytes | INTEGER | File size in bytes |
| created_at | DATETIME | Upload timestamp |
| updated_at | DATETIME | Last update timestamp |

#### `image_variants` Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-incrementing internal ID |
| image_id | INTEGER | Foreign key to images.id |
| variant_name | TEXT | Variant name (thumbnail, medium, etc.) |
| url | TEXT | Full URL for the variant |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### Database Files Structure

```
database/
├── schema.sql                     # Complete database schema
└── migration-add-description.sql  # Migration to add description field
```

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

Upload images and get a public URL immediately.

**Request Format**: `multipart/form-data`

**Required Fields**:
- `file` (blob): Image file (JPG, PNG, or SVG, max 5MB)

**Optional Fields**:
- `new_file_name` (string): Custom filename (defaults to timestamp)
- `description` (string): Optional description for the image
- `variant` (string): Default variant to use in the response URL

### GET /image

Retrieve information about a specific image by ID.

**Query Parameters**:
- `image_id` (required): The Cloudflare Images ID
- `variant` (optional): Specify which variant to use as the default URL

**Example**: `GET /image?image_id=abc123&variant=thumbnail`

### GET /images

List all images with pagination support.

**Query Parameters**:
- `limit` (optional): Number of images per page (default: 20, max: 100)
- `offset` (optional): Number of images to skip
- `page` (optional): Page number (alternative to offset)

**Examples**:
- `GET /images` - First 20 images
- `GET /images?limit=10&offset=20` - Offset-based pagination
- `GET /images?page=3&limit=15` - Page-based pagination

### Response Format

#### Upload Response
```json
{
  "success": true,
  "id": "image_id_here",
  "defaultUrl": "https://imagedelivery.net/account_hash/image_id/variant",
  "availableUrls": {
    "thumbnail": "https://imagedelivery.net/.../image_id/thumb",
    "medium": "https://imagedelivery.net/.../image_id/medium",
    "public": "https://imagedelivery.net/.../image_id/public"
  }
}
```

#### Get Image Response
```json
{
  "success": true,
  "id": "image_id_here",
  "defaultUrl": "https://imagedelivery.net/account_hash/image_id/variant",
  "availableUrls": { /* all variants */ },
  "metadata": {
    "file_name": "my-image.jpg",
    "description": "A beautiful sunset photo",
    "mime_type": "image/jpeg",
    "size_in_bytes": 204800,
    "created_at": "2025-07-04T10:00:00Z"
  }
}
```

#### List Images Response
```json
{
  "success": true,
  "images": [
    {
      "id": "image_id_here",
      "file_name": "my-image.jpg",
      "description": "A beautiful sunset photo",
      "mime_type": "image/jpeg",
      "size_in_bytes": 204800,
      "created_at": "2025-07-04T10:00:00Z",
      "defaultUrl": "https://imagedelivery.net/.../image_id/public",
      "availableUrls": { /* all variants */ }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "page": 1,
    "totalPages": 8,
    "hasMore": true
  }
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

### Upload with cURL

```bash
# Basic upload
curl -X POST http://localhost:8787/upload \
  -H "Origin: https://localhost:3000" \
  -F "new_file_name=my-image" \
  -F "file=@/path/to/image.jpg"

# Upload with description and variant
curl -X POST http://localhost:8787/upload \
  -H "Origin: https://localhost:3000" \
  -F "new_file_name=sunset-photo" \
  -F "description=Beautiful sunset at the beach" \
  -F "variant=medium" \
  -F "file=@/path/to/sunset.jpg"
```

### Get Image Information

```bash
# Get image by ID
curl "http://localhost:8787/image?image_id=abc123"

# Get image with specific variant as default
curl "http://localhost:8787/image?image_id=abc123&variant=thumbnail"
```

### List Images with Pagination

```bash
# Get first page (default 20 images)
curl "http://localhost:8787/images"

# Get specific page with custom limit
curl "http://localhost:8787/images?page=2&limit=10"

# Use offset-based pagination
curl "http://localhost:8787/images?offset=40&limit=20"
```

### JavaScript/TypeScript Example

```javascript
// Upload with description
const formData = new FormData();
formData.append('new_file_name', 'my-awesome-image');
formData.append('description', 'This is a test image upload');
formData.append('variant', 'medium');
formData.append('file', fileInput.files[0]);

const uploadResponse = await fetch('https://your-worker.your-subdomain.workers.dev/upload', {
  method: 'POST',
  body: formData
});

const uploadResult = await uploadResponse.json();
if (uploadResult.success) {
  console.log('Image ID:', uploadResult.id);
  console.log('Default URL:', uploadResult.defaultUrl);
  console.log('Available URLs:', uploadResult.availableUrls);
}

// Get image information
const imageResponse = await fetch(`https://your-worker.your-subdomain.workers.dev/image?image_id=${uploadResult.id}&variant=thumbnail`);
const imageResult = await imageResponse.json();

if (imageResult.success) {
  console.log('Image metadata:', imageResult.metadata);
  console.log('Thumbnail URL:', imageResult.defaultUrl);
}

// List images with pagination
const listResponse = await fetch('https://your-worker.your-subdomain.workers.dev/images?page=1&limit=10');
const listResult = await listResponse.json();

if (listResult.success) {
  console.log('Images:', listResult.images);
  console.log('Pagination info:', listResult.pagination);
  
  // Check if there are more pages
  if (listResult.pagination.hasMore) {
    console.log('More images available on next page');
  }
}
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
│   │   ├── cf-images.js      # Cloudflare Images API wrapper
│   │   └── database.js       # D1 Database manager
│   └── utils/
│       ├── cors.js           # CORS utilities
│       ├── enum.js           # Constants and enums
│       └── uuid.js           # UUID generation utilities
├── database/
│   ├── schema.sql            # Complete database schema
│   └── migration-add-description.sql # Migration files
├── wrangler.toml             # Cloudflare Worker configuration
├── setup-db.sh              # Database setup script
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
