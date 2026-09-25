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
};

export default nextConfig;
