/**
 * Cloudflare Images API wrapper
 */
export class CloudflareImages {
  constructor(accountId, apiToken) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.baseURL = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images`;
  }

  /**
   * Create a direct upload URL for presigned uploads
   * @returns {Promise<{uploadURL: string, id: string}>}
   */
  async createDirectUpload() {
    console.info('Calling CF Images direct_upload API...');

    const requestBody = {
      requireSignedURLs: false,
      metadata: {
        source: 'sanafi-image-api'
      }
    };

    console.info('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${this.baseURL}/v2/direct_upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.info('Response status:', response.status);
    console.info('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Direct upload error:', errorText);
      throw new Error(`Failed to create direct upload: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.info('Response data:', data);

    if (!data.success) {
      console.error('CF Images API error:', data);
      throw new Error('Cloudflare Images API returned error');
    }

    return {
      uploadURL: data.result.uploadURL,
      id: data.result.id
    };
  }

  /**
   * Upload an image directly to Cloudflare Images
   * @param {File} file - The file to upload
   * @param {string} filename - The filename to use
   * @returns {Promise<{id: string, variants: string[]}>}
   */
  async uploadImage(file, filename) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('requireSignedURLs', 'false');
    formData.append(
      'metadata',
      JSON.stringify({
        source: 'sanafi-image-api',
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        customFilename: filename
      })
    );

    const response = await fetch(`${this.baseURL}/v1`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload error:', errorText);
      throw new Error(`Failed to upload image: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      console.error('CF Images API error:', data);
      throw new Error('Cloudflare Images API returned error');
    }

    return {
      id: data.result.id,
      variants: data.result.variants || []
    };
  }

  /**
   * Delete an image from Cloudflare Images
   * @param {string} imageId - The image ID to delete
   * @returns {Promise<boolean>}
   */
  async deleteImage(imageId) {
    const response = await fetch(`${this.baseURL}/v1/${imageId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.apiToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Delete error:', errorText);
      throw new Error(`Failed to delete image: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.success;
  }

  /**
   * Get image details
   * @param {string} imageId - The image ID
   * @returns {Promise<Object>}
   */
  async getImageDetails(imageId) {
    const response = await fetch(`${this.baseURL}/v1/${imageId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Get image details error:', errorText);
      throw new Error(`Failed to get image details: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      console.error('CF Images API error:', data);
      throw new Error('Cloudflare Images API returned error');
    }

    return data.result;
  }
}
