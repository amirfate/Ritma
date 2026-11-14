import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:3000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiUrl}/:path*` },
      { source: '/tracks/:path*', destination: `${apiUrl}/tracks/:path*` },
    ];
  },
};

export default nextConfig;
