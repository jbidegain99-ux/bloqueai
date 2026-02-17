'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { useAuthStore, isRecruiter } from '@/lib/auth'
import { payrollApi, adminApi } from '@/lib/api'
import {
  FileText,
  Plus,
  ChevronRight,
  X,
  Save,
  Eye,
} from 'lucide-react'

interface PayrollRun {
  id: string
  client_id: string
  client_name: string | null
  period_start: string
  period_end: string
  pay_frequency: string
  status: string
  total_gross: number
  total_deductions: number
  total_net: number
  employee_count: number
  currency: string
  approved_by_name: string | null
  approved_at: string | null
  notes: string | null
  created_at: string | null
}

interface ClientOption {
  id: string
  name: string
}

export default function PayrollRunsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated } = useAuthStore()
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    period_start: '', period_end: '', pay_frequency: 'MONTHLY', notes: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return }
    if (!isRecruiter()) { router.push('/dashboard'); return }
    loadClients()
  }, [isAuthenticated, accessToken, router])

  const loadClients = async () => {
    if (!accessToken) return
    try {
      const data = await adminApi.getClients(accessToken, { is_active: true })
      const list = data.items.map((c) => ({ id: c.id, name: c.name }))
      setClients(list)
      if (list.length > 0) {
        setSelectedClient(list[0].id)
        await loadRuns(list[0].id)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadRuns = async (clientId: string, status?: string) => {
    if (!accessToken || !clientId) return
    setLoading(true)
    try {
      const data = await payrollApi.getRuns(accessToken, {
        client_id: clientId,
        run_status: status || undefined,
      })
      setRuns(data)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId)
    loadRuns(clientId, statusFilter)
  }

  const handleCreate = async () => {
    if (!accessToken || !selectedClient || !formData.period_start || !formData.period_end) return
    setSaving(true)
    try {
      await payrollApi.createRun(accessToken, {
        client_id: selectedClient,
        period_start: formData.period_start,
        period_end: formData.period_end,
        pay_frequency: formData.pay_frequency,
        notes: formData.notes || undefined,
      })
      setShowModal(false)
      setFormData({ period_start: '', period_end: '', pay_frequency: 'MONTHLY', notes: '' })
      loadRuns(selectedClient)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setSaving(false)
    }
  }

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador', VALIDATED: 'Validada', CALCULATED: 'Calculada',
      APPROVED: 'Aprobada', PAID: 'Pagada', CANCELLED: 'Cancelada',
    }
    return labels[s] || s
  }

  const statusColor = (s: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-700',
      VALIDATED: 'bg-blue-100 text-blue-800',
      CALCULATED: 'bg-purple-100 text-purple-800',
      APPROVED: 'bg-green-100 text-green-800',
      PAID: 'bg-emerald-100 text-emerald-800',
      CANCELLED: 'bg-red-100 text-red-800',
    }
    return colors[s] || 'bg-gray-100 text-gray-800'
  }

  const formatMoney = (amount: number, currency: string) =>
    `${currency} ${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

  return (
    <AppShell>
      <BrandHero title="Nominas" subtitle="Gestionar corridas de nomina" />

      <nav className="flex items-center gap-2 text-sm text-muted-foreground mt-4 mb-2">
        <Link href="/admin/dashboard" className="hover:text-bloque-navy900 transition-colors">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/admin/payroll/dashboard" className="hover:text-bloque-navy900 transition-colors">Nomina</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-bloque-navy900 font-medium">Nominas</span>
      </nav>

      <div className="space-y-4 mt-4">
        <div className="flex flex-wrap items-center gap-4">
          <select value={selectedClient} onChange={(e) => handleClientChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold">
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); loadRuns(selectedClient, e.target.value) }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold">
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="VALIDATED">Validada</option>
            <option value="CALCULATED">Calculada</option>
            <option value="APPROVED">Aprobada</option>
            <option value="PAID">Pagada</option>
          </select>

          <button onClick={() => setShowModal(true)}
            className="ml-auto flex items-center gap-2 bg-bloque-gold text-bloque-navy900 font-semibold px-4 py-2 rounded-lg hover:bg-bloque-gold/90">
            <Plus className="h-4 w-4" /> Nueva Nomina
          </button>
        </div>

        <BrandCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-600">Periodo</th>
                  <th className="text-left p-3 font-medium text-gray-600">Frecuencia</th>
                  <th className="text-center p-3 font-medium text-gray-600">Empleados</th>
                  <th className="text-right p-3 font-medium text-gray-600">Bruto</th>
                  <th className="text-right p-3 font-medium text-gray-600">Neto</th>
                  <th className="text-center p-3 font-medium text-gray-600">Estado</th>
                  <th className="text-center p-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">Cargando...</td></tr>
                ) : runs.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">No hay nominas registradas</td></tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{run.period_start} - {run.period_end}</div>
                        {run.notes && <div className="text-xs text-gray-500">{run.notes}</div>}
                      </td>
                      <td className="p-3 text-gray-600">{run.pay_frequency}</td>
                      <td className="p-3 text-center text-gray-700">{run.employee_count}</td>
                      <td className="p-3 text-right text-gray-700">{formatMoney(run.total_gross, run.currency)}</td>
                      <td className="p-3 text-right font-medium text-gray-900">{formatMoney(run.total_net, run.currency)}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(run.status)}`}>
                          {statusLabel(run.status)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Link href={`/admin/payroll/runs/${run.id}`}
                          className="inline-flex items-center gap-1 text-bloque-navy900 hover:underline text-xs font-medium">
                          <Eye className="h-3.5 w-3.5" /> Ver
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </BrandCard>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-bloque-navy900">Nueva Nomina</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio periodo *</label>
                  <input type="date" value={formData.period_start} onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin periodo *</label>
                  <input type="date" value={formData.period_end} onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia de pago</label>
                <select value={formData.pay_frequency} onChange={(e) => setFormData({ ...formData, pay_frequency: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold">
                  <option value="WEEKLY">Semanal</option>
                  <option value="BIWEEKLY">Quincenal</option>
                  <option value="MONTHLY">Mensual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !formData.period_start || !formData.period_end}
                className="flex items-center gap-2 bg-bloque-gold text-bloque-navy900 font-semibold px-4 py-2 rounded-lg hover:bg-bloque-gold/90 disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? 'Creando...' : 'Crear Nomina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
