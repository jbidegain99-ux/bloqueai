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
  BarChart3,
  ChevronRight,
  Download,
  FileText,
} from 'lucide-react'

interface SummaryData {
  client_name: string | null
  period: string | null
  total_employees: number
  total_gross: number
  total_deductions: number
  total_net: number
  runs_count: number
  currency: string
}

interface DetailLine {
  employee_name: string
  employee_code: string | null
  department: string | null
  base_salary: number
  gross_pay: number
  total_deductions: number
  net_pay: number
}

interface RunOption {
  id: string
  label: string
}

interface ClientOption {
  id: string
  name: string
}

export default function PayrollReportsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated } = useAuthStore()
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [runs, setRuns] = useState<RunOption[]>([])
  const [selectedRun, setSelectedRun] = useState('')
  const [detail, setDetail] = useState<DetailLine[]>([])
  const [loading, setLoading] = useState(true)

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
        await loadSummary(list[0].id)
        await loadRuns(list[0].id)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadSummary = async (clientId: string) => {
    if (!accessToken || !clientId) return
    try {
      const data = await payrollApi.getSummaryReport(accessToken, {
        client_id: clientId,
        period_start: periodStart || undefined,
        period_end: periodEnd || undefined,
      })
      setSummary(data)
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const loadRuns = async (clientId: string) => {
    if (!accessToken || !clientId) return
    try {
      const data = await payrollApi.getRuns(accessToken, { client_id: clientId })
      setRuns(data.map((r) => ({
        id: r.id,
        label: `${r.period_start} - ${r.period_end} (${r.status})`,
      })))
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId)
    loadSummary(clientId)
    loadRuns(clientId)
    setDetail([])
    setSelectedRun('')
  }

  const handleLoadDetail = async () => {
    if (!accessToken || !selectedRun) return
    try {
      const data = await payrollApi.getDetailReport(accessToken, selectedRun)
      setDetail(data)
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const handleExport = async () => {
    if (!accessToken || !selectedRun) return
    try {
      await payrollApi.exportRunCsv(accessToken, selectedRun)
    } catch (err) {
      console.error('Error exporting:', err)
    }
  }

  const formatMoney = (amount: number, currency: string) =>
    `${currency} ${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

  return (
    <AppShell>
      <BrandHero title="Reportes de Nomina" subtitle="Resumen y detalle por periodo" />

      <nav className="flex items-center gap-2 text-sm text-muted-foreground mt-4 mb-2">
        <Link href="/admin/dashboard" className="hover:text-bloque-navy900 transition-colors">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/admin/payroll/dashboard" className="hover:text-bloque-navy900 transition-colors">Nomina</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-bloque-navy900 font-medium">Reportes</span>
      </nav>

      <div className="space-y-6 mt-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <select value={selectedClient} onChange={(e) => handleClientChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold">
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
          <button onClick={() => loadSummary(selectedClient)}
            className="px-4 py-2 bg-bloque-navy900 text-white rounded-lg text-sm hover:bg-bloque-navy900/90">
            Actualizar
          </button>
        </div>

        {/* Summary */}
        {summary && (
          <BrandCard>
            <div className="px-6 pt-6 pb-2 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-bloque-navy900" />
              <h3 className="text-lg font-semibold text-bloque-navy900">Resumen: {summary.client_name}</h3>
            </div>
            <div className="p-6">
              {summary.period && <p className="text-sm text-gray-500 mb-4">Periodo: {summary.period}</p>}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-bloque-navy900">{summary.total_employees}</p>
                  <p className="text-xs text-gray-500">Empleados</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-bloque-navy900">{summary.runs_count}</p>
                  <p className="text-xs text-gray-500">Nominas</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-lg font-bold text-green-700">{formatMoney(summary.total_gross, summary.currency)}</p>
                  <p className="text-xs text-green-600">Total Bruto</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-lg font-bold text-orange-700">{formatMoney(summary.total_deductions, summary.currency)}</p>
                  <p className="text-xs text-orange-600">Deducciones</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-lg font-bold text-blue-700">{formatMoney(summary.total_net, summary.currency)}</p>
                  <p className="text-xs text-blue-600">Pago Neto</p>
                </div>
              </div>
            </div>
          </BrandCard>
        )}

        {/* Detail Report */}
        <BrandCard>
          <div className="px-6 pt-6 pb-2 flex items-center gap-2">
            <FileText className="h-5 w-5 text-bloque-navy900" />
            <h3 className="text-lg font-semibold text-bloque-navy900">Detalle por Empleado</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <select value={selectedRun} onChange={(e) => setSelectedRun(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold flex-1">
                <option value="">Seleccionar nomina...</option>
                {runs.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <button onClick={handleLoadDetail} disabled={!selectedRun}
                className="px-4 py-2 bg-bloque-navy900 text-white rounded-lg text-sm hover:bg-bloque-navy900/90 disabled:opacity-50">
                Ver Detalle
              </button>
              {selectedRun && detail.length > 0 && (
                <button onClick={handleExport}
                  className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                  <Download className="h-4 w-4" /> CSV
                </button>
              )}
            </div>

            {detail.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium text-gray-600">Empleado</th>
                      <th className="text-left p-3 font-medium text-gray-600">Codigo</th>
                      <th className="text-left p-3 font-medium text-gray-600">Depto</th>
                      <th className="text-right p-3 font-medium text-gray-600">Salario Base</th>
                      <th className="text-right p-3 font-medium text-gray-600">Bruto</th>
                      <th className="text-right p-3 font-medium text-gray-600">Deducciones</th>
                      <th className="text-right p-3 font-medium text-gray-600 bg-gray-100">Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((d, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{d.employee_name}</td>
                        <td className="p-3 text-gray-600">{d.employee_code || '-'}</td>
                        <td className="p-3 text-gray-600">{d.department || '-'}</td>
                        <td className="p-3 text-right text-gray-700">{formatMoney(d.base_salary, summary?.currency || 'MXN')}</td>
                        <td className="p-3 text-right text-gray-700">{formatMoney(d.gross_pay, summary?.currency || 'MXN')}</td>
                        <td className="p-3 text-right text-orange-600">{formatMoney(d.total_deductions, summary?.currency || 'MXN')}</td>
                        <td className="p-3 text-right font-semibold text-bloque-navy900 bg-gray-50">{formatMoney(d.net_pay, summary?.currency || 'MXN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {detail.length === 0 && selectedRun && (
              <p className="text-gray-400 text-sm text-center py-4">Selecciona una nomina y haz clic en Ver Detalle</p>
            )}
          </div>
        </BrandCard>
      </div>
    </AppShell>
  )
}
