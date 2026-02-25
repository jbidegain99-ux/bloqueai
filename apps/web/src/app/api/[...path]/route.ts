import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Vercel Serverless Function configuration
// Increase max duration for file uploads and AI analysis
export const maxDuration = 60 // seconds (Pro plan allows up to 300)
export const dynamic = 'force-dynamic'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Timeout for API requests (90 seconds for file uploads and analysis)
const API_TIMEOUT_MS = 90000

const log = logger.child({ module: 'api-proxy' })

async function proxyRequest(request: NextRequest, path: string[]) {
  const url = new URL(`${API_URL}/${path.join('/')}`)

  // Copy query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value)
  })

  const headers = new Headers()

  // Copy relevant headers
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    headers.set('Authorization', authHeader)
  }

  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers.set('Content-Type', contentType)
  }

  // Get request body if present
  let body: BodyInit | null = null
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // Check if it's form data (for file uploads)
    if (contentType?.includes('multipart/form-data')) {
      // For multipart/form-data, pass the raw body with original Content-Type
      // The Content-Type header includes the boundary which is REQUIRED
      // Do NOT delete the Content-Type header - it breaks the multipart boundary
      body = await request.arrayBuffer()
    } else {
      try {
        body = await request.text()
        if (body) {
          headers.set('Content-Type', 'application/json')
        }
      } catch {
        body = null
      }
    }
  }

  const start = Date.now()
  const targetPath = path.join('/')

  try {
    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    const response = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Get response body
    const responseBody = await response.text()

    // Create response with same status and headers
    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
      // Skip headers that cause issues
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    })

    const duration_ms = Date.now() - start
    log.info(
      { method: request.method, path: targetPath, status: response.status, duration_ms },
      'Proxy request completed'
    )

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    const duration_ms = Date.now() - start

    if (error instanceof Error && error.name === 'AbortError') {
      log.warn(
        { method: request.method, path: targetPath, duration_ms },
        'Proxy request timed out'
      )
      return NextResponse.json(
        { detail: 'La solicitud tardó demasiado. Intenta de nuevo.' },
        { status: 504 }
      )
    }

    log.error(
      { err: error, method: request.method, path: targetPath, duration_ms },
      'Proxy request failed'
    )

    return NextResponse.json(
      { detail: 'Error connecting to API server' },
      { status: 502 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, path)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, path)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, path)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, path)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, path)
}
