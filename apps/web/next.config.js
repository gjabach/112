/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@novelist/shared', '@novelist/ai-core'],
  images: {
    unoptimized: true,
    remotePatterns: [
      { hostname: '**' }
    ]
  },
  experimental: {
    typedRoutes: false
  },
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
