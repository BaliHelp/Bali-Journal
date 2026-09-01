import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ["@xenova/transformers", "onnxruntime-node", "sharp"],
  // Static generation for /category/[category] (and other prerendered
  // pages) queries the DB directly during `next build`. This project's
  // Supabase connection string is pinned to connection_limit=1 (see
  // DATABASE_URL), so Next's default multi-worker static generation
  // (3 workers on a 4-core Vercel build machine, each hitting Prisma
  // independently) fights over that single connection and times out -
  // confirmed via a real failed Vercel build ("Timed out fetching a new
  // connection from the connection pool... connection limit: 1"). Forcing
  // a single build worker serializes those DB calls instead of racing them.
  experimental: {
    cpus: 1,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'image.pollinations.ai',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'gemini.google.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'fal.media',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ibb.co.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'loremflickr.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'loremflickr.co',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
