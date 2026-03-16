'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { useAuthStore, isAdmin } from '@/lib/auth'
import { adminApi } from '@/lib/api'
import { getErrorMessage } from '@/types'
import {
  Shield,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react'

interface AuditLogEntry {
  id: string
  user_id: string | null
  entity_type: string
  entity_id: string
  action: string
  description: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  terminate: 'bg-orange-100 text-orange-700',
  approve: 'bg-purple-100 text-purple-700',
  sign: 'bg-teal-100 text-teal-700',
  calculate: 'bg-indigo-100 text-indigo-700',
  validate: 'bg-cyan-100 text-cyan-700',
  generate_spu: 'bg-yellow-100 text-yellow-700',
  score_override: 'bg-pink-100 text-pink-700',
  csv_import: 'bg-gray-100 text-gray-700',
}

const ENTITY_TYPES = [
  'payroll_employee',
  'payroll_contract',
  'payroll_run',
  'payroll_spu',
  'payroll_attendance',
  'rubric',
  'candidate_report',
  'shortlist_item',
]

export default function AuditLogsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) { router.push('/login'); return }
    if (!isAdmin()) { router.push('/dashboard'); return }
  }, [isHydrated, isAuthenticated, router])

  const loadLogs = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const data = await adminApi.getAuditLogs(
        accessToken,
        entityTypeFilter || undefined,
      )
      setLogs(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load audit logs:', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [accessToken, entityTypeFilter])

  useEffect(() => {
    if (isHydrated && isAuthenticated && accessToken) {
      loadLogs()
    }
  }, [isHydrated, isAuthenticated, accessToken, loadLogs])

  const handleExportCSV = () => {
    if (!logs.length) return
    const headers = ['Fecha', 'Acción', 'Tipo Entidad', 'Descripción']
    const rows = logs.map((log) => [
      new Date(log.created_at).toISOString(),
      log.action,
      log.entity_type,
      log.description || '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell>
      <BrandHero
        title="Registro de Auditoría"
        subtitle={`${logs.length} registros encontrados`}
        size="sm"
      />

      <div className="container mx-auto px-4 py-6">
        <BrandCard>
          {/* Filters */}
          <div className="p-4 border-b flex flex-col sm:flex-row gap-3">
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los tipos</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleExportCSV}
                disabled={logs.length === 0}
                className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-30"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
              <button
                onClick={loadLogs}
                className="p-2 border rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Acción</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 w-10" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b animate-pulse">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      <Shield className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      Sin registros de auditoría
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleDateString('es-SV', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                          {log.entity_type.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-gray-700 truncate max-w-xs">
                          {log.description || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {expandedId === log.id
                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-400" />
                          }
                        </td>
                      </tr>
                      {expandedId === log.id && (
                        <tr key={`${log.id}-detail`} className="bg-gray-50">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="font-medium text-gray-500 mb-1">ID Entidad</p>
                                <p className="font-mono break-all">{log.entity_id}</p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500 mb-1">Usuario</p>
                                <p className="font-mono break-all">{log.user_id || 'Sistema'}</p>
                              </div>
                              {log.old_values && Object.keys(log.old_values).length > 0 && (
                                <div>
                                  <p className="font-medium text-gray-500 mb-1">Valores Anteriores</p>
                                  <pre className="bg-white p-2 rounded border text-xs overflow-auto max-h-32">
                                    {JSON.stringify(log.old_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.new_values && Object.keys(log.new_values).length > 0 && (
                                <div>
                                  <p className="font-medium text-gray-500 mb-1">Valores Nuevos</p>
                                  <pre className="bg-white p-2 rounded border text-xs overflow-auto max-h-32">
                                    {JSON.stringify(log.new_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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
