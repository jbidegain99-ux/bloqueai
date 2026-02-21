'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/brand/AppShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MetricCard } from '@/components/ui/metric-card'
import { DataTable } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import type { DataTableColumn } from '@/components/ui/data-table'
import { useAuthStore, isEmployer } from '@/lib/auth'
import { employerApi } from '@/lib/api'
import {
  Briefcase,
  TrendingUp,
  UserCheck,
  Clock,
  Plus,
  ChevronRight,
  ClipboardList,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────

interface JobRow {
  id: string
  title: string
  status: string
  location: string
  shortlist_count: number
  created_at: string
}

const STATUS_BADGE_MAP: Record<string, 'success' | 'outline' | 'warning' | 'secondary' | 'destructive'> = {
  ACTIVE: 'success',
  DRAFT: 'outline',
  PENDING: 'outline',
  PAUSED: 'warning',
  CLOSED: 'secondary',
  INACTIVE: 'destructive',
}

const STATUS_LABEL_MAP: Record<string, string> = {
  ACTIVE: 'Activo',
  DRAFT: 'Borrador',
  PENDING: 'Pendiente',
  PAUSED: 'Pausado',
  CLOSED: 'Cerrado',
  INACTIVE: 'Inactivo',
}

// ── Columns ───────────────────────────────────────────────

const jobColumns: DataTableColumn<JobRow>[] = [
  {
    key: 'title',
    header: 'Vacante',
    sortable: true,
    filterable: true,
    render: (_, row) => (
      <div>
        <p className="font-medium text-bloque-navy900">{row.title}</p>
        <p className="text-xs text-neutral-500">{row.location || 'Sin ubicación'}</p>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Estado',
    sortable: true,
    render: (val) => {
      const label = STATUS_LABEL_MAP[String(val)] ?? String(val)
      const variant = STATUS_BADGE_MAP[String(val)] ?? 'outline'
      return <Badge variant={variant}>{label}</Badge>
    },
  },
  {
    key: 'shortlist_count',
    header: 'Candidatos',
    sortable: true,
    render: (val) => (
      <span className="tabular-nums font-medium">{Number(val) || 0}</span>
    ),
  },
  {
    key: 'created_at',
    header: 'Creado',
    sortable: true,
    render: (val) => (
      <span className="text-neutral-500 text-xs">
        {val ? new Date(String(val)).toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }) : '—'}
      </span>
    ),
  },
]

// ── Quick Action Card ─────────────────────────────────────

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-soft transition-all duration-200 hover:shadow-medium hover:border-neutral-300 cursor-pointer group">
        <div className="flex-shrink-0 p-2.5 bg-bloque-gray50 rounded-lg group-hover:bg-brand-50 transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-bloque-navy900">{title}</h3>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-brand-500 transition-colors" />
      </div>
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function EmployerDashboardPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, user } = useAuthStore()
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (!isEmployer()) {
      router.push('/dashboard')
      return
    }
    loadData()
  }, [isAuthenticated, accessToken, router])

  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const jobsData = await employerApi.getJobs(accessToken) as { items?: Record<string, unknown>[] }
      const jobList = jobsData.items ?? []
      setJobs(
        jobList.map((j) => ({
          id: String(j.id ?? ''),
          title: String(j.title ?? ''),
          status: String(j.status ?? ''),
          location: String(j.location ?? ''),
          shortlist_count: Number(j.shortlist_count ?? 0),
          created_at: String(j.created_at ?? ''),
        }))
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar datos'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  if (!isAuthenticated) return null

  // Computed stats
  const totalJobs = jobs.length
  const activeJobs = jobs.filter((j) => j.status === 'ACTIVE').length
  const totalShortlisted = jobs.reduce((sum, j) => sum + j.shortlist_count, 0)
  const pendingReviews = jobs.filter((j) => j.status === 'PENDING' || j.status === 'DRAFT').length

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-bloque-navy900">
            Hola, {user?.full_name?.split(' ')[0] ?? 'Empleador'}
          </h1>
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
          label="Total Vacantes"
          value={totalJobs}
          icon={<Briefcase className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="Vacantes Activas"
          value={activeJobs}
          previousValue={Math.max(0, activeJobs - 2)}
          trend={[3, 5, 4, 6, activeJobs]}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="En Shortlists"
          value={totalShortlisted}
          icon={<UserCheck className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="Por Revisar"
          value={pendingReviews}
          icon={<Clock className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <QuickAction
          href="/employer/jobs"
          icon={<Briefcase className="h-5 w-5 text-bloque-navy900" />}
          title="Mis Vacantes"
          description="Gestiona tus posiciones abiertas"
        />
        <QuickAction
          href="/employer/shortlists"
          icon={<ClipboardList className="h-5 w-5 text-bloque-navy900" />}
          title="Shortlists"
          description="Revisa candidatos preseleccionados"
        />
        <QuickAction
          href="/employer/jobs/new"
          icon={<Plus className="h-5 w-5 text-brand-500" />}
          title="Nueva Vacante"
          description="Publica una nueva posición"
        />
      </div>

      {/* Recent Jobs Table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-bloque-navy900">
            Vacantes Recientes
          </h3>
          <Link
            href="/employer/jobs"
            className="text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors"
          >
            Ver todas
          </Link>
        </div>
        <DataTable<JobRow>
          data={jobs}
          columns={jobColumns}
          keyField="id"
          loading={loading}
          error={error ?? undefined}
          onRetry={loadData}
          pageSize={5}
          emptyState={
            <EmptyState
              variant="jobs"
              title="Sin vacantes"
              description="Crea tu primera vacante para empezar a recibir candidatos."
              action={{ label: 'Crear vacante', onClick: () => router.push('/employer/jobs/new') }}
            />
          }
          actions={[
            {
              label: 'Ver detalle',
              onClick: (row) => router.push(`/employer/jobs/${row.id}`),
            },
          ]}
        />
      </div>
    </AppShell>
  )
}
