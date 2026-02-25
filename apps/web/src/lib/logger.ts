import pino from 'pino'
import * as Sentry from '@sentry/nextjs'

const isServer = typeof window === 'undefined'
const isDev = process.env.NODE_ENV === 'development'

/**
 * Structured logger for TalentOS frontend.
 * Integrates with Sentry: errors auto-captured, info/warn added as breadcrumbs.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info({ requestId, path: '/api/foo' }, 'Request received')
 *   logger.error({ err, userId }, 'Failed to fetch candidate')
 *
 * Child loggers for module context:
 *   const log = logger.child({ module: 'auth' })
 *   log.info('User logged in')
 */

function createLogger(): pino.Logger {
  const level = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info')

  const hooks: pino.LoggerOptions['hooks'] = {
    logMethod(inputArgs, method, logLevel) {
      // Sentry integration: capture errors and add breadcrumbs
      const sentryLevel = logLevel >= 50 ? 'error'
        : logLevel >= 40 ? 'warning'
        : 'info'

      if (logLevel >= 50) {
        // Error level: capture to Sentry
        const errObj = typeof inputArgs[0] === 'object' && inputArgs[0] !== null
          ? (inputArgs[0] as Record<string, unknown>).err
          : undefined

        if (errObj instanceof Error) {
          Sentry.captureException(errObj, {
            extra: typeof inputArgs[0] === 'object' ? inputArgs[0] as Record<string, unknown> : undefined,
          })
        } else {
          const message = typeof inputArgs[0] === 'string'
            ? inputArgs[0]
            : typeof inputArgs[1] === 'string'
              ? inputArgs[1]
              : 'Unknown error'
          Sentry.captureMessage(message, sentryLevel)
        }
      } else if (logLevel >= 30) {
        // Info/Warn: add as Sentry breadcrumb
        const message = typeof inputArgs[0] === 'string'
          ? inputArgs[0]
          : typeof inputArgs[1] === 'string'
            ? inputArgs[1]
            : ''
        Sentry.addBreadcrumb({
          message,
          level: sentryLevel,
          data: typeof inputArgs[0] === 'object' ? inputArgs[0] as Record<string, unknown> : undefined,
        })
      }

      method.apply(this, inputArgs)
    },
  }

  if (!isServer) {
    // Browser: pino works with default browser destination
    return pino({ level, browser: { asObject: true }, hooks })
  }

  // Server: JSON structured logs (Vercel reads JSON natively)
  const transport = isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined

  return pino({
    level,
    ...(transport ? { transport } : {}),
    hooks,
    formatters: {
      level(label: string) {
        return { level: label }
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      env: process.env.NODE_ENV,
      service: 'talentos-web',
    },
  })
}

export const logger = createLogger()
