'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { useAuthStore, isRecruiter } from '@/lib/auth'
import { payrollApi } from '@/lib/api'
import {
  ChevronRight,
  CheckCircle,
  Calculator,
  ThumbsUp,
  Download,
  FileText,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react'

interface RunDetail {
  id: string
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
}

interface LineItem {
  id: string
  employee_id: string
  employee_name: string
  employee_code: string | null
  department: string | null
  base_salary: number
  days_worked: number | null
  hours_regular: number
  hours_overtime: number
  gross_pay: number
  total_deductions: number
  net_pay: number
}

export default function PayrollRunDetailPage() {
  const router = useRouter()
  const params = useParams()
  const runId = params.id as string
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [run, setRun] = useState<RunDetail | null>(null)
  const [lines, setLines] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) { router.push('/login'); return }
    if (!isRecruiter()) { router.push('/dashboard'); return }
    loadRunDetail()
  }, [isHydrated, isAuthenticated, accessToken, router, runId])

  const loadRunDetail = async () => {
    if (!accessToken || !runId) return
    setLoading(true)
    try {
      const runs = await payrollApi.getRuns(accessToken)
      const found = runs.find((r) => r.id === runId)
      if (found) {
        setRun(found)
        if (['CALCULATED', 'APPROVED', 'PAID'].includes(found.status)) {
          const linesData = await payrollApi.getRunLines(accessToken, runId)
          setLines(linesData)
        }
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleValidate = async () => {
    if (!accessToken || !runId) return
    setActionLoading(true)
    setMessage(null)
    try {
      const result = await payrollApi.validateRun(accessToken, runId)
      setWarnings(result.warnings)
      setMessage({ type: 'success', text: `Validada: ${result.employee_count} empleados encontrados` })
      loadRunDetail()
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al validar la nomina' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCalculate = async () => {
    if (!accessToken || !runId) return
    setActionLoading(true)
    setMessage(null)
    try {
      const result = await payrollApi.calculateRun(accessToken, runId)
      setMessage({ type: 'success', text: `Calculada: ${result.employee_count} empleados, neto ${run?.currency || 'USD'} ${result.total_net.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` })
      loadRunDetail()
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al calcular la nomina' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!accessToken || !runId) return
    setActionLoading(true)
    setMessage(null)
    try {
      const result = await payrollApi.approveRun(accessToken, runId)
      setMessage({ type: 'success', text: `Aprobada por ${result.approved_by}` })
      loadRunDetail()
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al aprobar la nomina' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleExport = async () => {
    if (!accessToken || !runId) return
    try {
      await payrollApi.exportRunCsv(accessToken, runId)
    } catch (err) {
      console.error('Error exporting:', err)
    }
  }

  const formatMoney = (amount: number, currency: string) =>
    `${currency} ${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

  const statusSteps = ['DRAFT', 'VALIDATED', 'CALCULATED', 'APPROVED']
  const stepLabels: Record<string, string> = {
    DRAFT: 'Borrador', VALIDATED: 'Validada', CALCULATED: 'Calculada', APPROVED: 'Aprobada',
  }

  const currentStepIndex = run ? statusSteps.indexOf(run.status) : 0

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-gray-400">Cargando nomina...</div>
        </div>
      </AppShell>
    )
  }

  if (!run) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <p className="text-gray-500">Nomina no encontrada</p>
          <Link href="/admin/payroll/runs" className="text-bloque-navy900 hover:underline mt-2 inline-block">Volver a nominas</Link>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <BrandHero
        title={`Nomina: ${run.period_start} - ${run.period_end}`}
        subtitle={run.client_name || 'Cliente'}
      />

      <nav className="flex items-center gap-2 text-sm text-muted-foreground mt-4 mb-2">
        <Link href="/admin/dashboard" className="hover:text-bloque-navy900 transition-colors">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/admin/payroll/runs" className="hover:text-bloque-navy900 transition-colors">Nominas</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-bloque-navy900 font-medium">Detalle</span>
      </nav>

      <div className="space-y-6 mt-4">
        {/* Status stepper */}
        <BrandCard>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              {statusSteps.map((step, i) => (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                    ${i <= currentStepIndex ? 'bg-bloque-navy900 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {i < currentStepIndex ? <CheckCircle className="h-5 w-5" /> : i + 1}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${i <= currentStepIndex ? 'text-bloque-navy900' : 'text-gray-400'}`}>
                    {stepLabels[step]}
                  </span>
                  {i < statusSteps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-3 ${i < currentStepIndex ? 'bg-bloque-navy900' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {run.status === 'DRAFT' && (
                <button onClick={handleValidate} disabled={actionLoading}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <CheckCircle className="h-4 w-4" /> {actionLoading ? 'Validando...' : 'Validar'}
                </button>
              )}
              {run.status === 'VALIDATED' && (
                <button onClick={handleCalculate} disabled={actionLoading}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  <Calculator className="h-4 w-4" /> {actionLoading ? 'Calculando...' : 'Calcular'}
                </button>
              )}
              {run.status === 'CALCULATED' && (
                <button onClick={handleApprove} disabled={actionLoading}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                  <ThumbsUp className="h-4 w-4" /> {actionLoading ? 'Aprobando...' : 'Aprobar'}
                </button>
              )}
              {['CALCULATED', 'APPROVED', 'PAID'].includes(run.status) && (
                <button onClick={handleExport}
                  className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                  <Download className="h-4 w-4" /> Exportar CSV
                </button>
              )}
            </div>

            {/* Messages */}
            {message && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {message.text}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 font-medium text-sm mb-1">
                  <AlertTriangle className="h-4 w-4" /> Advertencias
                </div>
                <ul className="text-xs text-yellow-700 list-disc ml-6">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        </BrandCard>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <BrandCard>
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500">Empleados</p>
              <p className="text-2xl font-bold text-bloque-navy900">{run.employee_count}</p>
            </div>
          </BrandCard>
          <BrandCard>
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500">Total Bruto</p>
              <p className="text-xl font-bold text-green-700">{formatMoney(run.total_gross, run.currency)}</p>
            </div>
          </BrandCard>
          <BrandCard>
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500">Deducciones</p>
              <p className="text-xl font-bold text-orange-600">{formatMoney(run.total_deductions, run.currency)}</p>
            </div>
          </BrandCard>
          <BrandCard>
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500">Pago Neto</p>
              <p className="text-xl font-bold text-bloque-navy900">{formatMoney(run.total_net, run.currency)}</p>
            </div>
          </BrandCard>
        </div>

        {/* Lines table */}
        {lines.length > 0 && (
          <BrandCard>
            <div className="px-6 pt-6 pb-2">
              <h3 className="text-lg font-semibold text-bloque-navy900">Detalle por Empleado</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-600">Empleado</th>
                    <th className="text-left p-3 font-medium text-gray-600">Depto</th>
                    <th className="text-right p-3 font-medium text-gray-600">Salario Base</th>
                    <th className="text-right p-3 font-medium text-gray-600">Hrs Reg</th>
                    <th className="text-right p-3 font-medium text-gray-600">Hrs Extra</th>
                    <th className="text-right p-3 font-medium text-gray-600">Bruto</th>
                    <th className="text-right p-3 font-medium text-gray-600">Deducciones</th>
                    <th className="text-right p-3 font-medium text-gray-600 bg-gray-100">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{line.employee_name}</div>
                        {line.employee_code && <div className="text-xs text-gray-500">{line.employee_code}</div>}
                      </td>
                      <td className="p-3 text-gray-600">{line.department || '-'}</td>
                      <td className="p-3 text-right text-gray-700">{formatMoney(line.base_salary, run.currency)}</td>
                      <td className="p-3 text-right text-gray-600">{line.hours_regular.toFixed(1)}</td>
                      <td className="p-3 text-right text-gray-600">{line.hours_overtime.toFixed(1)}</td>
                      <td className="p-3 text-right text-gray-700">{formatMoney(line.gross_pay, run.currency)}</td>
                      <td className="p-3 text-right text-orange-600">{formatMoney(line.total_deductions, run.currency)}</td>
                      <td className="p-3 text-right font-semibold text-bloque-navy900 bg-gray-50">{formatMoney(line.net_pay, run.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BrandCard>
        )}

        <Link href="/admin/payroll/runs" className="inline-flex items-center gap-1 text-sm text-bloque-navy900 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver a nominas
        </Link>
      </div>
    </AppShell>
  )
}
