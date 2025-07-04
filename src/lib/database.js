/**
 * Database utility functions for D1 operations
 */

export class DatabaseManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Save image metadata to the database
   */
  async saveImage(imageData) {
    const { image_id, file_name, description, mime_type, size_in_bytes } = imageData;

    try {
      // Insert image record
      const imageResult = await this.db.prepare(`
        INSERT INTO images (image_id, file_name, description, mime_type, size_in_bytes)
        VALUES (?, ?, ?, ?, ?)
      `).bind(image_id, file_name, description || null, mime_type, size_in_bytes).run();

      if (!imageResult.success) {
        throw new Error('Failed to save image to database');
      }

      return imageResult.meta.last_row_id;
    } catch (error) {
      console.error('Database error saving image:', error);
      throw error;
    }
  }

  /**
   * Save image variants to the database
   */
  async saveImageVariants(imageRowId, variants) {
    try {
      const statements = [];

      for (const [variantName, url] of Object.entries(variants)) {
        statements.push(
          this.db.prepare(`
            INSERT INTO image_variants (image_id, variant_name, url)
            VALUES (?, ?, ?)
          `).bind(imageRowId, variantName, url)
        );
      }

      await this.db.batch(statements);
      return true;
    } catch (error) {
      console.error('Database error saving variants:', error);
      throw error;
    }
  }

  /**
   * Get image by Cloudflare Images ID
   */
  async getImageById(imageId) {
    try {
      // Get image metadata
      const image = await this.db.prepare(`
        SELECT * FROM images WHERE image_id = ?
      `).bind(imageId).first();

      if (!image) {
        return null;
      }

      // Get all variants for this image
      const variants = await this.db.prepare(`
        SELECT variant_name, url FROM image_variants WHERE image_id = ?
      `).bind(image.id).all();

      // Format variants as object
      const availableUrls = {};
      variants.results.forEach(variant => {
        availableUrls[variant.variant_name] = variant.url;
      });

      return {
        id: image.image_id,
        file_name: image.file_name,
        description: image.description,
        mime_type: image.mime_type,
        size_in_bytes: image.size_in_bytes,
        created_at: image.created_at,
        availableUrls
      };
    } catch (error) {
      console.error('Database error getting image:', error);
      throw error;
    }
  }

  /**
   * Get all images with pagination and total count
   */
  async getAllImages(limit = 20, offset = 0) {
    try {
      // Get total count
      const countResult = await this.db.prepare(`
        SELECT COUNT(*) as total FROM images
      `).first();

      // Get paginated images
      const images = await this.db.prepare(`
        SELECT * FROM images
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).bind(limit, offset).all();

      return {
        images: images.results,
        total: countResult.total,
        limit,
        offset,
        hasMore: countResult.total > (offset + limit)
      };
    } catch (error) {
      console.error('Database error getting all images:', error);
      throw error;
    }
  }

  /**
   * Delete image and its variants
   */
  async deleteImage(imageId) {
    try {
      const result = await this.db.prepare(`
        DELETE FROM images WHERE image_id = ?
      `).bind(imageId).run();

      return result.success && result.meta.changes > 0;
    } catch (error) {
      console.error('Database error deleting image:', error);
      throw error;
    }
  }
}
