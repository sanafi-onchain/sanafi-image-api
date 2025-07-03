import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCorsConfig } from './utils/cors.js';
// import { generateUUID } from './utils/uuid.js';
import { CloudflareImages } from './lib/cf-images.js';
import { TYPES } from './utils/enum.js';

const app = new Hono();

// Global CORS middleware
app.use('*', (c, next) => {
  // Pass the context's env to getCorsConfig
  return cors(getCorsConfig(c.env))(c, next);
});

// Handle preflight OPTIONS requests
app.options('*', () => {
  return new Response(null, { status: 204 });
});

// Upload endpoint
app.post('/upload', async (c) => {
  try {
    const env = c.env;

    // Validate environment variables
    if (!env.CF_IMAGES_ACCOUNT_ID || !env.CF_IMAGES_API_TOKEN) {
      console.error('Missing required environment variables');
      return c.json({ success: false, error: 'Server configuration error' }, 500);
    }

    // Check Content-Type
    const contentType = c.req.header('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return c.json({ success: false, error: 'Content-Type must be multipart/form-data' }, 415);
    }

    // Parse form data
    let formData;
    try {
      formData = await c.req.formData();
    } catch (error) {
      console.error('Failed to parse form data:', error);
      return c.json({ success: false, error: 'Invalid form data' }, 400);
    }

    // Extract fields
    const newFileName = formData.get('new_file_name');
    const file = formData.get('file');
    const variant = formData.get('variant');

    // Validate variant
    const allowedVariants = Object.keys(TYPES.VARIANTS);
    if (!variant || !allowedVariants.includes(variant)) {
      return c.json({ success: false, error: 'Invalid variant' }, 400);
    }
    const pickedVariant = TYPES.VARIANTS[variant];

    // Validate new_file_name request
    if (newFileName && !/^[a-zA-Z0-9_-]+$/.test(newFileName)) {
      return c.json({ success: false, error: 'Invalid new_file_name. Only alphanumeric characters, underscores, and hyphens are allowed.' }, 400);
    }

    // Validate file
    if (!file || !(file instanceof File)) {
      return c.json({ success: false, error: 'Missing or invalid file' }, 400);
    }

    // Validate file size (5MB = 5 * 1024 * 1024 bytes)
    const maxSizeInMB = 5;
    const maxFileSize = maxSizeInMB * 1024 * 1024;
    if (file.size > maxFileSize) {
      return c.json({ success: false, error: `File size exceeds ${maxSizeInMB}MB limit` }, 413);
    }

    // Validate MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(file.type)) {
      return c.json({
        success: false,
        error: `Unsupported file type. Allowed: ${allowedMimeTypes.join(', ')}`
      }, 415);
    }

    const fileName = newFileName || Date.now();
    console.info(`${fileName} - Uploading file:`, {
      fileName,
      pickedVariant,
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Upload directly to Cloudflare Images
    const cfImages = new CloudflareImages(env.CF_IMAGES_ACCOUNT_ID, env.CF_IMAGES_API_TOKEN);
    const result = await cfImages.uploadImage(file, fileName);

    // Build permanent public URL
    const publicURL = `https://imagedelivery.net/${env.CF_IMAGES_ACCOUNT_HASH}/${result.id}/${pickedVariant}`;
    console.info(`${fileName} - Success upload file`);

    return c.json({
      success: true,
      url: publicURL,
      id: result.id
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error'
    }, 500);
  }
});

// Handle non-POST requests to /upload
app.all('/upload', (c) => {
  if (c.req.method !== 'POST') {
    return c.json({ success: false, error: 'Method not allowed. Use POST.' }, 405);
  }
});

// Default route
app.get('/', (c) => {
  return c.json({
    message: 'Sanafi Image API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: 'Endpoint not found' }, 404);
});

export default app;
