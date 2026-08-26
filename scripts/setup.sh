#!/bin/bash
set -e

echo "🚀 Setting up Blockbuster Agentic Studio..."

if [ ! -f .env ]; then
  echo "📝 Creating .env from .env.example..."
  cp .env.example .env
fi

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building packages..."
npm run build

echo "🧪 Running tests..."
npm test

echo "✅ Setup complete!"
echo "Run 'npm run dev:orchestration' or 'npm run dev:api' to start."
