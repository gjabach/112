#!/bin/bash
set -e

echo "🚀 Building Novelist Studio for Cloudflare Pages Upload..."
echo ""

# Check if we're in root
if [ ! -f "package.json" ]; then
  echo "❌ Please run from root novelist-app folder"
  exit 1
fi

cd apps/web

# Check env
if [ ! -f .env.local ]; then
  echo "⚠️  .env.local not found, creating from example..."
  if [ -f .env.example ]; then
    cp .env.example .env.local
  else
    echo "NEXT_PUBLIC_API_URL=https://novelist-api.your-subdomain.workers.dev" > .env.local
  fi
  echo "📝 Created .env.local - PLEASE EDIT with your real API URL!"
  cat .env.local
  echo ""
  read -p "Press Enter to continue or Ctrl+C to edit .env.local first..."
fi

echo "📡 API URL: $(cat .env.local)"
echo ""

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  echo "⚠️  pnpm not found, installing..."
  npm install -g pnpm
fi

# Install deps
echo "📦 Installing dependencies..."
pnpm install

# Build
echo ""
echo "🔨 Building static export (output: out/)..."
pnpm build

echo ""
echo "✅ Build done!"
echo ""

# Check output
if [ ! -d "out" ]; then
  echo "❌ out/ folder not found! Build failed?"
  echo "Check apps/web/next.config.js has output: 'export'"
  exit 1
fi

echo "📦 Files to upload (DO NOT include wrangler.toml):"
ls -lh out/ | head -30
echo ""

OUT_SIZE=$(du -sh out/ | cut -f1)
OUT_FILES=$(find out/ -type f | wc -l)

echo "📊 Total: $OUT_FILES files, $OUT_SIZE"
echo ""

# Check for forbidden files
if [ -f "out/wrangler.toml" ]; then
  echo "❌ ERROR: out/ contains wrangler.toml! This should not happen."
  echo "Please check your build - you should NOT copy wrangler.toml to out/"
  exit 1
fi

echo "✅ out/ looks good - no wrangler.toml inside"
echo ""

# Create zip
echo "📦 Creating zip for upload..."
cd out
zip -r ../../novelist-frontend.zip . -x "*.map" -q
cd ../..

ZIP_SIZE=$(du -sh novelist-frontend.zip | cut -f1)

echo "✅ Created novelist-frontend.zip ($ZIP_SIZE)"
echo ""

echo "🎉 Ready to deploy!"
echo ""
echo "Next steps for Cloudflare Pages Upload and deploy:"
echo "1. Go to https://dash.cloudflare.com > Workers & Pages > Create > Pages > Upload assets"
echo "2. Project name: novelist-web"
echo "3. Upload either:"
echo "   - novelist-frontend.zip (drag & drop the zip file)"
echo "   - OR all files INSIDE apps/web/out/ folder (not the out folder itself)"
echo "4. Click Deploy site"
echo "5. After deploy, update Workers FRONTEND_URL secret:"
echo "   cd ../api && wrangler secret put FRONTEND_URL"
echo "   Enter your Pages URL: https://novelist-web-xyz.pages.dev"
echo "   wrangler deploy"
echo ""
echo "⚠️  IMPORTANT: Do NOT upload wrangler.toml, package.json, src/, node_modules"
echo "    Only upload contents of out/ folder!"
echo ""
echo "Files ready:"
echo "  - apps/web/out/ (folder)"
echo "  - novelist-frontend.zip (zip file at root)"
