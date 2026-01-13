'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { candidateApi, publicApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import {
  Briefcase,
  Clock,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  ArrowRight,
  FileText,
  Building2,
  Calendar,
  XCircle,
} from 'lucide-react'

interface InterviewSession {
  id: string
  job_id: string | null
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  current_question_index: number
  total_questions: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface Application {
  session: InterviewSession
  job?: {
    id: string
    title: string
    company: {
      name: string
    }
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  IN_PROGRESS: {
    label: 'En progreso',
    color: 'bg-blue-100 text-blue-700',
    icon: <PlayCircle className="h-4 w-4" />,
  },
  COMPLETED: {
    label: 'Completada',
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  CANCELLED: {
    label: 'Cancelada',
    color: 'bg-gray-100 text-gray-700',
    icon: <XCircle className="h-4 w-4" />,
  },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ApplicationsPage() {
  const router = useRouter()
  const { isAuthenticated, accessToken, user } = useAuthStore()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  // Load applications
  useEffect(() => {
    const loadApplications = async () => {
      if (!accessToken) return

      setLoading(true)
      setError(null)

      try {
        // Get all interview sessions
        const sessions = await candidateApi.getInterviews(accessToken) as InterviewSession[]

        // Load job details for each session that has a job_id
        const appsWithJobs: Application[] = await Promise.all(
          sessions.map(async (session) => {
            if (session.job_id) {
              try {
                const job = await publicApi.getJob(session.job_id)
                return { session, job }
              } catch {
                return { session }
              }
            }
            return { session }
          })
        )

        // Sort by created_at desc
        appsWithJobs.sort((a, b) =>
          new Date(b.session.created_at).getTime() - new Date(a.session.created_at).getTime()
        )

        setApplications(appsWithJobs)
      } catch (err: any) {
        console.error('Error loading applications:', err)
        setError(err?.message || 'Error al cargar las aplicaciones')
      } finally {
        setLoading(false)
      }
    }

    loadApplications()
  }, [accessToken])

  const handleContinueInterview = (sessionId: string, jobId?: string) => {
    if (jobId) {
      router.push(`/candidate/interview?job_id=${jobId}`)
    } else {
      router.push('/candidate/interview')
    }
  }

  const handleViewReport = () => {
    router.push('/candidate/profile')
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-bloque-navy900">Mis Aplicaciones</h1>
            <p className="text-muted-foreground mt-1">
              Historial de entrevistas y aplicaciones
            </p>
          </div>
          <Button onClick={() => router.push('/candidate/jobs')}>
            <Briefcase className="h-4 w-4 mr-2" />
            Explorar puestos
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <BrandCard key={i} className="p-6">
                <div className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </BrandCard>
            ))}
          </div>
        ) : applications.length === 0 ? (
          <BrandCard className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No tienes aplicaciones aun</h2>
            <p className="text-muted-foreground mb-6">
              Explora los puestos disponibles y aplica a los que te interesen
            </p>
            <Button onClick={() => router.push('/candidate/jobs')}>
              Ver puestos disponibles
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </BrandCard>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => {
              const status = STATUS_CONFIG[app.session.status]
              const progress = app.session.total_questions > 0
                ? Math.round((app.session.current_question_index / app.session.total_questions) * 100)
                : 0

              return (
                <BrandCard key={app.session.id} className="p-6">
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className="h-12 w-12 rounded-lg bg-bloque-navy900 flex items-center justify-center text-white flex-shrink-0">
                      {app.job ? (
                        <span className="font-bold text-lg">
                          {app.job.company.name.charAt(0)}
                        </span>
                      ) : (
                        <FileText className="h-6 w-6" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-bloque-navy900">
                            {app.job ? app.job.title : 'Entrevista General'}
                          </h3>
                          {app.job && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                              <Building2 className="h-3.5 w-3.5" />
                              <span>{app.job.company.name}</span>
                            </div>
                          )}
                        </div>

                        <Badge className={status.color}>
                          {status.icon}
                          <span className="ml-1">{status.label}</span>
                        </Badge>
                      </div>

                      {/* Progress for in-progress interviews */}
                      {app.session.status === 'IN_PROGRESS' && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Progreso de la entrevista</span>
                            <span>{app.session.current_question_index} / {app.session.total_questions}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-bloque-gold500 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Iniciada: {formatDate(app.session.started_at || app.session.created_at)}</span>
                        </div>
                        {app.session.completed_at && (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            <span>Completada: {formatDate(app.session.completed_at)}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex gap-2">
                        {app.session.status === 'IN_PROGRESS' && (
                          <Button
                            size="sm"
                            onClick={() => handleContinueInterview(app.session.id, app.session.job_id || undefined)}
                          >
                            Continuar entrevista
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        )}
                        {app.session.status === 'COMPLETED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleViewReport}
                          >
                            Ver mi perfil
                          </Button>
                        )}
                        {app.job && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/candidate/jobs/${app.job!.id}`)}
                          >
                            Ver puesto
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </BrandCard>
              )
            })}
          </div>
        )}

        {/* Summary stats */}
        {!loading && applications.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mt-8">
            <BrandCard className="p-4 text-center">
              <div className="text-2xl font-bold text-bloque-navy900">
                {applications.length}
              </div>
              <div className="text-sm text-muted-foreground">Total aplicaciones</div>
            </BrandCard>
            <BrandCard className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {applications.filter((a) => a.session.status === 'COMPLETED').length}
              </div>
              <div className="text-sm text-muted-foreground">Completadas</div>
            </BrandCard>
            <BrandCard className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {applications.filter((a) => a.session.status === 'IN_PROGRESS').length}
              </div>
              <div className="text-sm text-muted-foreground">En progreso</div>
            </BrandCard>
          </div>
        )}
      </div>
    </AppShell>
  )
}
