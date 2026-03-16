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
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react'

interface Tenant {
  id: string
  name: string
  slug: string
  industry: string | null
  size: string | null
  is_active: boolean
  is_client: boolean
  created_at: string | null
  user_count: number
  employee_count: number
  payroll_run_count: number
}

interface TenantsResponse {
  items: Tenant[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export default function TenantsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [data, setData] = useState<TenantsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) { router.push('/login'); return }
    if (!isAdmin()) { router.push('/dashboard'); return }
  }, [isHydrated, isAuthenticated, router])

  const loadTenants = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter === 'active') params.set('is_active', 'true')
      if (statusFilter === 'suspended') params.set('is_active', 'false')
      params.set('page', String(page))
      params.set('page_size', '25')

      const result = await adminApi.getClients(accessToken, {
        search: search || undefined,
        page,
        page_size: 25,
      })

      // Use platform endpoint for richer data
      const platformData: TenantsResponse = await (await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/platform/companies?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )).json()

      setData(platformData)
    } catch (err) {
      console.error('Failed to load tenants:', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [accessToken, search, statusFilter, page])

  useEffect(() => {
    if (isHydrated && isAuthenticated && accessToken) {
      loadTenants()
    }
  }, [isHydrated, isAuthenticated, accessToken, loadTenants])

  const handleToggleStatus = async (tenant: Tenant) => {
    if (!accessToken) return
    setToggling(tenant.id)
    try {
      await adminApi.toggleCompanyStatus(accessToken, tenant.id, !tenant.is_active)
      await loadTenants()
    } catch (err) {
      console.error('Failed to toggle status:', getErrorMessage(err))
    } finally {
      setToggling(null)
    }
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      loadTenants()
    }, 300)
    return () => clearTimeout(timer)
  }, [search, statusFilter])

  return (
    <AppShell>
      <BrandHero
        title="Empresas en la Plataforma"
        subtitle={`${data?.total || 0} empresas registradas`}
        size="sm"
      />

      <div className="container mx-auto px-4 py-6">
        <BrandCard>
          {/* Filters */}
          <div className="p-4 border-b flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="suspended">Suspendidas</option>
            </select>
            <button
              onClick={loadTenants}
              className="px-3 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Industria</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Usuarios</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Empleados</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Nóminas</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b animate-pulse">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data?.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      No se encontraron empresas
                    </td>
                  </tr>
                ) : (
                  data?.items.map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/platform/tenants/${tenant.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{tenant.name}</p>
                            <p className="text-xs text-gray-400">{tenant.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                        {tenant.industry || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="w-3 h-3 text-gray-400" />
                          {tenant.user_count}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">{tenant.employee_count}</td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          <FileText className="w-3 h-3 text-gray-400" />
                          {tenant.payroll_run_count}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tenant.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" /> Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <XCircle className="w-3 h-3" /> Suspendida
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleStatus(tenant)}
                          disabled={toggling === tenant.id}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            tenant.is_active
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          } disabled:opacity-50`}
                        >
                          {toggling === tenant.id ? '...' : tenant.is_active ? 'Suspender' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total_pages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Mostrando {((data.page - 1) * data.page_size) + 1}—{Math.min(data.page * data.page_size, data.total)} de {data.total}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(Math.min(data.total_pages, page + 1))}
                  disabled={page >= data.total_pages}
                  className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </BrandCard>
      </div>
    </AppShell>
  )
}
