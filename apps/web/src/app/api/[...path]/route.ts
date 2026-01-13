import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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
      // For form data, we need to pass the request body as-is
      body = await request.blob()
      // Remove content-type header to let fetch set it with boundary
      headers.delete('Content-Type')
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

  try {
    const response = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
    })

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

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Proxy error:', error)
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
