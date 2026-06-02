/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server output for a small Docker runtime image.
  output: 'standalone',
};

export default nextConfig;
