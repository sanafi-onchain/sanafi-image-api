-- Migration to add description field to existing images table
-- Run this if you already have the images table without the description field

ALTER TABLE images ADD COLUMN description TEXT;
