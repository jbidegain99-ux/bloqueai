const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
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

module.exports = withSentryConfig(nextConfig, {
  // Suppress logs during build unless there's an error
  silent: !process.env.CI,

  // Upload source maps to Sentry for production debugging
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Route browser requests to Sentry through a Next.js rewrite to avoid ad-blockers
  tunnelRoute: '/monitoring',

  // Disable source map upload if no auth token (local dev)
  disableSourceMapUpload: !process.env.SENTRY_AUTH_TOKEN,

  // Automatically tree-shake unused Sentry code
  disableLogger: true,

  // Hide source maps from clients in production
  hideSourceMaps: true,
})
