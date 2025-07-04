-- SQLite schema for Sanafi Image API
-- Database: sanafi-general

-- Create the images table
CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique identifier for the image
    image_id TEXT NOT NULL UNIQUE,         -- Cloudflare Images ID (unique)
    file_name TEXT,                        -- Original or custom file name
    description TEXT,                      -- Optional description for the image
    mime_type TEXT,                        -- MIME type of the image (e.g., image/jpeg)
    size_in_bytes INTEGER,                 -- Size of the image in bytes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- Timestamp of when the image was uploaded
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- Timestamp of the last update
);

-- Create the image_variants table
CREATE TABLE IF NOT EXISTS image_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique identifier for the variant
    image_id INTEGER NOT NULL,             -- Foreign key linking to the images table
    variant_name TEXT NOT NULL,            -- Name of the variant (e.g., thumbnail, medium)
    url TEXT NOT NULL,                     -- URL for accessing the variant
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- Timestamp of when the variant was created
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- Timestamp of the last update
    FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_images_image_id ON images (image_id);
CREATE INDEX IF NOT EXISTS idx_image_variants_image_id ON image_variants (image_id);
CREATE INDEX IF NOT EXISTS idx_image_variants_variant_name ON image_variants (variant_name);
