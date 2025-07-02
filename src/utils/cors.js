/**
 * CORS configuration utilities
 */

/**
 * Get CORS configuration for Hono
 * @param {Object} env - Environment variables (optional, for request-specific CORS)
 * @returns {Object} CORS configuration
 */
export function getCorsConfig(env = null) {
  return {
    origin: (origin, c) => {
      // Get allowed origins from environment or use default
      const allowedOrigins = env?.ALLOWED_ORIGINS || c.env?.ALLOWED_ORIGINS || '';
      const origins = allowedOrigins
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

      // Allow requests with no origin (e.g., Postman, cURL)
      if (!origin) return true;

      // Check if origin is in allowed list
      return origins.includes(origin);
    },
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'X-Request-ID'],
    maxAge: 86400, // 24 hours
    credentials: true
  };
}

/**
 * Validate origin against allowed origins
 * @param {string} origin - The origin to validate
 * @param {string} allowedOrigins - Comma-separated list of allowed origins
 * @returns {boolean} Whether the origin is allowed
 */
export function isOriginAllowed(origin, allowedOrigins) {
  if (!origin || !allowedOrigins) return false;

  const origins = allowedOrigins
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  return origins.includes(origin);
}

/**
 * Set CORS headers manually (alternative to middleware)
 * @param {Object} headers - Headers object to modify
 * @param {string} origin - Request origin
 * @param {string} allowedOrigins - Comma-separated list of allowed origins
 */
export function setCorsHeaders(headers, origin, allowedOrigins) {
  if (isOriginAllowed(origin, allowedOrigins)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin'
  );
  headers.set('Access-Control-Expose-Headers', 'Content-Length, X-Request-ID');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');
}

/**
 * Create a CORS-enabled Response
 * @param {any} body - Response body
 * @param {Object} init - Response init options
 * @param {string} origin - Request origin
 * @param {string} allowedOrigins - Comma-separated list of allowed origins
 * @returns {Response}
 */
export function createCorsResponse(body, init = {}, origin, allowedOrigins) {
  const response = new Response(body, init);
  setCorsHeaders(response.headers, origin, allowedOrigins);
  return response;
}
