import { NextResponse } from 'next/server'

interface BackendHealth {
  status: string
  timestamp: string
  version: string
  services: Record<string, { status: string; latency_ms?: number; message?: string }>
}

interface HealthResponse {
  status: string
  timestamp: string
  frontend: {
    status: string
    version: string
  }
  backend: BackendHealth | { status: string; error: string }
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const timestamp = new Date().toISOString()

  let backend: HealthResponse['backend']
  try {
    const res = await fetch(`${apiUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    backend = (await res.json()) as BackendHealth
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    backend = { status: 'unreachable', error: message }
  }

  const backendHealthy = 'services' in backend && backend.status === 'healthy'
  const overall = backendHealthy ? 'healthy' : 'degraded'

  return NextResponse.json({
    status: overall,
    timestamp,
    frontend: {
      status: 'healthy',
      version: '1.0.0',
    },
    backend,
  })
}
