/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove standalone for Vercel (it handles this automatically)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_APP_NAME: 'TalentOS by Bloque',
  },
}

module.exports = nextConfig
