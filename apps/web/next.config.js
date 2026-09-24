/** @type {import('next').NextConfig} */
const nextConfig = {
  // For Cloudflare Pages "Upload and deploy" method, we need static export
  // This will generate out/ folder with pure static HTML/CSS/JS
  output: 'export',
  distDir: 'out',
  
  reactStrictMode: true,
  transpilePackages: ['@novelist/shared', '@novelist/ai-core'],
  images: {
    unoptimized: true, // Required for static export - no Next.js image optimization server
    remotePatterns: [
      { hostname: '**' }
    ]
  },
  experimental: {
    typedRoutes: true
  },
  // Disable features that don't work with static export
  trailingSlash: true, // Helps with Cloudflare Pages routing
  skipTrailingSlashRedirect: true
};

export default nextConfig;
