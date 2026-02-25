'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore, isCandidate, isEmployer, isRecruiter, isAdmin } from '@/lib/auth'
import { adminApi, applicationsApi } from '@/lib/api'
import { AppShell } from '@/components/brand/AppShell'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/ui/metric-card'
import { DataTable } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { PipelineFunnel } from '@/components/dashboard/pipeline-funnel'
import type { PipelineStage } from '@/components/dashboard/pipeline-funnel'
import type { DataTableColumn } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  FileText,
  MessageSquare,
  Briefcase,
  Users,
  Search,
  Plus,
  CalendarDays,
  Target,
  TrendingUp,
  Clock,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────

interface DashboardMetrics {
  total_applications: number
  above_threshold: number
  interviews_started: number
  interviews_completed: number
  shortlisted: number
  avg_match_score: number | null
  avg_interview_score: number | null
}

interface RecentCandidate {
  id: string
  full_name: string
  email: string
  status: string
  match_score: number | null
  job_title: string
  applied_at: string
}

interface UpcomingInterview {
  id: string
  candidate_name: string
  job_title: string
  status: string
  started_at: string | null
  score: number | null
}

// ── Candidate Application type ────────────────────────────

interface CandidateApplication {
  id: string
  status: string
  match_score: number | null
  job_title: string
  created_at: string
}

const APP_STATUS_BADGE: Record<string, 'success' | 'warning' | 'outline' | 'destructive' | 'secondary'> = {
  MATCH_PASSED: 'success',
  INTERVIEW_COMPLETED: 'success',
  COMPLETED: 'success',
  ANALYZING: 'warning',
  INTERVIEW_STARTED: 'warning',
  CV_UPLOADED: 'outline',
  CREATED: 'outline',
  BELOW_THRESHOLD: 'destructive',
  WITHDRAWN: 'secondary',
}

const APP_STATUS_LABEL: Record<string, string> = {
  MATCH_PASSED: 'Match',
  INTERVIEW_COMPLETED: 'Entrevista OK',
  COMPLETED: 'Completado',
  ANALYZING: 'Analizando',
  INTERVIEW_STARTED: 'En entrevista',
  CV_UPLOADED: 'CV subido',
  CREATED: 'Creado',
  BELOW_THRESHOLD: 'Bajo umbral',
  WITHDRAWN: 'Retirado',
}

// ── Candidate Dashboard ───────────────────────────────────

function CandidateDashboard({ userName }: { userName: string }) {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const [applications, setApplications] = useState<CandidateApplication[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    applicationsApi.list(accessToken)
      .then((data) => {
        const apps = Array.isArray(data) ? data : []
        setApplications(
          apps.map((a: Record<string, unknown>) => ({
            id: String(a.id ?? ''),
            status: String(a.status ?? ''),
            match_score: typeof a.match_score === 'number' ? a.match_score : null,
            job_title: (a.job as Record<string, unknown>)?.title
              ? String((a.job as Record<string, unknown>).title)
              : 'Sin puesto',
            created_at: String(a.created_at ?? ''),
          }))
        )
      })
      .catch(() => setApplications([]))
      .finally(() => setLoading(false))
  }, [accessToken])

  const totalApps = applications.length
  const inInterview = applications.filter(
    (a) => a.status === 'INTERVIEW_STARTED' || a.status === 'INTERVIEW_COMPLETED'
  ).length
  const matched = applications.filter((a) => a.status === 'MATCH_PASSED').length

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const appColumns: DataTableColumn<CandidateApplication>[] = [
    {
      key: 'job_title',
      header: 'Puesto',
      sortable: true,
      filterable: true,
      render: (val) => <span className="font-medium">{String(val)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (val) => {
        const label = APP_STATUS_LABEL[String(val)] ?? String(val)
        const variant = APP_STATUS_BADGE[String(val)] ?? 'outline'
        return <Badge variant={variant}>{label}</Badge>
      },
    },
    {
      key: 'match_score',
      header: 'Score',
      sortable: true,
      render: (val) => {
        if (val == null) return <span className="text-neutral-400">—</span>
        const score = Number(val)
        const color =
          score >= 80 ? 'text-success-600' : score >= 60 ? 'text-warning-600' : 'text-error-500'
        return <span className={`font-semibold tabular-nums ${color}`}>{score}%</span>
      },
    },
    {
      key: 'created_at',
      header: 'Fecha',
      sortable: true,
      render: (val) => (
        <span className="text-xs text-neutral-500">
          {val
            ? new Date(String(val)).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
              })
            : '—'}
        </span>
      ),
    },
  ]

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-bloque-navy900">
            ¡Hola, {userName.split(' ')[0]}!
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5 capitalize">{today}</p>
        </div>
        <Link href="/candidate/jobs">
          <Button variant="primary">
            <Search className="h-4 w-4 mr-1.5" />
            Explorar Puestos
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricCard
          label="Aplicaciones"
          value={totalApps}
          icon={<FileText className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="En Entrevista"
          value={inInterview}
          icon={<MessageSquare className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="Match Positivo"
          value={matched}
          icon={<Target className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Link href="/candidate/resume">
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-soft transition-all duration-200 hover:shadow-medium hover:border-neutral-300 cursor-pointer group">
            <div className="p-2.5 bg-bloque-gray50 rounded-lg group-hover:bg-brand-50 transition-colors">
              <FileText className="h-5 w-5 text-bloque-navy900" />
            </div>
            <div>
              <p className="text-sm font-semibold text-bloque-navy900">Subir CV</p>
              <p className="text-xs text-neutral-500">Sube tu CV para análisis IA</p>
            </div>
          </div>
        </Link>
        <Link href="/candidate/interview">
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-soft transition-all duration-200 hover:shadow-medium hover:border-neutral-300 cursor-pointer group">
            <div className="p-2.5 bg-bloque-gray50 rounded-lg group-hover:bg-brand-50 transition-colors">
              <MessageSquare className="h-5 w-5 text-bloque-navy900" />
            </div>
            <div>
              <p className="text-sm font-semibold text-bloque-navy900">Entrevista IA</p>
              <p className="text-xs text-neutral-500">Evalúa tus competencias</p>
            </div>
          </div>
        </Link>
        <Link href="/candidate/profile">
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-soft transition-all duration-200 hover:shadow-medium hover:border-neutral-300 cursor-pointer group">
            <div className="p-2.5 bg-bloque-gray50 rounded-lg group-hover:bg-brand-50 transition-colors">
              <Users className="h-5 w-5 text-bloque-navy900" />
            </div>
            <div>
              <p className="text-sm font-semibold text-bloque-navy900">Mi Perfil</p>
              <p className="text-xs text-neutral-500">Revisa tu perfil y scores</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Applications Table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-bloque-navy900">Mis Aplicaciones</h3>
          <Link
            href="/candidate/applications"
            className="text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors"
          >
            Ver todas
          </Link>
        </div>
        <DataTable<CandidateApplication>
          data={applications}
          columns={appColumns}
          keyField="id"
          loading={loading}
          pageSize={5}
          emptyState={
            <EmptyState
              variant="applications"
              title="Sin aplicaciones"
              description="Explora puestos disponibles y aplica a los que te interesen."
              action={{ label: 'Explorar puestos', onClick: () => router.push('/candidate/jobs') }}
            />
          }
        />
      </div>
    </>
  )
}

// ── Employer Dashboard (redirect to dedicated page) ──────

function EmployerDashboardRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/employer/dashboard')
  }, [router])
  return null
}

// ── Admin/Recruiter Dashboard (Premium) ───────────────────

const STATUS_BADGE_MAP: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'> = {
  MATCH_PASSED: 'success',
  INTERVIEW_COMPLETED: 'success',
  SHORTLISTED: 'success',
  ANALYZING: 'warning',
  INTERVIEW_STARTED: 'warning',
  CV_UPLOADED: 'outline',
  BELOW_THRESHOLD: 'destructive',
  REJECTED: 'destructive',
}

const STATUS_LABEL_MAP: Record<string, string> = {
  MATCH_PASSED: 'Match',
  INTERVIEW_COMPLETED: 'Entrevista OK',
  SHORTLISTED: 'Shortlisted',
  ANALYZING: 'Analizando',
  INTERVIEW_STARTED: 'En entrevista',
  CV_UPLOADED: 'CV subido',
  BELOW_THRESHOLD: 'Bajo umbral',
  REJECTED: 'Rechazado',
  CREATED: 'Creado',
  COMPLETED: 'Completada',
  IN_PROGRESS: 'En progreso',
}

function AdminDashboard() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [recentCandidates, setRecentCandidates] = useState<RecentCandidate[]>([])
  const [interviews, setInterviews] = useState<UpcomingInterview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const loadDashboard = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const [metricsData, interviewsData] = await Promise.all([
        adminApi.getDashboardMetrics(accessToken),
        adminApi.getInterviews(accessToken, 'ALL').catch(() => []),
      ])

      setMetrics(metricsData.metrics)

      // Map interviews to our format (take most recent 5)
      const interviewList = Array.isArray(interviewsData) ? interviewsData : []
      setInterviews(
        interviewList.slice(0, 5).map((interview: Record<string, unknown>) => ({
          id: String(interview.id ?? ''),
          candidate_name: String(interview.candidate_name ?? 'Sin nombre'),
          job_title: String(interview.job_title ?? 'Sin puesto'),
          status: String(interview.status ?? ''),
          started_at: interview.started_at ? String(interview.started_at) : null,
          score: typeof interview.overall_score === 'number' ? interview.overall_score : null,
        }))
      )

      // Build recent candidates from applications count
      // We use the metrics data to populate pipeline stages
      // For the candidates table, we'll show a placeholder since there's no direct endpoint
      setRecentCandidates([])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar el dashboard'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Build pipeline stages from metrics
  const pipelineStages: PipelineStage[] = metrics
    ? [
        { key: 'applied', label: 'Aplicados', count: metrics.total_applications, color: 'from-brand-400 to-brand-500' },
        { key: 'screening', label: 'Sobre Umbral', count: metrics.above_threshold, color: 'from-info-400 to-info-500' },
        { key: 'interview', label: 'Entrevistados', count: metrics.interviews_started, color: 'from-warning-500 to-warning-600' },
        { key: 'completed', label: 'Completados', count: metrics.interviews_completed, color: 'from-success-500 to-success-600' },
        { key: 'shortlisted', label: 'Shortlisted', count: metrics.shortlisted, color: 'from-success-600 to-success-700' },
      ]
    : []

  // Conversion rate
  const conversionRate =
    metrics && metrics.total_applications > 0
      ? (metrics.shortlisted / metrics.total_applications) * 100
      : 0

  const interviewColumns: DataTableColumn<UpcomingInterview>[] = [
    {
      key: 'candidate_name',
      header: 'Candidato',
      sortable: true,
      filterable: true,
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px]">
              {row.candidate_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-sm">{row.candidate_name}</span>
        </div>
      ),
    },
    { key: 'job_title', header: 'Puesto', sortable: true },
    {
      key: 'status',
      header: 'Estado',
      render: (val) => {
        const label = STATUS_LABEL_MAP[String(val)] ?? String(val)
        const variant = STATUS_BADGE_MAP[String(val)] ?? 'outline'
        return <Badge variant={variant}>{label}</Badge>
      },
    },
    {
      key: 'score',
      header: 'Score',
      sortable: true,
      render: (val) => {
        if (val == null) return <span className="text-neutral-400">—</span>
        const score = Number(val)
        const color =
          score >= 4 ? 'text-success-600' : score >= 3 ? 'text-warning-600' : 'text-error-500'
        return <span className={`font-semibold tabular-nums ${color}`}>{score.toFixed(1)}</span>
      },
    },
  ]

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-bloque-navy900">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-0.5 capitalize">{today}</p>
        </div>
        <Link href="/employer/jobs/new">
          <Button variant="primary">
            <Plus className="h-4 w-4 mr-1.5" />
            Nueva Vacante
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Candidatos Activos"
          value={metrics?.total_applications ?? 0}
          previousValue={Math.round((metrics?.total_applications ?? 0) * 0.85)}
          trend={[45, 52, 49, 67, 72, 89, metrics?.total_applications ?? 0]}
          icon={<Users className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="Vacantes Abiertas"
          value={metrics?.above_threshold ?? 0}
          previousValue={Math.round((metrics?.above_threshold ?? 0) * 0.9)}
          trend={[12, 15, 14, 18, 20, metrics?.above_threshold ?? 0]}
          icon={<Briefcase className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="Entrevistas"
          value={metrics?.interviews_completed ?? 0}
          previousValue={metrics?.interviews_started ?? 0}
          trend={[5, 8, 12, 15, metrics?.interviews_completed ?? 0]}
          icon={<MessageSquare className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="Tasa de Conversión"
          value={conversionRate}
          previousValue={conversionRate > 0 ? conversionRate * 0.8 : 0}
          trend={[2, 3.5, 4, 5, conversionRate]}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={loading}
          format={(v) => `${v.toFixed(1)}%`}
        />
      </div>

      {/* Pipeline Funnel */}
      <div className="mb-6">
        <PipelineFunnel
          stages={pipelineStages}
          loading={loading}
          onStageClick={(key) => router.push(`/admin/dashboard?stage=${key}`)}
        />
      </div>

      {/* Bottom section: Recent Interviews + Upcoming */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Recent Interviews Table */}
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-bloque-navy900">
              Entrevistas Recientes
            </h3>
            <Link
              href="/admin/interviews"
              className="text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors"
            >
              Ver todas
            </Link>
          </div>
          <DataTable<UpcomingInterview>
            data={interviews}
            columns={interviewColumns}
            keyField="id"
            loading={loading}
            error={error ?? undefined}
            onRetry={loadDashboard}
            pageSize={5}
            emptyState={
              <EmptyState
                variant="interviews"
                title="Sin entrevistas aún"
                description="Las entrevistas aparecerán aquí cuando los candidatos completen el proceso."
              />
            }
            actions={[
              {
                label: 'Ver detalle',
                onClick: (row) => router.push(`/admin/interviews?id=${row.id}`),
              },
            ]}
          />
        </div>

        {/* Upcoming Interviews Sidebar */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-bloque-navy900">
              Próximas Entrevistas
            </h3>
            <Link
              href="/admin/interviews"
              className="text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors"
            >
              Ver calendario
            </Link>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white shadow-soft">
            {loading ? (
              <div className="p-4 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%] animate-shimmer" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-28 rounded bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%] animate-shimmer" />
                      <div className="h-3 w-20 rounded bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%] animate-shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            ) : interviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <CalendarDays className="h-8 w-8 text-neutral-300 mb-2" />
                <p className="text-xs text-neutral-500">Sin entrevistas programadas</p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {interviews.slice(0, 5).map((interview) => (
                  <li
                    key={interview.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-bloque-gray50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/interviews?id=${interview.id}`)}
                  >
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarFallback className="text-[10px]">
                        {interview.candidate_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-bloque-navy900 truncate">
                        {interview.candidate_name}
                      </p>
                      <p className="text-xs text-neutral-500 truncate">
                        {interview.job_title}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <Badge
                        variant={STATUS_BADGE_MAP[interview.status] ?? 'outline'}
                        className="text-[10px]"
                      >
                        {STATUS_LABEL_MAP[interview.status] ?? interview.status}
                      </Badge>
                      {interview.started_at && (
                        <p className="text-[10px] text-neutral-400 mt-0.5 flex items-center justify-end gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(interview.started_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quality Scores */}
          {metrics && (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-soft">
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                Scores Promedio
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-neutral-600 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-success-500" />
                      Match Score
                    </span>
                    <span className="text-xs font-bold text-bloque-navy900 tabular-nums">
                      {metrics.avg_match_score?.toFixed(1) ?? '—'}/100
                    </span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success-500 rounded-full transition-all duration-700"
                      style={{ width: `${metrics.avg_match_score ?? 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-neutral-600 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-brand-500" />
                      Interview Score
                    </span>
                    <span className="text-xs font-bold text-bloque-navy900 tabular-nums">
                      {metrics.avg_interview_score?.toFixed(1) ?? '—'}/100
                    </span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-700"
                      style={{ width: `${metrics.avg_interview_score ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, isHydrated } = useAuthStore()

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, router])

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <AppShell>
      {isCandidate() && <CandidateDashboard userName={user.full_name} />}
      {isEmployer() && !isRecruiter() && !isAdmin() && <EmployerDashboardRedirect />}
      {(isRecruiter() || isAdmin()) && <AdminDashboard />}
    </AppShell>
  )
}
