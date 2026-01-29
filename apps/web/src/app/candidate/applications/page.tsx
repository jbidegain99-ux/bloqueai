'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { applicationsApi } from '@/lib/api'
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
  Upload,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react'

interface Application {
  id: string
  candidate_id: string
  job_id: string
  status: string
  match_score: number | null
  resume_filename: string | null
  interview_session_id: string | null
  job: {
    id: string
    title: string
    company: { id: string; name: string }
    location: string | null
    modality: string | null
  } | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  CREATED: {
    label: 'CV pendiente',
    color: 'bg-gray-100 text-gray-700',
    icon: <Upload className="h-3.5 w-3.5" />,
  },
  CV_UPLOADED: {
    label: 'CV subido',
    color: 'bg-blue-100 text-blue-700',
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  ANALYZING: {
    label: 'Analizando',
    color: 'bg-yellow-100 text-yellow-700',
    icon: <Sparkles className="h-3.5 w-3.5 animate-pulse" />,
  },
  MATCH_PASSED: {
    label: 'Match aceptado',
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  MATCH_BELOW_THRESHOLD: {
    label: 'Match bajo',
    color: 'bg-amber-100 text-amber-700',
    icon: <Target className="h-3.5 w-3.5" />,
  },
  INTERVIEW_STARTED: {
    label: 'En entrevista',
    color: 'bg-purple-100 text-purple-700',
    icon: <PlayCircle className="h-3.5 w-3.5" />,
  },
  INTERVIEW_COMPLETED: {
    label: 'Entrevista completada',
    color: 'bg-indigo-100 text-indigo-700',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  COMPLETED: {
    label: 'Completada',
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  WITHDRAWN: {
    label: 'Retirada',
    color: 'bg-gray-100 text-gray-500',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  REJECTED: {
    label: 'Rechazada',
    color: 'bg-red-100 text-red-700',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getActionLabel(status: string): string {
  switch (status) {
    case 'CREATED':
      return 'Subir CV'
    case 'CV_UPLOADED':
      return 'Analizar CV'
    case 'MATCH_PASSED':
      return 'Iniciar entrevista'
    case 'INTERVIEW_STARTED':
      return 'Continuar entrevista'
    case 'MATCH_BELOW_THRESHOLD':
      return 'Ver recomendaciones'
    default:
      return 'Ver detalles'
  }
}

export default function ApplicationsPage() {
  const router = useRouter()
  const { isAuthenticated, accessToken } = useAuthStore()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState<string | null>(null)

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
        const apps = await applicationsApi.list(accessToken)
        setApplications(apps)
      } catch (err: any) {
        console.error('Error loading applications:', err)
        setError(err?.message || 'Error al cargar las aplicaciones')
      } finally {
        setLoading(false)
      }
    }

    loadApplications()
  }, [accessToken])

  const handleAction = (app: Application) => {
    // If interview is in progress and we have a session ID, go directly to interview
    if (app.status === 'INTERVIEW_STARTED' && app.interview_session_id) {
      router.push(`/candidate/interview/${app.interview_session_id}`)
      return
    }

    // Otherwise, navigate to the apply page for this job
    router.push(`/candidate/apply/${app.job_id}`)
  }

  const handleWithdraw = async (applicationId: string) => {
    if (!accessToken) return

    setWithdrawing(applicationId)
    try {
      await applicationsApi.withdraw(accessToken, applicationId)
      // Update local state
      setApplications(apps =>
        apps.map(app =>
          app.id === applicationId
            ? { ...app, status: 'WITHDRAWN' }
            : app
        )
      )
    } catch (err: any) {
      console.error('Error withdrawing application:', err)
      setError(err?.message || 'Error al retirar la aplicacion')
    } finally {
      setWithdrawing(null)
    }
  }

  if (!isAuthenticated) return null

  const activeApps = applications.filter(a => !['WITHDRAWN', 'REJECTED', 'COMPLETED'].includes(a.status))
  const completedApps = applications.filter(a => ['WITHDRAWN', 'REJECTED', 'COMPLETED'].includes(a.status))

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-bloque-navy900">Mis Aplicaciones</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona tus aplicaciones a puestos de trabajo
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
          <div className="space-y-8">
            {/* Active Applications */}
            {activeApps.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-bloque-navy900 mb-4">
                  Aplicaciones activas ({activeApps.length})
                </h2>
                <div className="space-y-4">
                  {activeApps.map((app) => {
                    const status = STATUS_CONFIG[app.status] || STATUS_CONFIG.CREATED

                    return (
                      <BrandCard key={app.id} className="p-6">
                        <div className="flex gap-4">
                          {/* Icon */}
                          <div className="h-12 w-12 rounded-lg bg-bloque-navy900 flex items-center justify-center text-white flex-shrink-0">
                            {app.job ? (
                              <span className="font-bold text-lg">
                                {app.job.company.name.charAt(0)}
                              </span>
                            ) : (
                              <Briefcase className="h-6 w-6" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="font-semibold text-bloque-navy900">
                                  {app.job?.title || 'Puesto desconocido'}
                                </h3>
                                {app.job && (
                                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                                    <span className="flex items-center gap-1">
                                      <Building2 className="h-3.5 w-3.5" />
                                      {app.job.company.name}
                                    </span>
                                    {app.job.location && (
                                      <span>{app.job.location}</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {app.match_score !== null && (
                                  <Badge
                                    className={
                                      app.match_score >= 70
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }
                                  >
                                    {app.match_score}% match
                                  </Badge>
                                )}
                                <Badge className={status.color}>
                                  {status.icon}
                                  <span className="ml-1">{status.label}</span>
                                </Badge>
                              </div>
                            </div>

                            {/* Meta info */}
                            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Aplicado: {formatDate(app.created_at)}</span>
                              </div>
                              {app.resume_filename && (
                                <div className="flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5" />
                                  <span>{app.resume_filename}</span>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="mt-4 flex gap-2">
                              {app.status !== 'WITHDRAWN' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleAction(app)}
                                >
                                  {getActionLabel(app.status)}
                                  <ArrowRight className="h-4 w-4 ml-1" />
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
                              {!['COMPLETED', 'WITHDRAWN', 'REJECTED'].includes(app.status) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleWithdraw(app.id)}
                                  disabled={withdrawing === app.id}
                                >
                                  {withdrawing === app.id ? (
                                    <Clock className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Retirar
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </BrandCard>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Completed/Withdrawn Applications */}
            {completedApps.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-bloque-navy900 mb-4">
                  Historial ({completedApps.length})
                </h2>
                <div className="space-y-3">
                  {completedApps.map((app) => {
                    const status = STATUS_CONFIG[app.status] || STATUS_CONFIG.COMPLETED

                    return (
                      <BrandCard key={app.id} className="p-4 opacity-75">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 flex-shrink-0">
                            {app.job ? (
                              <span className="font-bold">
                                {app.job.company.name.charAt(0)}
                              </span>
                            ) : (
                              <Briefcase className="h-5 w-5" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-bloque-navy900">
                              {app.job?.title || 'Puesto desconocido'}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {app.job && <span>{app.job.company.name}</span>}
                              <span>•</span>
                              <span>{formatDate(app.created_at)}</span>
                            </div>
                          </div>

                          <Badge className={status.color}>
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </Badge>
                        </div>
                      </BrandCard>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary stats */}
        {!loading && applications.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mt-8">
            <BrandCard className="p-4 text-center">
              <div className="text-2xl font-bold text-bloque-navy900">
                {applications.length}
              </div>
              <div className="text-sm text-muted-foreground">Total</div>
            </BrandCard>
            <BrandCard className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {applications.filter((a) => a.status === 'MATCH_PASSED').length}
              </div>
              <div className="text-sm text-muted-foreground">Match alto</div>
            </BrandCard>
            <BrandCard className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {applications.filter((a) => ['INTERVIEW_STARTED', 'INTERVIEW_COMPLETED'].includes(a.status)).length}
              </div>
              <div className="text-sm text-muted-foreground">En entrevista</div>
            </BrandCard>
            <BrandCard className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">
                {applications.filter((a) => a.status === 'MATCH_BELOW_THRESHOLD').length}
              </div>
              <div className="text-sm text-muted-foreground">Match bajo</div>
            </BrandCard>
          </div>
        )}
      </div>
    </AppShell>
  )
}
