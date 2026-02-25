'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Video,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth'
import { listVideoInterviews, type VideoInterviewItem } from '@/lib/livekit'

function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return ''

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMs < 0) {
    // Future date
    const absMins = Math.abs(diffMins)
    const absHours = Math.abs(diffHours)
    const absDays = Math.abs(diffDays)

    if (absMins < 60) return `en ${absMins} min`
    if (absHours < 24) return `en ${absHours} h`
    if (absDays < 7) return `en ${absDays} dias`
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (diffMins < 1) return 'ahora'
  if (diffMins < 60) return `hace ${diffMins} min`
  if (diffHours < 24) return `hace ${diffHours} h`
  if (diffDays < 7) return `hace ${diffDays} dias`
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  })
}

const statusConfig: Record<
  string,
  { color: string; icon: typeof Video; text: string }
> = {
  SCHEDULED: {
    color: 'bg-blue-100 text-blue-700',
    icon: Calendar,
    text: 'Programada',
  },
  READY: {
    color: 'bg-yellow-100 text-yellow-700',
    icon: Clock,
    text: 'Lista',
  },
  IN_PROGRESS: {
    color: 'bg-green-100 text-green-700',
    icon: Video,
    text: 'En progreso',
  },
  COMPLETED: {
    color: 'bg-gray-100 text-gray-700',
    icon: CheckCircle,
    text: 'Completada',
  },
  CANCELLED: {
    color: 'bg-red-100 text-red-700',
    icon: AlertCircle,
    text: 'Cancelada',
  },
  ERROR: {
    color: 'bg-red-100 text-red-700',
    icon: AlertCircle,
    text: 'Error',
  },
}

export default function CandidateInterviewsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [interviews, setInterviews] = useState<VideoInterviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Auth guard
  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated || !accessToken) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, accessToken, router])

  const fetchInterviews = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true)
      setError(null)
      const data = await listVideoInterviews(accessToken)
      setInterviews(data.items || [])
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar entrevistas'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (isHydrated && accessToken) {
      fetchInterviews()
    }
  }, [isHydrated, accessToken, fetchInterviews])

  if (!isHydrated || !isAuthenticated) {
    return null
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-72 bg-gray-100 rounded animate-pulse mt-2" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bloque-navy900">
            Mis Entrevistas de Video
          </h1>
          <p className="text-gray-600 mt-1">
            Entrevistas de video programadas y completadas
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchInterviews}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={fetchInterviews}
              className="text-sm text-red-600 underline mt-1 hover:text-red-800"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {interviews.length === 0 && !error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes entrevistas de video programadas
            </h3>
            <p className="text-gray-500 mb-4">
              Cuando un empleador te invite a una entrevista de video, aparecera
              aqui.
            </p>
            <Link href="/candidate/jobs">
              <Button>Explorar trabajos</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {interviews.map((interview, index) => {
            const config = statusConfig[interview.status] || statusConfig.SCHEDULED
            const StatusIcon = config.icon

            return (
              <motion.div
                key={interview.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-base truncate">
                            Entrevista #{interview.id.slice(0, 8)}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {config.text}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          Sala: {interview.room_name}
                        </p>
                        <p className="text-sm text-gray-400 mt-0.5">
                          {interview.scheduled_at
                            ? formatRelativeDate(interview.scheduled_at)
                            : interview.created_at
                              ? `Creada ${formatRelativeDate(interview.created_at)}`
                              : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {interview.status === 'COMPLETED' ? (
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Finalizada
                          </span>
                        ) : interview.status === 'SCHEDULED' ||
                          interview.status === 'READY' ||
                          interview.status === 'IN_PROGRESS' ? (
                          <Link href={`/candidate/interviews/${interview.id}`}>
                            <Button size="sm">
                              <Video className="w-4 h-4 mr-2" />
                              {interview.status === 'IN_PROGRESS'
                                ? 'Continuar'
                                : 'Unirse'}
                            </Button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
