import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@odalyan/shared'],
  // Sortie autonome pour l'image Docker de production (serveur Node minimal).
  output: 'standalone',
  // Racine du monorepo pour le tracing des fichiers (pnpm workspace).
  outputFileTracingRoot: join(__dirname, '../../'),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
