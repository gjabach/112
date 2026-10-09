/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@novelist/shared', '@novelist/ai-core'],
  images: {
    unoptimized: true,
    remotePatterns: [{ hostname: '**' }],
  },
};

// Keep production builds from replacing a running preview's compiled files.
export default (phase) => ({
  ...nextConfig,
  distDir: phase === 'phase-development-server' ? '.next-dev' : '.next',
});
