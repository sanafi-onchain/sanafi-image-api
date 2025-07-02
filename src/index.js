import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCorsConfig } from './utils/cors.js';
import { generateUUID } from './utils/uuid.js';
import { CloudflareImages } from './lib/cf-images.js';

const app = new Hono();

// Global CORS middleware
app.use('*', cors(getCorsConfig()));

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

    // Extract and validate fields
    const isOnlyPresignStr = formData.get('is_only_presign');
    const newFileName = formData.get('new_file_name');
    const file = formData.get('file');

    // Validate required fields
    if (isOnlyPresignStr === null) {
      return c.json({ success: false, error: 'Missing required field: is_only_presign' }, 400);
    }

    if (!file || !(file instanceof File)) {
      return c.json({ success: false, error: 'Missing or invalid file' }, 400);
    }

    // Parse boolean
    const isOnlyPresign = isOnlyPresignStr === 'true';

    // Validate file size (5MB = 5 * 1024 * 1024 bytes)
    const maxFileSize = 5 * 1024 * 1024;
    if (file.size > maxFileSize) {
      return c.json({ success: false, error: 'File size exceeds 5MB limit' }, 413);
    }

    // Validate MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(file.type)) {
      return c.json({
        success: false,
        error: `Unsupported file type. Allowed: ${allowedMimeTypes.join(', ')}`
      }, 415);
    }

    console.log('File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
      isOnlyPresign
    });

    const cfImages = new CloudflareImages(env.CF_IMAGES_ACCOUNT_ID, env.CF_IMAGES_API_TOKEN);

    if (isOnlyPresign) {
      // Generate presigned URL
      const result = await cfImages.createDirectUpload();

      return c.json({
        success: true,
        presignURL: result.uploadURL,
        id: result.id
      });
    } else {
      // Direct upload
      const fileName = newFileName || generateUUID();
      const result = await cfImages.uploadImage(file, fileName);

      // Build permanent URL
      const publicURL = `https://imagedelivery.net/${env.CF_IMAGES_ACCOUNT_ID}/${result.id}/public`;

      return c.json({
        success: true,
        publicURL,
        id: result.id
      });
    }
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

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: 'Endpoint not found' }, 404);
});

export default app;
