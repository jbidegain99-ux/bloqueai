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
  Building2,
  Briefcase,
  Plus,
  Filter,
  Edit2,
  Calendar,
  AlertCircle,
  CheckCircle,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  DollarSign,
  FileText,
} from 'lucide-react'

interface Placement {
  id: string
  candidate_id: string
  candidate_name: string | null
  client_id: string
  client_name: string | null
  job_id: string | null
  job_title: string | null
  position_title: string
  department: string | null
  location: string | null
  placement_type: string
  status: string
  start_date: string | null
  end_date: string | null
  salary_amount: number | null
  salary_currency: string | null
  salary_period: string | null
  notes: string | null
  created_at: string
}

interface FilterOptions {
  clients: Array<{ id: string; name: string }>
  statuses: string[]
  types: string[]
}

interface Filters {
  client_id?: string
  status_filter?: string
  type_filter?: string
  date_from?: string
  date_to?: string
}

interface PlacementFormData {
  candidate_id: string
  client_id: string
  position_title: string
  placement_type: string
  department: string
  location: string
  start_date: string
  end_date: string
  salary_amount: string
  salary_currency: string
  salary_period: string
  notes: string
}

interface ReportSummary {
  active_placements: number
  completed_in_period: number
}

const PLACEMENT_TYPES = [
  { value: 'DIRECT_HIRE', label: 'Contratacion Directa' },
  { value: 'CONTRACT', label: 'Contrato' },
  { value: 'CONTRACT_TO_HIRE', label: 'Contrato a Permanente' },
  { value: 'OUTSOURCING', label: 'Outsourcing' },
  { value: 'FREELANCE', label: 'Freelance' },
]

const PLACEMENT_STATUSES = [
  { value: 'PENDING', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'ACTIVE', label: 'Activo', color: 'bg-green-100 text-green-700' },
  { value: 'ON_HOLD', label: 'En Pausa', color: 'bg-blue-100 text-blue-700' },
  { value: 'COMPLETED', label: 'Completado', color: 'bg-gray-100 text-gray-700' },
  { value: 'TERMINATED', label: 'Terminado', color: 'bg-red-100 text-red-700' },
  { value: 'CANCELLED', label: 'Cancelado', color: 'bg-red-100 text-red-700' },
]

const SALARY_PERIODS = [
  { value: 'hourly', label: 'Por hora' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'annual', label: 'Anual' },
]

export default function PlacementsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [placements, setPlacements] = useState<Placement[]>([])
  const [loading, setLoading] = useState(true)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [filters, setFilters] = useState<Filters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Summary/report data
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [thisMonthCount, setThisMonthCount] = useState(0)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null)

  // Form state
  const [formData, setFormData] = useState<PlacementFormData>({
    candidate_id: '',
    client_id: '',
    position_title: '',
    placement_type: 'DIRECT_HIRE',
    department: '',
    location: '',
    start_date: '',
    end_date: '',
    salary_amount: '',
    salary_currency: 'USD',
    salary_period: 'monthly',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

    loadPlacements()
    loadReport()
  }, [isHydrated, isAuthenticated, accessToken, router, page])

  const loadPlacements = async (currentFilters?: Filters) => {
    if (!accessToken) return
    setLoading(true)
    try {
      const data = await adminApi.getPlacements(accessToken, {
        ...currentFilters || filters,
        page,
        page_size: 20,
      })
      setPlacements(data.items)
      setTotalPages(data.total_pages)
      setTotal(data.total)
      setFilterOptions(data.filter_options)
    } catch (err) {
      console.error('Error loading placements:', err)
      setMessage({ type: 'error', text: 'Error al cargar placements' })
    } finally {
      setLoading(false)
    }
  }

  const loadReport = async () => {
    if (!accessToken) return
    try {
      const data = await adminApi.getPlacementsReport(accessToken, {})
      setSummary(data.summary)

      // Get this month count
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const monthData = await adminApi.getPlacementsReport(accessToken, {
        date_from: firstOfMonth,
      })
      setThisMonthCount(monthData.summary.active_placements + monthData.summary.completed_in_period)
    } catch (err) {
      console.error('Error loading report:', err)
    }
  }

  const handleFilterChange = (key: keyof Filters, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined }
    setFilters(newFilters)
  }

  const applyFilters = () => {
    setPage(1)
    loadPlacements(filters)
  }

  const clearFilters = () => {
    setFilters({})
    setPage(1)
    loadPlacements({})
  }

  const openCreateModal = () => {
    setFormData({
      candidate_id: '',
      client_id: '',
      position_title: '',
      placement_type: 'DIRECT_HIRE',
      department: '',
      location: '',
      start_date: '',
      end_date: '',
      salary_amount: '',
      salary_currency: 'USD',
      salary_period: 'monthly',
      notes: '',
    })
    setShowCreateModal(true)
  }

  const openEditModal = (placement: Placement) => {
    setSelectedPlacement(placement)
    setFormData({
      candidate_id: placement.candidate_id,
      client_id: placement.client_id,
      position_title: placement.position_title,
      placement_type: placement.placement_type,
      department: placement.department || '',
      location: placement.location || '',
      start_date: placement.start_date || '',
      end_date: placement.end_date || '',
      salary_amount: placement.salary_amount?.toString() || '',
      salary_currency: placement.salary_currency || 'USD',
      salary_period: placement.salary_period || 'monthly',
      notes: placement.notes || '',
    })
    setShowEditModal(true)
  }

  const handleCreatePlacement = async () => {
    if (!accessToken || !formData.candidate_id || !formData.client_id || !formData.position_title) {
      setMessage({ type: 'error', text: 'Por favor completa los campos requeridos' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      await adminApi.createPlacement(accessToken, {
        candidate_id: formData.candidate_id,
        client_id: formData.client_id,
        position_title: formData.position_title,
        placement_type: formData.placement_type,
        department: formData.department || undefined,
        location: formData.location || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        salary_amount: formData.salary_amount ? parseFloat(formData.salary_amount) : undefined,
        salary_currency: formData.salary_currency || undefined,
        salary_period: formData.salary_period || undefined,
        notes: formData.notes || undefined,
      })
      setMessage({ type: 'success', text: 'Placement creado exitosamente' })
      setShowCreateModal(false)
      loadPlacements()
      loadReport()
    } catch (err: any) {
      console.error('Error creating placement:', err)
      setMessage({ type: 'error', text: err.message || 'Error al crear placement' })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePlacement = async (newStatus?: string) => {
    if (!accessToken || !selectedPlacement) return

    setSaving(true)
    setMessage(null)

    try {
      const updateData: any = {}
      if (newStatus) {
        updateData.status = newStatus
      } else {
        updateData.position_title = formData.position_title
        updateData.department = formData.department
        updateData.location = formData.location
        updateData.placement_type = formData.placement_type
        updateData.start_date = formData.start_date
        updateData.end_date = formData.end_date
        updateData.salary_amount = formData.salary_amount ? parseFloat(formData.salary_amount) : undefined
        updateData.salary_currency = formData.salary_currency
        updateData.salary_period = formData.salary_period
        updateData.notes = formData.notes
      }

      await adminApi.updatePlacement(accessToken, selectedPlacement.id, updateData)
      setMessage({ type: 'success', text: 'Placement actualizado exitosamente' })
      setShowEditModal(false)
      loadPlacements()
      loadReport()
    } catch (err: any) {
      console.error('Error updating placement:', err)
      setMessage({ type: 'error', text: err.message || 'Error al actualizar placement' })
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = PLACEMENT_STATUSES.find(s => s.value === status)
    return statusConfig ? (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
        {statusConfig.label}
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        {status}
      </span>
    )
  }

  const getTypeBadge = (type: string) => {
    const typeConfig = PLACEMENT_TYPES.find(t => t.value === type)
    const colors: Record<string, string> = {
      'DIRECT_HIRE': 'bg-purple-100 text-purple-700',
      'CONTRACT': 'bg-blue-100 text-blue-700',
      'CONTRACT_TO_HIRE': 'bg-indigo-100 text-indigo-700',
      'OUTSOURCING': 'bg-orange-100 text-orange-700',
      'FREELANCE': 'bg-teal-100 text-teal-700',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-600'}`}>
        {typeConfig?.label || type}
      </span>
    )
  }

  if (!isHydrated || !isAuthenticated) return null

  return (
    <AppShell>
      <BrandHero
        title="Gestion de Placements"
        subtitle="Administra las colocaciones de candidatos en clientes"
        size="sm"
      />

      {message && (
        <div className={`mt-4 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-auto p-1 hover:bg-white/50 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        <BrandCard>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Placements</p>
              <p className="text-2xl font-bold text-bloque-navy900">{total}</p>
            </div>
          </div>
        </BrandCard>

        <BrandCard>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Activos</p>
              <p className="text-2xl font-bold text-bloque-navy900">
                {summary?.active_placements || 0}
              </p>
            </div>
          </div>
        </BrandCard>

        <BrandCard>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-bloque-gold500/20 rounded-lg">
              <Calendar className="h-6 w-6 text-bloque-gold500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Este Mes</p>
              <p className="text-2xl font-bold text-bloque-navy900">{thisMonthCount}</p>
            </div>
          </div>
        </BrandCard>
      </div>

      {/* Filters and Actions */}
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
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-bloque-gold500 text-bloque-navy900 rounded-lg hover:bg-bloque-gold400 transition-colors font-medium"
            >
              <Plus className="h-4 w-4" />
              Nuevo Placement
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t grid md:grid-cols-3 lg:grid-cols-5 gap-4">
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

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Estado
                </label>
                <select
                  value={filters.status_filter || ''}
                  onChange={(e) => handleFilterChange('status_filter', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500"
                >
                  <option value="">Todos</option>
                  {PLACEMENT_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Tipo
                </label>
                <select
                  value={filters.type_filter || ''}
                  onChange={(e) => handleFilterChange('type_filter', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500"
                >
                  <option value="">Todos</option>
                  {PLACEMENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
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
              <div className="flex items-end gap-2 md:col-span-3 lg:col-span-5">
                <button
                  onClick={applyFilters}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-bloque-navy900 text-white rounded-lg hover:bg-bloque-navy800 transition-colors disabled:opacity-50"
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

      {/* Placements List */}
      <div className="mt-6">
        <BrandCard>
          <BrandCardHeader
            title={`Placements (${total})`}
            description="Lista de todas las colocaciones"
          />

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : placements.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No se encontraron placements</p>
              <button
                onClick={openCreateModal}
                className="mt-4 text-bloque-gold500 hover:text-bloque-gold400 font-medium"
              >
                Crear primer placement
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Candidato</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Puesto</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Inicio</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Estado</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placements.map((placement) => (
                      <tr key={placement.id} className="border-b hover:bg-bloque-gray50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-bloque-navy900 rounded-full flex items-center justify-center text-white font-semibold">
                              {(placement.candidate_name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-bloque-navy900">
                                {placement.candidate_name || 'Sin nombre'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{placement.client_name || '-'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-bloque-navy900">{placement.position_title}</p>
                            {placement.job_title && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                {placement.job_title}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {getTypeBadge(placement.placement_type)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(placement.start_date)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(placement.status)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(placement)}
                              className="p-2 text-muted-foreground hover:text-bloque-navy900 hover:bg-bloque-gray50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Pagina {page} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="p-2 border rounded-lg hover:bg-bloque-gray50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      className="p-2 border rounded-lg hover:bg-bloque-gray50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </BrandCard>
      </div>

      {/* Create Placement Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} title="Nuevo Placement">
          <PlacementForm
            formData={formData}
            setFormData={setFormData}
            filterOptions={filterOptions}
            onSubmit={handleCreatePlacement}
            onCancel={() => setShowCreateModal(false)}
            saving={saving}
            submitLabel="Crear Placement"
            isCreate={true}
          />
        </Modal>
      )}

      {/* Edit Placement Modal */}
      {showEditModal && selectedPlacement && (
        <Modal onClose={() => setShowEditModal(false)} title={`Editar: ${selectedPlacement.position_title}`}>
          <PlacementForm
            formData={formData}
            setFormData={setFormData}
            filterOptions={filterOptions}
            onSubmit={() => handleUpdatePlacement()}
            onCancel={() => setShowEditModal(false)}
            saving={saving}
            submitLabel="Guardar Cambios"
            isCreate={false}
          />
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium text-bloque-navy900 mb-3">Cambiar Estado</p>
            <div className="flex flex-wrap gap-2">
              {PLACEMENT_STATUSES.map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleUpdatePlacement(status.value)}
                  disabled={saving || selectedPlacement.status === status.value}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    selectedPlacement.status === status.value
                      ? 'bg-bloque-navy900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  )
}

// Modal Component
function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode
  onClose: () => void
  title: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-bloque-navy900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bloque-gray50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// Placement Form Component
function PlacementForm({
  formData,
  setFormData,
  filterOptions,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
  isCreate,
}: {
  formData: PlacementFormData
  setFormData: (data: PlacementFormData) => void
  filterOptions: FilterOptions | null
  onSubmit: () => void
  onCancel: () => void
  saving: boolean
  submitLabel: string
  isCreate: boolean
}) {
  return (
    <div className="space-y-4">
      {isCreate && (
        <>
          {/* Candidate ID */}
          <div>
            <label className="block text-sm font-medium text-bloque-navy900 mb-1">
              ID Candidato <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.candidate_id}
              onChange={(e) => setFormData({ ...formData, candidate_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent font-mono text-sm"
              placeholder="UUID del candidato"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ingresa el UUID del candidato
            </p>
          </div>

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-bloque-navy900 mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
            >
              <option value="">Seleccionar cliente...</option>
              {filterOptions?.clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Position Title */}
      <div>
        <label className="block text-sm font-medium text-bloque-navy900 mb-1">
          Titulo del Puesto <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.position_title}
          onChange={(e) => setFormData({ ...formData, position_title: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
          placeholder="Ej: Desarrollador Senior"
        />
      </div>

      {/* Placement Type */}
      <div>
        <label className="block text-sm font-medium text-bloque-navy900 mb-1">
          Tipo de Placement <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.placement_type}
          onChange={(e) => setFormData({ ...formData, placement_type: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
        >
          {PLACEMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Department */}
        <div>
          <label className="block text-sm font-medium text-bloque-navy900 mb-1">
            Departamento
          </label>
          <input
            type="text"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
            placeholder="Ej: Tecnologia"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-bloque-navy900 mb-1">
            Ubicacion
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
            placeholder="Ej: Ciudad de Mexico"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-bloque-navy900 mb-1">
            Fecha de Inicio
          </label>
          <input
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium text-bloque-navy900 mb-1">
            Fecha de Fin
          </label>
          <input
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Dejar vacio para placements permanentes
          </p>
        </div>
      </div>

      {/* Salary Section */}
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-bloque-navy900 mb-1">
            Salario
          </label>
          <input
            type="number"
            value={formData.salary_amount}
            onChange={(e) => setFormData({ ...formData, salary_amount: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
            placeholder="Monto"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-bloque-navy900 mb-1">
            Moneda
          </label>
          <select
            value={formData.salary_currency}
            onChange={(e) => setFormData({ ...formData, salary_currency: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
          >
            <option value="USD">USD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-bloque-navy900 mb-1">
            Periodo
          </label>
          <select
            value={formData.salary_period}
            onChange={(e) => setFormData({ ...formData, salary_period: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
          >
            {SALARY_PERIODS.map((period) => (
              <option key={period.value} value={period.value}>{period.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-bloque-navy900 mb-1">
          Notas
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
          placeholder="Notas adicionales sobre el placement..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border rounded-lg hover:bg-bloque-gray50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onSubmit}
          disabled={saving || (isCreate && (!formData.candidate_id || !formData.client_id || !formData.position_title))}
          className="flex-1 px-4 py-2 bg-bloque-navy900 text-white rounded-lg hover:bg-bloque-navy800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
