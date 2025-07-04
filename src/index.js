import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCorsConfig } from './utils/cors.js';
// import { generateUUID } from './utils/uuid.js';
import { CloudflareImages } from './lib/cf-images.js';
import { TYPES } from './utils/enum.js';
import { DatabaseManager } from './lib/database.js';

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
    const description = formData.get('description');
    const file = formData.get('file');
    const variant = formData.get('variant');

    // Validate variant
    const allowedVariants = Object.keys(TYPES.VARIANTS);
    let defaultVariant = null;
    if (variant) {
      if (!allowedVariants.includes(variant)) {
        return c.json({ success: false, error: 'Invalid variant' }, 400);
      }

      defaultVariant = TYPES.VARIANTS[variant];
    }

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
      defaultVariant,
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Upload directly to Cloudflare Images
    const cfImages = new CloudflareImages(env.CF_IMAGES_ACCOUNT_ID, env.CF_IMAGES_API_TOKEN);
    const result = await cfImages.uploadImage(file, fileName);

    // Build permanent public URL
    const publicURL = `https://imagedelivery.net/${env.CF_IMAGES_ACCOUNT_HASH}/${result.id}/${defaultVariant || 'public'}`;

    // Generate available URLs for all variants
    const availableUrls = {};
    for (const key in TYPES.VARIANTS) {
      const value = TYPES.VARIANTS[key];
      availableUrls[key] = `https://imagedelivery.net/${env.CF_IMAGES_ACCOUNT_HASH}/${result.id}/${value}`;
    }

    // Save to database
    try {
      const db = new DatabaseManager(env.DB);

      // Save image metadata
      const imageRowId = await db.saveImage({
        image_id: result.id,
        file_name: `${fileName}`,
        description,
        mime_type: file.type,
        size_in_bytes: file.size
      });

      // Save image variants
      await db.saveImageVariants(imageRowId, availableUrls);

      console.info(`${fileName} - Saved to database with ID: ${imageRowId}`);
    } catch (dbError) {
      console.error(`${fileName} - Database save failed:`, dbError);
      // Continue without failing the upload - database is optional
    }

    console.info(`${fileName} - Success upload file`);
    return c.json({
      success: true,
      id: result.id,
      description,
      defaultUrl: publicURL,
      availableUrls
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

// Get image endpoint
app.get('/image', async (c) => {
  try {
    const env = c.env;

    // Validate environment variables
    if (!env.CF_IMAGES_ACCOUNT_HASH) {
      console.error('Missing CF_IMAGES_ACCOUNT_HASH environment variable');
      return c.json({ success: false, error: 'Server configuration error' }, 500);
    }

    // Get query parameters
    const imageId = c.req.query('image_id');
    const variant = c.req.query('variant');

    // Validate image_id
    if (!imageId) {
      return c.json({ success: false, error: 'Missing image_id query parameter' }, 400);
    }

    // Try to get image from database first
    let dbResult = null;
    try {
      if (env.DB) {
        const db = new DatabaseManager(env.DB);
        dbResult = await db.getImageById(imageId);
      }
    } catch (dbError) {
      console.error('Database query failed:', dbError);
      // Continue without database data
    }

    // Validate variant if provided
    const allowedVariants = Object.keys(TYPES.VARIANTS);
    let selectedVariant = 'public'; // default variant

    if (variant) {
      if (!allowedVariants.includes(variant)) {
        return c.json({
          success: false,
          error: `Invalid variant. Allowed variants: ${allowedVariants.join(', ')}`
        }, 400);
      }
      selectedVariant = TYPES.VARIANTS[variant];
    }

    // If we have database result, use it; otherwise generate URLs
    let availableUrls = {};
    if (dbResult && dbResult.availableUrls) {
      availableUrls = dbResult.availableUrls;
    } else {
      // Generate available URLs for all variants
      for (const key in TYPES.VARIANTS) {
        const value = TYPES.VARIANTS[key];
        availableUrls[key] = `https://imagedelivery.net/${env.CF_IMAGES_ACCOUNT_HASH}/${imageId}/${value}`;
      }
    }

    // Build default URL with selected variant
    const defaultUrl = availableUrls[variant] || `https://imagedelivery.net/${env.CF_IMAGES_ACCOUNT_HASH}/${imageId}/${selectedVariant}`;

    console.info(`Retrieved image info for ID: ${imageId}`);
    return c.json({
      success: true,
      id: imageId,
      defaultUrl,
      availableUrls,
      ...(dbResult && {
        metadata: {
          file_name: dbResult.file_name,
          description: dbResult.description,
          mime_type: dbResult.mime_type,
          size_in_bytes: dbResult.size_in_bytes,
          created_at: dbResult.created_at
        }
      })
    });
  } catch (error) {
    console.error('Get image error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error'
    }, 500);
  }
});

// Get all images endpoint with pagination
app.get('/images', async (c) => {
  try {
    const env = c.env;

    // Validate environment variables
    if (!env.CF_IMAGES_ACCOUNT_HASH) {
      console.error('Missing CF_IMAGES_ACCOUNT_HASH environment variable');
      return c.json({ success: false, error: 'Server configuration error' }, 500);
    }

    // Get query parameters for pagination
    const limitParam = c.req.query('limit');
    const offsetParam = c.req.query('offset');
    const pageParam = c.req.query('page');

    // Parse and validate pagination parameters
    let limit = 20; // default limit
    let offset = 0; // default offset

    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return c.json({ success: false, error: 'Invalid limit. Must be between 1 and 100.' }, 400);
      }
      limit = parsedLimit;
    }

    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return c.json({ success: false, error: 'Invalid offset. Must be 0 or greater.' }, 400);
      }
      offset = parsedOffset;
    }

    // Handle page-based pagination (alternative to offset)
    if (pageParam) {
      const parsedPage = parseInt(pageParam, 10);
      if (isNaN(parsedPage) || parsedPage < 1) {
        return c.json({ success: false, error: 'Invalid page. Must be 1 or greater.' }, 400);
      }
      offset = (parsedPage - 1) * limit;
    }

    // Try to get images from database
    try {
      if (!env.DB) {
        return c.json({ success: false, error: 'Database not available' }, 503);
      }

      const db = new DatabaseManager(env.DB);
      const result = await db.getAllImages(limit, offset);

      // Transform images to include URLs
      const transformedImages = result.images.map(image => {
        // Generate available URLs for all variants
        const availableUrls = {};
        for (const key in TYPES.VARIANTS) {
          const value = TYPES.VARIANTS[key];
          availableUrls[key] = `https://imagedelivery.net/${env.CF_IMAGES_ACCOUNT_HASH}/${image.image_id}/${value}`;
        }

        return {
          id: image.image_id,
          file_name: image.file_name,
          description: image.description,
          mime_type: image.mime_type,
          size_in_bytes: image.size_in_bytes,
          created_at: image.created_at,
          defaultUrl: `https://imagedelivery.net/${env.CF_IMAGES_ACCOUNT_HASH}/${image.image_id}/public`,
          availableUrls
        };
      });

      console.info(`Retrieved ${result.images.length} images (total: ${result.total})`);
      return c.json({
        success: true,
        images: transformedImages,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          page: Math.floor(result.offset / result.limit) + 1,
          totalPages: Math.ceil(result.total / result.limit),
          hasMore: result.hasMore
        }
      });
    } catch (dbError) {
      console.error('Database query failed:', dbError);
      return c.json({ success: false, error: 'Database query failed' }, 500);
    }
  } catch (error) {
    console.error('Get images error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error'
    }, 500);
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
