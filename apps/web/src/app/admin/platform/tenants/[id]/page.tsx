'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
  ArrowLeft,
  CheckCircle,
  XCircle,
  Globe,
  Calendar,
  Briefcase,
} from 'lucide-react'

interface CompanyDetail {
  id: string
  name: string
  slug: string
  industry: string | null
  size: string | null
  is_active: boolean
  is_client: boolean
  website: string | null
  description: string | null
  created_at: string | null
  user_count: number
  employee_count: number
  payroll_run_count: number
}

export default function TenantDetailPage() {
  const router = useRouter()
  const params = useParams()
  const companyId = params.id as string
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) { router.push('/login'); return }
    if (!isAdmin()) { router.push('/dashboard'); return }
    loadCompany()
  }, [isHydrated, isAuthenticated, accessToken, router, companyId])

  const loadCompany = async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const data = await adminApi.getCompanyDetail(accessToken, companyId)
      setCompany(data)
    } catch (err) {
      console.error('Failed to load company:', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!accessToken || !company) return
    setToggling(true)
    try {
      await adminApi.toggleCompanyStatus(accessToken, companyId, !company.is_active)
      await loadCompany()
    } catch (err) {
      console.error('Failed to toggle status:', getErrorMessage(err))
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <BrandHero title="Cargando..." size="sm" />
        <div className="container mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        </div>
      </AppShell>
    )
  }

  if (!company) {
    return (
      <AppShell>
        <BrandHero title="Empresa no encontrada" size="sm" />
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-gray-500 mb-4">La empresa solicitada no existe.</p>
          <button
            onClick={() => router.push('/admin/platform/tenants')}
            className="text-blue-600 hover:underline"
          >
            Volver a la lista
          </button>
        </div>
      </AppShell>
    )
  }

  const statCards = [
    { label: 'Usuarios', value: company.user_count, icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Empleados', value: company.employee_count, icon: Briefcase, color: 'bg-green-100 text-green-600' },
    { label: 'Nóminas', value: company.payroll_run_count, icon: FileText, color: 'bg-purple-100 text-purple-600' },
  ]

  return (
    <AppShell>
      <BrandHero
        title={company.name}
        subtitle={company.industry || 'Sin industria definida'}
        size="sm"
      />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push('/admin/platform/tenants')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a empresas
        </button>

        {/* Company Info + Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <BrandCard>
              <BrandCardHeader title="Información General" />
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Nombre</label>
                    <p className="font-medium">{company.name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Slug</label>
                    <p className="font-mono text-sm">{company.slug}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Industria</label>
                    <p>{company.industry || '—'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Tamaño</label>
                    <p>{company.size || '—'}</p>
                  </div>
                  {company.website && (
                    <div className="sm:col-span-2">
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Sitio Web</label>
                      <p className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {company.website}
                      </p>
                    </div>
                  )}
                  {company.description && (
                    <div className="sm:col-span-2">
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Descripción</label>
                      <p className="text-sm text-gray-600">{company.description}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Registrada</label>
                    <p className="flex items-center gap-1 text-sm">
                      <Calendar className="w-3 h-3" />
                      {company.created_at
                        ? new Date(company.created_at).toLocaleDateString('es-SV')
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Tipo</label>
                    <p>{company.is_client ? 'Cliente (Outsourcing)' : 'Empresa directa'}</p>
                  </div>
                </div>
              </div>
            </BrandCard>
          </div>

          {/* Status Card */}
          <div className="space-y-4">
            <BrandCard>
              <BrandCardHeader title="Estado" />
              <div className="p-4 text-center space-y-4">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                  company.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {company.is_active
                    ? <><CheckCircle className="w-4 h-4" /> Activa</>
                    : <><XCircle className="w-4 h-4" /> Suspendida</>
                  }
                </div>
                <button
                  onClick={handleToggleStatus}
                  disabled={toggling}
                  className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    company.is_active
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } disabled:opacity-50`}
                >
                  {toggling ? 'Procesando...' : company.is_active ? 'Suspender Empresa' : 'Activar Empresa'}
                </button>
              </div>
            </BrandCard>

            {/* Stat Cards */}
            {statCards.map((stat) => (
              <div key={stat.label} className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
