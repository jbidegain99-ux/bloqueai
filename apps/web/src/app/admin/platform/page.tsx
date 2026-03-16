'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { useAuthStore, isAdmin } from '@/lib/auth'
import { adminApi } from '@/lib/api'
import { getErrorMessage } from '@/types'
import {
  Building2,
  Users,
  FileText,
  Activity,
  TrendingUp,
  Shield,
  AlertTriangle,
} from 'lucide-react'

interface PlatformStats {
  total_companies: number
  active_companies: number
  total_users: number
  total_employees: number
  total_payroll_runs: number
}

interface AuditLogEntry {
  id: string
  user_id: string | null
  entity_type: string
  action: string
  description: string | null
  created_at: string
}

export default function PlatformDashboardPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [recentAudit, setRecentAudit] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) { router.push('/login'); return }
    if (!isAdmin()) { router.push('/dashboard'); return }
    loadData()
  }, [isHydrated, isAuthenticated, accessToken, router])

  const loadData = async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const [statsData, auditData] = await Promise.all([
        adminApi.getPlatformStats(accessToken),
        adminApi.getAuditLogs(accessToken),
      ])
      setStats(statsData)
      setRecentAudit(Array.isArray(auditData) ? auditData.slice(0, 10) : [])
    } catch (err) {
      console.error('Failed to load platform data:', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const kpis = stats ? [
    { label: 'Empresas', value: stats.total_companies, icon: Building2, color: 'text-blue-600' },
    { label: 'Empresas Activas', value: stats.active_companies, icon: Activity, color: 'text-green-600' },
    { label: 'Usuarios', value: stats.total_users, icon: Users, color: 'text-purple-600' },
    { label: 'Empleados en Nómina', value: stats.total_employees, icon: Users, color: 'text-orange-600' },
    { label: 'Nóminas Procesadas', value: stats.total_payroll_runs, icon: FileText, color: 'text-teal-600' },
  ] : []

  return (
    <AppShell>
      <BrandHero
        title="Plataforma TalentOS"
        subtitle="Panel de control de la plataforma"
        size="sm"
      />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-8 bg-gray-200 rounded w-1/2" />
              </div>
            ))
          ) : (
            kpis.map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  <span className="text-sm text-gray-500">{kpi.label}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {kpi.value.toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <BrandCard>
            <BrandCardHeader title="Acciones Rápidas" />
            <div className="p-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => router.push('/admin/platform/tenants')}
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-gray-50 transition-colors text-left"
              >
                <Building2 className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Gestionar Empresas</p>
                  <p className="text-xs text-gray-500">{stats?.total_companies || 0} empresas</p>
                </div>
              </button>
              <button
                onClick={() => router.push('/admin/platform/audit-logs')}
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-gray-50 transition-colors text-left"
              >
                <Shield className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Auditoría</p>
                  <p className="text-xs text-gray-500">Ver registro de acciones</p>
                </div>
              </button>
              <button
                onClick={() => router.push('/admin/settings')}
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-gray-50 transition-colors text-left"
              >
                <TrendingUp className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Configuración</p>
                  <p className="text-xs text-gray-500">Ajustes del sistema</p>
                </div>
              </button>
              <button
                onClick={() => router.push('/admin/kpis')}
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-gray-50 transition-colors text-left"
              >
                <Activity className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium">KPIs Reclutamiento</p>
                  <p className="text-xs text-gray-500">Métricas de negocio</p>
                </div>
              </button>
            </div>
          </BrandCard>

          {/* Recent Audit Log */}
          <BrandCard>
            <BrandCardHeader
              title="Actividad Reciente"
              action={
                <button
                  onClick={() => router.push('/admin/platform/audit-logs')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Ver todo
                </button>
              }
            />
            <div className="p-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse flex gap-3">
                      <div className="h-3 bg-gray-200 rounded w-24" />
                      <div className="h-3 bg-gray-200 rounded flex-1" />
                    </div>
                  ))}
                </div>
              ) : recentAudit.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Sin actividad reciente</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentAudit.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-sm py-1 border-b last:border-0">
                      <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
                        {new Date(log.created_at).toLocaleDateString('es-SV', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 mr-1">
                          {log.action}
                        </span>
                        <span className="text-gray-600 truncate">
                          {log.description || log.entity_type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </BrandCard>
        </div>
      </div>
    </AppShell>
  )
}
