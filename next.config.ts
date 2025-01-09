import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tahzloutgztrjefnzelo.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/chat-files/**',
      },
    ],
  },
}

export default nextConfig