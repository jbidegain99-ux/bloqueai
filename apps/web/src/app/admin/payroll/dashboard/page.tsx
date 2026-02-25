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
  Users,
  DollarSign,
  FileText,
  TrendingUp,
  ChevronRight,
  Calculator,
} from 'lucide-react'

interface ClientOption {
  id: string
  name: string
}

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

export default function PayrollDashboardPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

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
      setClients(data.items.map((c) => ({ id: c.id, name: c.name })))
      if (data.items.length > 0) {
        setSelectedClient(data.items[0].id)
        await loadSummary(data.items[0].id)
      }
    } catch (err) {
      console.error('Error loading clients:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadSummary = async (clientId: string) => {
    if (!accessToken || !clientId) return
    setLoading(true)
    try {
      const data = await payrollApi.getSummaryReport(accessToken, { client_id: clientId })
      setSummary(data)
    } catch (err) {
      console.error('Error loading summary:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId)
    loadSummary(clientId)
  }

  const formatMoney = (amount: number, currency: string) =>
    `${currency} ${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

  return (
    <AppShell>
      <BrandHero
        title="Personal y Nomina"
        subtitle="Gestion integral de empleados, asistencia y nomina"
      />

      <nav className="flex items-center gap-2 text-sm text-muted-foreground mt-4 mb-2">
        <Link href="/admin/dashboard" className="hover:text-bloque-navy900 transition-colors">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-bloque-navy900 font-medium">Nomina</span>
      </nav>

      <div className="space-y-6 mt-4">
        {/* Client selector */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Cliente:</label>
          <select
            value={selectedClient}
            onChange={(e) => handleClientChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <BrandCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">Empleados</span>
                  <Users className="h-5 w-5 text-bloque-navy900" />
                </div>
                <p className="text-3xl font-bold text-bloque-navy900">{summary.total_employees}</p>
                <p className="text-xs text-gray-500 mt-1">{summary.runs_count} nominas procesadas</p>
              </div>
            </BrandCard>

            <BrandCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">Total Bruto</span>
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-700">{formatMoney(summary.total_gross, summary.currency)}</p>
              </div>
            </BrandCard>

            <BrandCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">Deducciones</span>
                  <Calculator className="h-5 w-5 text-orange-500" />
                </div>
                <p className="text-2xl font-bold text-orange-600">{formatMoney(summary.total_deductions, summary.currency)}</p>
              </div>
            </BrandCard>

            <BrandCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">Pago Neto</span>
                  <DollarSign className="h-5 w-5 text-bloque-gold" />
                </div>
                <p className="text-2xl font-bold text-bloque-navy900">{formatMoney(summary.total_net, summary.currency)}</p>
              </div>
            </BrandCard>
          </div>
        ) : (
          <p className="text-gray-500">Selecciona un cliente para ver el resumen.</p>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/payroll/employees">
            <BrandCard className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="p-6 flex items-center gap-4">
                <Users className="h-8 w-8 text-bloque-navy900" />
                <div>
                  <h3 className="font-semibold text-bloque-navy900">Empleados</h3>
                  <p className="text-sm text-gray-500">Gestionar empleados y contratos</p>
                </div>
              </div>
            </BrandCard>
          </Link>

          <Link href="/admin/payroll/runs">
            <BrandCard className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="p-6 flex items-center gap-4">
                <FileText className="h-8 w-8 text-bloque-navy900" />
                <div>
                  <h3 className="font-semibold text-bloque-navy900">Nominas</h3>
                  <p className="text-sm text-gray-500">Crear y procesar nominas</p>
                </div>
              </div>
            </BrandCard>
          </Link>

          <Link href="/admin/payroll/reports">
            <BrandCard className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="p-6 flex items-center gap-4">
                <TrendingUp className="h-8 w-8 text-bloque-navy900" />
                <div>
                  <h3 className="font-semibold text-bloque-navy900">Reportes</h3>
                  <p className="text-sm text-gray-500">Resumen y detalle de nomina</p>
                </div>
              </div>
            </BrandCard>
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
