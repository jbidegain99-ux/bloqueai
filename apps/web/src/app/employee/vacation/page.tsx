'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import type { DataTableColumn } from '@/components/ui/data-table'
import { useAuthStore } from '@/lib/auth'
import { eorApi } from '@/lib/api'
import type { EOREmployeeDetail, EORVacationRequest } from '@/lib/api'
import { validators } from '@/lib/validations'
import {
  CalendarDays,
  Plus,
  X,
  Loader2,
} from 'lucide-react'

const VAC_BADGE: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
}
const VAC_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
}

const columns: DataTableColumn<EORVacationRequest>[] = [
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
    key: 'reason',
    header: 'Motivo',
    render: (val) => (
      <span className="text-sm text-neutral-600 truncate max-w-[200px] block">
        {val ? String(val) : '—'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Estado',
    render: (val) => {
      const s = String(val)
      return (
        <Badge variant={VAC_BADGE[s] ?? 'outline'}>
          {VAC_LABEL[s] ?? s}
        </Badge>
      )
    },
  },
]

export default function EmployeeVacationPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated, user } = useAuthStore()
  const [employee, setEmployee] = useState<EOREmployeeDetail | null>(null)
  const [vacations, setVacations] = useState<EORVacationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    days_requested: '',
    reason: '',
  })

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadData()
  }, [isHydrated, isAuthenticated, accessToken])

  const loadData = useCallback(async () => {
    if (!accessToken || !user) return
    setLoading(true)
    try {
      const [emp, vacs] = await Promise.all([
        eorApi.getEmployee(accessToken, user.id).catch(() => null),
        eorApi.listVacationRequests(accessToken, { employee_id: user.id }),
      ])
      setEmployee(emp)
      setVacations(Array.isArray(vacs) ? vacs : [])
    } catch {
      // graceful
    } finally {
      setLoading(false)
    }
  }, [accessToken, user])

  const handleSubmit = async () => {
    if (!accessToken || !user) return

    // Validate fields
    const dateErr = validators.date(formData.start_date) || validators.date(formData.end_date)
    const daysErr = validators.positiveInt(formData.days_requested)
    if (dateErr || daysErr) {
      setError(dateErr || daysErr || 'Campos invalidos')
      return
    }
    if (formData.end_date < formData.start_date) {
      setError('La fecha de fin debe ser posterior a la fecha de inicio')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await eorApi.createVacationRequest(accessToken, {
        employee_id: user.id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        days_requested: parseInt(formData.days_requested),
        reason: formData.reason || undefined,
      })
      setShowForm(false)
      setFormData({ start_date: '', end_date: '', days_requested: '', reason: '' })
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isHydrated || !isAuthenticated) return null

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-bloque-navy900">Vacaciones</h1>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? (
              <>
                <X className="h-4 w-4 mr-1.5" />
                Cancelar
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Solicitar Vacaciones
              </>
            )}
          </Button>
        </div>

        {/* Balance card */}
        <BrandCard className="mb-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                <CalendarDays className="h-6 w-6 text-brand-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider">
                  Dias Disponibles
                </p>
                <p className="text-2xl font-bold text-brand-600 tabular-nums">
                  {employee?.vacation_days_available ?? 15}
                </p>
              </div>
            </div>
            <div className="h-12 w-px bg-neutral-200" />
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider">
                Dias Usados
              </p>
              <p className="text-2xl font-bold text-bloque-navy900 tabular-nums">
                {employee?.vacation_days_used ?? 0}
              </p>
            </div>
          </div>
        </BrandCard>

        {/* New request form */}
        {showForm && (
          <BrandCard className="mb-6">
            <h3 className="text-lg font-semibold text-bloque-navy900 mb-4">
              Nueva Solicitud
            </h3>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
                {error}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <Label htmlFor="vac_start">Desde *</Label>
                <Input
                  id="vac_start"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="vac_end">Hasta *</Label>
                <Input
                  id="vac_end"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="vac_days">Dias *</Label>
                <Input
                  id="vac_days"
                  type="number"
                  min="1"
                  value={formData.days_requested}
                  onChange={(e) =>
                    setFormData({ ...formData, days_requested: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="mb-4">
              <Label htmlFor="vac_reason">Motivo</Label>
              <Textarea
                id="vac_reason"
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                placeholder="Vacaciones familiares, viaje, etc."
                rows={2}
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !formData.start_date ||
                !formData.end_date ||
                !formData.days_requested
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Solicitud'
              )}
            </Button>
          </BrandCard>
        )}

        {/* History */}
        <DataTable<EORVacationRequest>
          data={vacations}
          columns={columns}
          keyField="id"
          loading={loading}
          pageSize={10}
          emptyState={
            <EmptyState
              variant="generic"
              title="Sin solicitudes"
              description="No has solicitado vacaciones aun."
            />
          }
        />
      </div>
    </AppShell>
  )
}
