#!/bin/bash

# WhatsApp AI Agent Dashboard Setup Script

echo "🚀 Setting up WhatsApp AI Agent Dashboard..."
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
  echo "📝 Creating .env.local from .env.example..."
  cp .env.example .env.local
fi

echo ""
echo "✅ Dashboard setup complete!"
echo ""
echo "To start the dashboard:"
echo "  npm run dev     # Development mode on port 3004"
echo "  npm run build   # Production build"
echo "  npm start       # Production mode on port 3004"
echo ""
echo "Dashboard will be available at: http://localhost:3004"
echo ""
