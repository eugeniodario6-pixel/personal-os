import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow build to complete even with minor type issues
  typescript: {
    ignoreBuildErrors: false,
  },
  // No external image domains needed
  images: {
    unoptimized: true,
  },
  // Headers for PWA
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
