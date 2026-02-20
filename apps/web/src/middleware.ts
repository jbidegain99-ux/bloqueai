import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js middleware for structured request logging.
 * Runs on Edge runtime — no Node.js-only APIs.
 * Adds X-Request-ID header and logs method, path, duration.
 */
export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const start = Date.now()

  const response = NextResponse.next()
  response.headers.set('X-Request-ID', requestId)

  const duration = Date.now() - start
  const logEntry = {
    level: 'info',
    timestamp: new Date().toISOString(),
    service: 'talentos-web',
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get('user-agent') ?? undefined,
    duration_ms: duration,
  }

  // Edge runtime: use console.log with structured JSON
  // Vercel parses JSON log lines automatically
  console.log(JSON.stringify(logEntry))

  return response
}

export const config = {
  matcher: [
    // Match all routes except static files, images, and internal Next.js routes
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
