'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { useAuthStore, isRecruiter } from '@/lib/auth'
import { payrollApi, adminApi } from '@/lib/api'
import {
  Calendar,
  Upload,
  ChevronRight,
  Check,
  AlertTriangle,
} from 'lucide-react'

interface AttendanceRecord {
  id: string
  employee_id: string
  employee_name: string
  date: string
  hours: number
  attendance_type: string
  notes: string | null
}

interface CsvPreview {
  rows: Array<{
    employee_code: string | null
    employee_name: string | null
    date: string
    hours: number
    attendance_type: string
    notes: string | null
    is_duplicate: boolean
    employee_id: string | null
  }>
  total_rows: number
  valid_rows: number
  duplicate_rows: number
  unmapped_rows: number
}

interface ClientOption {
  id: string
  name: string
}

export default function PayrollAttendancePage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) { router.push('/login'); return }
    if (!isRecruiter()) { router.push('/dashboard'); return }
    loadClients()
  }, [isHydrated, isAuthenticated, accessToken, router])

  const loadClients = async () => {
    if (!accessToken) return
    try {
      const data = await adminApi.getClients(accessToken, { is_active: true })
      const list = data.items.map((c) => ({ id: c.id, name: c.name }))
      setClients(list)
      if (list.length > 0) {
        setSelectedClient(list[0].id)
        await loadRecords(list[0].id)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadRecords = async (clientId: string) => {
    if (!accessToken || !clientId) return
    setLoading(true)
    try {
      const data = await payrollApi.getAttendance(accessToken, {
        client_id: clientId,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      setRecords(data)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId)
    loadRecords(clientId)
  }

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !accessToken || !selectedClient) return
    setImporting(true)
    try {
      const preview = await payrollApi.importAttendanceCsv(accessToken, selectedClient, file)
      setCsvPreview(preview)
    } catch (err) {
      console.error('Error importing CSV:', err)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleConfirmImport = async () => {
    if (!accessToken || !selectedClient || !csvPreview) return
    setImporting(true)
    try {
      await payrollApi.confirmAttendanceCsv(accessToken, selectedClient, csvPreview.rows)
      setCsvPreview(null)
      loadRecords(selectedClient)
    } catch (err) {
      console.error('Error confirming import:', err)
    } finally {
      setImporting(false)
    }
  }

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      REGULAR: 'Regular', OVERTIME: 'Extra', ABSENCE: 'Ausencia',
      VACATION: 'Vacaciones', SICK_LEAVE: 'Licencia Medica',
    }
    return labels[type] || type
  }

  const typeColor = (type: string) => {
    const colors: Record<string, string> = {
      REGULAR: 'bg-blue-100 text-blue-800',
      OVERTIME: 'bg-purple-100 text-purple-800',
      ABSENCE: 'bg-red-100 text-red-800',
      VACATION: 'bg-green-100 text-green-800',
      SICK_LEAVE: 'bg-yellow-100 text-yellow-800',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  return (
    <AppShell>
      <BrandHero title="Asistencia" subtitle="Registros de asistencia e importacion CSV" />

      <nav className="flex items-center gap-2 text-sm text-muted-foreground mt-4 mb-2">
        <Link href="/admin/dashboard" className="hover:text-bloque-navy900 transition-colors">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/admin/payroll/dashboard" className="hover:text-bloque-navy900 transition-colors">Nomina</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-bloque-navy900 font-medium">Asistencia</span>
      </nav>

      <div className="space-y-4 mt-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedClient}
            onChange={(e) => handleClientChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
          <button onClick={() => loadRecords(selectedClient)}
            className="px-4 py-2 bg-bloque-navy900 text-white rounded-lg text-sm hover:bg-bloque-navy900/90">
            Filtrar
          </button>

          <div className="ml-auto">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 bg-bloque-gold text-bloque-navy900 font-semibold px-4 py-2 rounded-lg hover:bg-bloque-gold/90 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {importing ? 'Procesando...' : 'Importar CSV'}
            </button>
          </div>
        </div>

        {/* CSV Preview */}
        {csvPreview && (
          <BrandCard>
            <div className="p-6">
              <h3 className="font-semibold text-bloque-navy900 mb-3">Vista previa de importacion</h3>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{csvPreview.total_rows}</p>
                  <p className="text-xs text-gray-500">Total filas</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-700">{csvPreview.valid_rows}</p>
                  <p className="text-xs text-green-600">Validas</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-700">{csvPreview.duplicate_rows}</p>
                  <p className="text-xs text-yellow-600">Duplicadas</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-700">{csvPreview.unmapped_rows}</p>
                  <p className="text-xs text-red-600">Sin mapear</p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setCsvPreview(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importing || csvPreview.valid_rows === 0}
                  className="flex items-center gap-2 bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Confirmar ({csvPreview.valid_rows} registros)
                </button>
              </div>
            </div>
          </BrandCard>
        )}

        {/* Table */}
        <BrandCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-600">Empleado</th>
                  <th className="text-left p-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-right p-3 font-medium text-gray-600">Horas</th>
                  <th className="text-center p-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left p-3 font-medium text-gray-600">Notas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">Cargando...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">No hay registros de asistencia</td></tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{r.employee_name}</td>
                      <td className="p-3 text-gray-600">{r.date}</td>
                      <td className="p-3 text-right text-gray-700">{r.hours.toFixed(1)}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeColor(r.attendance_type)}`}>
                          {typeLabel(r.attendance_type)}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500 text-xs">{r.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </BrandCard>
      </div>
    </AppShell>
  )
}
