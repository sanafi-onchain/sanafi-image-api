/**
 * UUID generation utilities
 */

/**
 * Generate a UUID v4
 * @returns {string} A UUID v4 string
 */
export function generateUUID() {
  // Use crypto.randomUUID() if available (Cloudflare Workers runtime)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation for environments without crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a short UUID (8 characters)
 * @returns {string} A short UUID string
 */
export function generateShortUUID() {
  const fullUUID = generateUUID();
  return fullUUID.replace(/-/g, '').substring(0, 8);
}

/**
 * Validate if a string is a valid UUID
 * @param {string} uuid - The string to validate
 * @returns {boolean} Whether the string is a valid UUID
 */
export function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Generate a filename-safe UUID (no dashes)
 * @returns {string} A UUID string without dashes
 */
export function generateFilenameUUID() {
  return generateUUID().replace(/-/g, '');
}

/**
 * Generate a timestamp-prefixed UUID
 * @returns {string} A UUID with timestamp prefix
 */
export function generateTimestampUUID() {
  const timestamp = Date.now().toString(36);
  const uuid = generateShortUUID();
  return `${timestamp}-${uuid}`;
}
