/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverExternalPackages: ['better-sqlite3'],
  },
};
export default nextConfig;
