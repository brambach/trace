import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  serverExternalPackages: ['better-sqlite3'],
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  // Migrations are read from disk at runtime, so the tracer can't see them.
  outputFileTracingIncludes: { '/**': ['../../packages/db/src/migrations/*.sql'] },
  transpilePackages: ['@trace/coach', '@trace/db', '@trace/demo', '@trace/ingest', '@trace/parser', '@trace/shared'],
  webpack(config, { isServer }) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    if (isServer) {
      const externals = Array.isArray(config.externals) ? config.externals : [];
      externals.push({ 'better-sqlite3': 'commonjs better-sqlite3' });
      config.externals = externals;
    }
    return config;
  },
};
export default nextConfig;
