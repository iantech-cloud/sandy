import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',

  serverExternalPackages: [
    'mongoose',
    'mongodb',
    'bcryptjs',
    'speakeasy',
    'nodemailer',
    '@auth/mongodb-adapter',
  ],

  experimental: {
    // optimizeCss disabled - causes CSS 404 errors in development
    // optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'react-icons'],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  compress: true,
  poweredByHeader: false,

  async headers() {
    return [
      // API routes - short cache with SWR
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      // HTML pages - no-cache
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          // Prevent persistent cookies
          { key: 'Set-Cookie', value: 'Path=/; SameSite=Lax; HttpOnly; Max-Age=0' },
        ],
      },
      // Static assets - can be cached longer
      {
        source: '/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Images - cache for a reasonable time
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        stream: false,
        crypto: false,
        tls: false,
        net: false,
        dns: false,
        child_process: false,
        http2: false,
        perf_hooks: false,
      };
    }

    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        {
          kerberos: 'commonjs kerberos',
          '@mongodb-js/zstd': 'commonjs @mongodb-js/zstd',
          snappy: 'commonjs snappy',
          aws4: 'commonjs aws4',
          'mongodb-client-encryption': 'commonjs mongodb-client-encryption',
          '@aws-sdk/credential-providers': 'commonjs @aws-sdk/credential-providers',
        },
      ];
    }

    return config;
  },
};

export default nextConfig;

