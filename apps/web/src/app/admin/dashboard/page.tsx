'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { useAuthStore, isRecruiter } from '@/lib/auth'
import { adminApi } from '@/lib/api'
import {
  Users,
  FileCheck,
  MessageSquare,
  CheckCircle,
  Download,
  Filter,
  RefreshCw,
  TrendingUp,
  Target,
  BarChart3,
} from 'lucide-react'

interface DashboardMetrics {
  total_applications: number
  above_threshold: number
  interviews_started: number
  interviews_completed: number
  shortlisted: number
  avg_match_score: number | null
  avg_interview_score: number | null
}

interface FilterOptions {
  clients: Array<{ id: string; name: string }>
  jobs: Array<{ id: string; title: string }>
  categories: string[]
  locations: string[]
}

interface Filters {
  client_id?: string
  job_id?: string
  category?: string
  location?: string
  date_from?: string
  date_to?: string
  status?: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [filters, setFilters] = useState<Filters>({})
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isRecruiter()) {
      router.push('/dashboard')
      return
    }

    loadMetrics()
  }, [isHydrated, isAuthenticated, accessToken, router])

  const loadMetrics = async (currentFilters?: Filters) => {
    if (!accessToken) return
    setLoading(true)
    try {
      const data = await adminApi.getDashboardMetrics(accessToken, currentFilters || filters)
      setMetrics(data.metrics)
      setFilterOptions(data.filter_options)
    } catch (err) {
      console.error('Error loading metrics:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: keyof Filters, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined }
    setFilters(newFilters)
  }

  const applyFilters = () => {
    loadMetrics(filters)
  }

  const clearFilters = () => {
    setFilters({})
    loadMetrics({})
  }

  const handleExport = async () => {
    if (!accessToken) return
    setExporting(true)
    setExportMessage({ type: 'success', text: 'Descarga iniciada...' })
    try {
      await adminApi.exportDashboard(accessToken, filters)
      setExportMessage({ type: 'success', text: 'Descarga exitosa' })
      setTimeout(() => setExportMessage(null), 3000)
    } catch (err) {
      console.error('Error exporting:', err)
      setExportMessage({ type: 'error', text: 'Error al exportar CSV' })
      setTimeout(() => setExportMessage(null), 5000)
    } finally {
      setExporting(false)
    }
  }

  const formatPercent = (current: number, total: number) => {
    if (total === 0) return '0%'
    return `${((current / total) * 100).toFixed(1)}%`
  }

  if (!isHydrated || !isAuthenticated) return null

  if (loading && !metrics) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Cargando metricas...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <BrandHero
        title="Dashboard de Reclutamiento"
        subtitle="Metricas y analisis con filtros avanzados"
        size="sm"
      />

      {/* Filter Controls */}
      <div className="mt-6">
        <BrandCard>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-bloque-navy900 font-medium"
            >
              <Filter className="h-5 w-5" />
              {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
            </button>
            <div className="flex items-center gap-2">
              {exportMessage && (
                <span className={`text-sm px-3 py-1 rounded-full ${
                  exportMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {exportMessage.text}
                </span>
              )}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-bloque-gold500 text-bloque-navy900 rounded-lg hover:bg-bloque-gold400 transition-colors disabled:opacity-50"
              >
                {exporting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Exportar CSV
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Client Filter */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Cliente
                </label>
                <select
                  value={filters.client_id || ''}
                  onChange={(e) => handleFilterChange('client_id', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500"
                >
                  <option value="">Todos</option>
                  {filterOptions?.clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Job Filter */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Puesto
                </label>
                <select
                  value={filters.job_id || ''}
                  onChange={(e) => handleFilterChange('job_id', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500"
                >
                  <option value="">Todos</option>
                  {filterOptions?.jobs.map(j => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Categoria
                </label>
                <select
                  value={filters.category || ''}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500"
                >
                  <option value="">Todas</option>
                  {filterOptions?.categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Ubicacion
                </label>
                <select
                  value={filters.location || ''}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500"
                >
                  <option value="">Todas</option>
                  {filterOptions?.locations.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => handleFilterChange('date_from', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => handleFilterChange('date_to', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500"
                />
              </div>

              {/* Apply/Clear */}
              <div className="flex items-end gap-2 md:col-span-2">
                <button
                  onClick={applyFilters}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-bloque-navy900 text-white rounded-lg hover:bg-bloque-navy800 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Filter className="h-4 w-4" />
                  )}
                  Aplicar
                </button>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}
        </BrandCard>
      </div>

      {/* Main Metrics */}
      <div className="mt-6 grid md:grid-cols-3 lg:grid-cols-5 gap-4">
        <BrandCard>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Aplicaciones</p>
              <p className="text-2xl font-bold text-bloque-navy900">
                {metrics?.total_applications || 0}
              </p>
            </div>
          </div>
        </BrandCard>

        <BrandCard>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sobre Threshold</p>
              <p className="text-2xl font-bold text-bloque-navy900">
                {metrics?.above_threshold || 0}
              </p>
            </div>
          </div>
        </BrandCard>

        <BrandCard>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <MessageSquare className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Entrevistas</p>
              <p className="text-2xl font-bold text-bloque-navy900">
                {metrics?.interviews_completed || 0}
                <span className="text-sm font-normal text-muted-foreground">
                  /{metrics?.interviews_started || 0}
                </span>
              </p>
            </div>
          </div>
        </BrandCard>

        <BrandCard>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-bloque-gold500/20 rounded-lg">
              <CheckCircle className="h-6 w-6 text-bloque-gold500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Shortlisted</p>
              <p className="text-2xl font-bold text-bloque-navy900">
                {metrics?.shortlisted || 0}
              </p>
            </div>
          </div>
        </BrandCard>

        <BrandCard>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Score Prom.</p>
              <p className="text-2xl font-bold text-bloque-navy900">
                {metrics?.avg_match_score?.toFixed(0) || '-'}
              </p>
            </div>
          </div>
        </BrandCard>
      </div>

      {/* Conversion Funnel */}
      <div className="mt-6 grid md:grid-cols-2 gap-6">
        <BrandCard>
          <BrandCardHeader
            title="Funnel de Conversion"
            description="Progresion de candidatos por etapa"
          />
          <div className="space-y-4 mt-4">
            {metrics && (
              <>
                <FunnelBar
                  label="Aplicaciones"
                  value={metrics.total_applications}
                  max={metrics.total_applications}
                  color="bg-blue-500"
                />
                <FunnelBar
                  label="Match > Threshold"
                  value={metrics.above_threshold}
                  max={metrics.total_applications}
                  color="bg-green-500"
                  percent={formatPercent(metrics.above_threshold, metrics.total_applications)}
                />
                <FunnelBar
                  label="Entrevista Iniciada"
                  value={metrics.interviews_started}
                  max={metrics.total_applications}
                  color="bg-purple-500"
                  percent={formatPercent(metrics.interviews_started, metrics.total_applications)}
                />
                <FunnelBar
                  label="Entrevista Completada"
                  value={metrics.interviews_completed}
                  max={metrics.total_applications}
                  color="bg-indigo-500"
                  percent={formatPercent(metrics.interviews_completed, metrics.total_applications)}
                />
                <FunnelBar
                  label="Shortlisted"
                  value={metrics.shortlisted}
                  max={metrics.total_applications}
                  color="bg-bloque-gold500"
                  percent={formatPercent(metrics.shortlisted, metrics.total_applications)}
                />
              </>
            )}
          </div>
        </BrandCard>

        <BrandCard>
          <BrandCardHeader
            title="Promedios de Calidad"
            description="Scores promedio de candidatos"
          />
          <div className="space-y-6 mt-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Match Score Promedio</span>
                <span className="font-bold text-bloque-navy900">
                  {metrics?.avg_match_score?.toFixed(1) || '-'}/100
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${metrics?.avg_match_score || 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Interview Score Promedio</span>
                <span className="font-bold text-bloque-navy900">
                  {metrics?.avg_interview_score?.toFixed(1) || '-'}/100
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${metrics?.avg_interview_score || 0}%` }}
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>
                  Conversion total: {' '}
                  <span className="font-semibold text-bloque-navy900">
                    {formatPercent(metrics?.shortlisted || 0, metrics?.total_applications || 0)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </BrandCard>
      </div>
    </AppShell>
  )
}

function FunnelBar({
  label,
  value,
  max,
  color,
  percent,
}: {
  label: string
  value: number
  max: number
  color: string
  percent?: string
}) {
  const width = max > 0 ? (value / max) * 100 : 0

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-bloque-navy900">
          {value}
          {percent && <span className="text-muted-foreground ml-1">({percent})</span>}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}
