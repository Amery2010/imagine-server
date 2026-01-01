#!/bin/bash

# Imagine Server - Quick Setup Script

set -e

echo "🚀 Setting up Imagine Server..."
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file and add your API tokens"
else
    echo "✅ .env file already exists"
fi

# Type check
echo "🔍 Running type check..."
pnpm run type-check

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your API tokens"
echo "2. Run 'pnpm run dev' to start development server"
echo "3. Visit http://localhost:3000/api/health to verify"
echo ""
echo "For deployment:"
echo "- Vercel: pnpm run vercel:deploy"
echo "- Cloudflare Workers: pnpm run wrangler:deploy"
echo ""
