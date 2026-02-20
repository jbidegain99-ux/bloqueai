import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production/staging when DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],

  beforeSend(event) {
    // Scrub sensitive data from event
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }

    if (event.request?.data) {
      const data = typeof event.request.data === 'string'
        ? event.request.data
        : JSON.stringify(event.request.data)

      // Don't send events that contain sensitive patterns
      if (/password|token|secret|cv_content|resume_text/i.test(data)) {
        event.request.data = '[FILTERED]'
      }
    }

    return event
  },
})
