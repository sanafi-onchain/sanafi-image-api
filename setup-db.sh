#!/bin/bash

# Migration script for setting up D1 database schema

echo "🚀 Setting up database schema for sanafi-general..."

# Apply schema to local D1 database (for development)
echo "📝 Applying schema to local database..."
wrangler d1 execute sanafi-general --local --file=./database/schema.sql

# Apply schema to remote D1 database (for production)
echo "📝 Applying schema to remote database..."
wrangler d1 execute sanafi-general --file=./database/schema.sql

echo "✅ Database schema setup complete!"
echo ""
echo "Your D1 database binding is ready:"
echo "- Binding name: DB"
echo "- Database: sanafi-general"
echo "- Tables: images, image_variants"
echo ""
echo "You can now deploy your worker with: wrangler deploy"
