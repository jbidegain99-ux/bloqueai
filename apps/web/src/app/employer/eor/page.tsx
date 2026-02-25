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
import { eorApi } from '@/lib/api'
import type { EOREmployee } from '@/lib/api'
import {
  Users,
  DollarSign,
  Calendar,
  AlertCircle,
  Plus,
  UserPlus,
} from 'lucide-react'

// ── Status maps ──────────────────────────────────────────

const STATUS_BADGE_MAP: Record<string, 'success' | 'outline' | 'warning' | 'secondary' | 'destructive'> = {
  ACTIVE: 'success',
  ONBOARDING: 'outline',
  ON_LEAVE: 'warning',
  TERMINATED: 'destructive',
}

const STATUS_LABEL_MAP: Record<string, string> = {
  ACTIVE: 'Activo',
  ONBOARDING: 'Incorporando',
  ON_LEAVE: 'Licencia',
  TERMINATED: 'Terminado',
}

// ── Columns ──────────────────────────────────────────────

const employeeColumns: DataTableColumn<EOREmployee>[] = [
  {
    key: 'first_name',
    header: 'Empleado',
    sortable: true,
    filterable: true,
    render: (_, row) => (
      <div>
        <p className="font-medium text-bloque-navy900">
          {row.first_name} {row.last_name}
        </p>
        <p className="text-xs text-neutral-500">{row.email}</p>
      </div>
    ),
  },
  {
    key: 'position',
    header: 'Puesto',
    sortable: true,
    render: (val) => (
      <span className="text-bloque-navy900">{val ? String(val) : '—'}</span>
    ),
  },
  {
    key: 'base_salary',
    header: 'Salario',
    sortable: true,
    render: (val) => (
      <span className="tabular-nums font-medium">
        ${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Estado',
    sortable: true,
    render: (val) => {
      const s = String(val)
      return (
        <Badge variant={STATUS_BADGE_MAP[s] ?? 'outline'}>
          {STATUS_LABEL_MAP[s] ?? s}
        </Badge>
      )
    },
  },
  {
    key: 'start_date',
    header: 'Inicio',
    sortable: true,
    render: (val) => (
      <span className="text-neutral-500 text-xs">
        {val
          ? new Date(String(val)).toLocaleDateString('es-SV', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : '—'}
      </span>
    ),
  },
]

// ── Main page ────────────────────────────────────────────

export default function EORDashboardPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated, user } = useAuthStore()
  const [employees, setEmployees] = useState<EOREmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (!isEmployer()) {
      router.push('/dashboard')
      return
    }
    loadData()
  }, [isHydrated, isAuthenticated, accessToken, router])

  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const data = await eorApi.listEmployees(accessToken)
      setEmployees(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar empleados'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  if (!isHydrated || !isAuthenticated) return null

  // Computed stats
  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE')
  const totalCost = activeEmployees.reduce((sum, e) => sum + e.base_salary, 0)
  const pendingCount = employees.filter(
    (e) => e.status === 'ONBOARDING'
  ).length

  // Next payroll date — 15th or end of month, whichever is next
  const today = new Date()
  const nextPayroll = (() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 15)
    if (d <= today) {
      d.setMonth(d.getMonth() + 1)
    }
    return d.toLocaleDateString('es-SV', { day: 'numeric', month: 'short' })
  })()

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-bloque-navy900">
            EOR El Salvador
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Gestiona empleados contratados a traves de Bloque S.A. de C.V.
          </p>
        </div>
        <Link href="/employer/eor/new">
          <Button variant="primary">
            <UserPlus className="h-4 w-4 mr-1.5" />
            Agregar Empleado
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total Empleados"
          value={activeEmployees.length}
          icon={<Users className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="Costo Mensual"
          value={totalCost}
          format={(v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="Proxima Nomina"
          value={0}
          format={() => nextPayroll}
          icon={<Calendar className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="Pendientes"
          value={pendingCount}
          icon={<AlertCircle className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Employees Table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-bloque-navy900">
            Empleados
          </h3>
        </div>
        <DataTable<EOREmployee>
          data={employees}
          columns={employeeColumns}
          keyField="id"
          loading={loading}
          error={error ?? undefined}
          onRetry={loadData}
          pageSize={10}
          emptyState={
            <EmptyState
              variant="generic"
              title="Sin empleados"
              description="Agrega tu primer empleado para comenzar con el servicio EOR."
              action={{
                label: 'Agregar empleado',
                onClick: () => router.push('/employer/eor/new'),
              }}
            />
          }
          actions={[
            {
              label: 'Ver detalle',
              onClick: (row) => router.push(`/employer/eor/${row.id}`),
            },
          ]}
        />
      </div>
    </AppShell>
  )
}
