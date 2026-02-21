'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { DataTable } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import type { DataTableColumn } from '@/components/ui/data-table'
import { useAuthStore } from '@/lib/auth'
import { eorApi } from '@/lib/api'
import type { EORPayslip } from '@/lib/api'

const columns: DataTableColumn<EORPayslip>[] = [
  {
    key: 'period_start',
    header: 'Periodo',
    sortable: true,
    render: (_, row) => (
      <span className="text-sm font-medium">
        {new Date(row.period_start).toLocaleDateString('es-SV', {
          month: 'long',
          year: 'numeric',
        })}
      </span>
    ),
  },
  {
    key: 'gross_salary',
    header: 'Bruto',
    sortable: true,
    render: (val) => (
      <span className="tabular-nums">${Number(val).toFixed(2)}</span>
    ),
  },
  {
    key: 'total_deductions',
    header: 'Deducciones',
    render: (val) => (
      <span className="tabular-nums text-error-500">
        -${Number(val).toFixed(2)}
      </span>
    ),
  },
  {
    key: 'net_salary',
    header: 'Neto',
    sortable: true,
    render: (val) => (
      <span className="tabular-nums font-semibold text-success-600">
        ${Number(val).toFixed(2)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Estado',
    render: (val) => (
      <Badge variant={String(val) === 'PAID' ? 'success' : 'outline'}>
        {String(val) === 'PAID' ? 'Pagado' : String(val)}
      </Badge>
    ),
  },
]

export default function EmployeePayslipsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, user } = useAuthStore()
  const [payslips, setPayslips] = useState<EORPayslip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadData()
  }, [isAuthenticated, accessToken])

  const loadData = useCallback(async () => {
    if (!accessToken || !user) return
    setLoading(true)
    setError(null)
    try {
      const data = await eorApi.getEmployeePayslips(accessToken, user.id)
      setPayslips(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar boletas')
    } finally {
      setLoading(false)
    }
  }, [accessToken, user])

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-bloque-navy900 mb-6">
          Mis Boletas de Pago
        </h1>
        <DataTable<EORPayslip>
          data={payslips}
          columns={columns}
          keyField="item_id"
          loading={loading}
          error={error ?? undefined}
          onRetry={loadData}
          pageSize={12}
          emptyState={
            <EmptyState
              variant="generic"
              title="Sin boletas"
              description="Aun no tienes boletas de pago registradas."
            />
          }
        />
      </div>
    </AppShell>
  )
}
