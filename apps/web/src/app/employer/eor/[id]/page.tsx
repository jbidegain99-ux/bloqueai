'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { DataTableColumn } from '@/components/ui/data-table'
import { useAuthStore, isEmployer } from '@/lib/auth'
import { eorApi } from '@/lib/api'
import type { EOREmployeeDetail, EORPayslip, EORVacationRequest } from '@/lib/api'
import {
  ChevronLeft,
  User,
  DollarSign,
  FileText,
  CalendarDays,
  Building2,
  CreditCard,
  Shield,
  MapPin,
  Mail,
  Phone,
  Hash,
  Loader2,
  Download,
} from 'lucide-react'

// ── Tabs ─────────────────────────────────────────────────

const TABS = ['info', 'payroll', 'documents', 'vacation'] as const
type TabId = typeof TABS[number]

const TAB_CONFIG: Record<TabId, { label: string; icon: typeof User }> = {
  info: { label: 'Informacion', icon: User },
  payroll: { label: 'Nominas', icon: DollarSign },
  documents: { label: 'Documentos', icon: FileText },
  vacation: { label: 'Vacaciones', icon: CalendarDays },
}

// ── Status maps ──────────────────────────────────────────

const STATUS_BADGE: Record<string, 'success' | 'outline' | 'warning' | 'destructive'> = {
  ACTIVE: 'success',
  ONBOARDING: 'outline',
  ON_LEAVE: 'warning',
  TERMINATED: 'destructive',
}
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  ONBOARDING: 'Incorporando',
  ON_LEAVE: 'Licencia',
  TERMINATED: 'Terminado',
}

const VAC_STATUS_BADGE: Record<string, 'success' | 'outline' | 'warning' | 'destructive'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
}
const VAC_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
}

// ── Info row ─────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-neutral-100 last:border-0">
      <Icon className="h-4 w-4 text-neutral-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-sm font-medium text-bloque-navy900">{value || '—'}</p>
      </div>
    </div>
  )
}

// ── Payslip columns ──────────────────────────────────────

const payslipColumns: DataTableColumn<EORPayslip>[] = [
  {
    key: 'period_start',
    header: 'Periodo',
    sortable: true,
    render: (_, row) => (
      <span className="text-sm">
        {new Date(row.period_start).toLocaleDateString('es-SV', { month: 'short', year: 'numeric' })}
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
      <span className="tabular-nums text-error-500">-${Number(val).toFixed(2)}</span>
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

// ── Vacation columns ─────────────────────────────────────

const vacationColumns: DataTableColumn<EORVacationRequest>[] = [
  {
    key: 'start_date',
    header: 'Desde',
    sortable: true,
    render: (val) => (
      <span className="text-sm">
        {new Date(String(val)).toLocaleDateString('es-SV', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </span>
    ),
  },
  {
    key: 'end_date',
    header: 'Hasta',
    render: (val) => (
      <span className="text-sm">
        {new Date(String(val)).toLocaleDateString('es-SV', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </span>
    ),
  },
  {
    key: 'days_requested',
    header: 'Dias',
    render: (val) => <span className="tabular-nums font-medium">{Number(val)}</span>,
  },
  {
    key: 'status',
    header: 'Estado',
    render: (val) => {
      const s = String(val)
      return (
        <Badge variant={VAC_STATUS_BADGE[s] ?? 'outline'}>
          {VAC_STATUS_LABEL[s] ?? s}
        </Badge>
      )
    },
  },
]

// ── Main ─────────────────────────────────────────────────

export default function EOREmployeeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const employeeId = params.id as string
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()

  const [employee, setEmployee] = useState<EOREmployeeDetail | null>(null)
  const [payslips, setPayslips] = useState<EORPayslip[]>([])
  const [vacations, setVacations] = useState<EORVacationRequest[]>([])
  const [activeTab, setActiveTab] = useState<TabId>('info')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) router.push('/login')
    else if (!isEmployer()) router.push('/dashboard')
    else loadEmployee()
  }, [isHydrated, isAuthenticated, accessToken, employeeId])

  const loadEmployee = useCallback(async () => {
    if (!accessToken || !employeeId) return
    setLoading(true)
    setError(null)
    try {
      const data = await eorApi.getEmployee(accessToken, employeeId)
      setEmployee(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar empleado')
    } finally {
      setLoading(false)
    }
  }, [accessToken, employeeId])

  const loadPayslips = useCallback(async () => {
    if (!accessToken || !employeeId) return
    try {
      const data = await eorApi.getEmployeePayslips(accessToken, employeeId)
      setPayslips(Array.isArray(data) ? data : [])
    } catch {
      // Silently fail — payslips may not exist yet
    }
  }, [accessToken, employeeId])

  const loadVacations = useCallback(async () => {
    if (!accessToken || !employeeId) return
    try {
      const data = await eorApi.listVacationRequests(accessToken, { employee_id: employeeId })
      setVacations(Array.isArray(data) ? data : [])
    } catch {
      // Silently fail
    }
  }, [accessToken, employeeId])

  // Load tab-specific data on tab change
  useEffect(() => {
    if (activeTab === 'payroll') loadPayslips()
    if (activeTab === 'vacation') loadVacations()
  }, [activeTab, loadPayslips, loadVacations])

  if (!isHydrated || !isAuthenticated) return null

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <div className="grid grid-cols-2 gap-4 mt-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </AppShell>
    )
  }

  if (error || !employee) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto">
          <EmptyState
            variant="generic"
            title="Error"
            description={error ?? 'No se encontro el empleado'}
            action={{ label: 'Volver', onClick: () => router.push('/employer/eor') }}
          />
        </div>
      </AppShell>
    )
  }

  const cost = employee.monthly_cost

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Link
          href="/employer/eor"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-bloque-navy900 transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a empleados
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-bloque-navy900">
                {employee.first_name} {employee.last_name}
              </h1>
              <Badge variant={STATUS_BADGE[employee.status] ?? 'outline'}>
                {STATUS_LABEL[employee.status] ?? employee.status}
              </Badge>
            </div>
            <p className="text-sm text-neutral-500 mt-0.5">
              {employee.position ?? 'Sin puesto'} · Desde{' '}
              {new Date(employee.start_date).toLocaleDateString('es-SV', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Cost summary card */}
        {cost && (
          <BrandCard className="mb-6">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
              {[
                { label: 'Bruto', value: cost.gross_salary },
                { label: 'Deducciones', value: cost.total_deductions, negative: true },
                { label: 'Neto', value: cost.net_salary, highlight: true },
                { label: 'Patronal', value: cost.employer_contributions },
                { label: 'Fee', value: cost.fee_talentos },
                { label: 'Total Costo', value: cost.grand_total, highlight: true },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider">
                    {item.label}
                  </p>
                  <p
                    className={`text-lg font-bold tabular-nums mt-0.5 ${
                      item.negative
                        ? 'text-error-500'
                        : item.highlight
                        ? 'text-brand-600'
                        : 'text-bloque-navy900'
                    }`}
                  >
                    {item.negative ? '-' : ''}${Math.abs(Number(item.value)).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </BrandCard>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-neutral-200 mb-6">
          {TABS.map((tab) => {
            const config = TAB_CONFIG[tab]
            const Icon = config.icon
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-neutral-500 hover:text-bloque-navy900 hover:border-neutral-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {config.label}
              </button>
            )
          })}
        </div>

        {/* Tab: Info */}
        {activeTab === 'info' && (
          <div className="grid md:grid-cols-2 gap-4">
            <BrandCard>
              <BrandCardHeader title="Datos Personales" />
              <InfoRow icon={Mail} label="Correo" value={employee.email} />
              <InfoRow icon={Phone} label="Telefono" value={employee.phone} />
              <InfoRow icon={Hash} label="DUI" value={employee.dui} />
              <InfoRow icon={Hash} label="NIT" value={employee.nit} />
              <InfoRow icon={MapPin} label="Direccion" value={employee.address} />
            </BrandCard>
            <BrandCard>
              <BrandCardHeader title="Datos Laborales" />
              <InfoRow icon={User} label="Puesto" value={employee.position} />
              <InfoRow icon={Building2} label="Departamento" value={employee.department} />
              <InfoRow
                icon={DollarSign}
                label="Salario Base"
                value={`$${Number(employee.base_salary).toFixed(2)}`}
              />
              <InfoRow icon={FileText} label="Contrato" value={employee.contract_type === 'INDEFINIDO' ? 'Indefinido' : 'Plazo fijo'} />
              <InfoRow icon={Shield} label="AFP" value={employee.afp_provider === 'CRECER' ? 'AFP Crecer' : employee.afp_provider === 'CONFIA' ? 'AFP Confia' : employee.afp_provider} />
              <InfoRow icon={CreditCard} label="Banco" value={employee.bank_name ? `${employee.bank_name} - ${employee.bank_account_number}` : null} />
            </BrandCard>
          </div>
        )}

        {/* Tab: Payroll */}
        {activeTab === 'payroll' && (
          <DataTable<EORPayslip>
            data={payslips}
            columns={payslipColumns}
            keyField="item_id"
            pageSize={10}
            emptyState={
              <EmptyState
                variant="generic"
                title="Sin nominas"
                description="Aun no se han procesado nominas para este empleado."
              />
            }
          />
        )}

        {/* Tab: Documents */}
        {activeTab === 'documents' && (
          <BrandCard>
            <BrandCardHeader
              title="Documentos"
              description="Contratos y documentos del empleado"
            />
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-brand-500" />
                  <div>
                    <p className="text-sm font-medium text-bloque-navy900">
                      Contrato de Trabajo
                    </p>
                    <p className="text-xs text-neutral-500">
                      {employee.contract_type === 'INDEFINIDO' ? 'Contrato indefinido' : 'Contrato a plazo fijo'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloading}
                  onClick={async () => {
                    if (!accessToken) return
                    setDownloading(true)
                    try {
                      const res = await fetch(`/api/eor/employees/${employeeId}/contract`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                      })
                      if (!res.ok) throw new Error('Error al descargar')
                      const blob = await res.blob()
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `contrato-${employee.first_name}-${employee.last_name}.pdf`
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      a.remove()
                    } catch {
                      setError('Error al descargar el contrato')
                    } finally {
                      setDownloading(false)
                    }
                  }}
                >
                  {downloading ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Descargando...</>
                  ) : (
                    <><Download className="h-4 w-4 mr-1.5" />Descargar PDF</>
                  )}
                </Button>
              </div>
            </div>
          </BrandCard>
        )}

        {/* Tab: Vacation */}
        {activeTab === 'vacation' && (
          <div className="space-y-4">
            {/* Vacation balance */}
            <BrandCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Dias disponibles</p>
                  <p className="text-3xl font-bold text-brand-600 tabular-nums">
                    {employee.vacation_days_available ?? 15}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Dias usados</p>
                  <p className="text-3xl font-bold text-bloque-navy900 tabular-nums">
                    {employee.vacation_days_used ?? 0}
                  </p>
                </div>
              </div>
            </BrandCard>

            {/* Vacation requests table */}
            <DataTable<EORVacationRequest>
              data={vacations}
              columns={vacationColumns}
              keyField="id"
              pageSize={10}
              emptyState={
                <EmptyState
                  variant="generic"
                  title="Sin solicitudes"
                  description="No hay solicitudes de vacaciones registradas."
                />
              }
              actions={[
                {
                  label: 'Aprobar',
                  onClick: async (row) => {
                    if (accessToken && row.status === 'PENDING') {
                      await eorApi.approveVacation(accessToken, row.id)
                      loadVacations()
                    }
                  },
                },
                {
                  label: 'Rechazar',
                  variant: 'destructive',
                  onClick: async (row) => {
                    if (accessToken && row.status === 'PENDING') {
                      await eorApi.rejectVacation(accessToken, row.id, 'Rechazado por el empleador')
                      loadVacations()
                    }
                  },
                },
              ]}
            />
          </div>
        )}
      </div>
    </AppShell>
  )
}
