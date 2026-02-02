'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { useAuthStore, isRecruiter } from '@/lib/auth'
import { adminApi } from '@/lib/api'
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Toggle,
  Briefcase,
  AlertCircle,
  CheckCircle,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'

interface Client {
  id: string
  name: string
  slug: string
  description: string | null
  website: string | null
  industry: string | null
  size: string | null
  logo_url: string | null
  is_active: boolean
  is_client: boolean
  client_code: string | null
  match_threshold: number | null
  created_at: string
  updated_at: string
  job_count: number
}

interface ClientJob {
  id: string
  title: string
  status: string
  category: string | null
  seniority: string | null
  location: string | null
  modality: string | null
  created_at: string
}

interface ClientFormData {
  name: string
  description: string
  website: string
  industry: string
  size: string
  client_code: string
  match_threshold: string
}

const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 empleados' },
  { value: '11-50', label: '11-50 empleados' },
  { value: '51-200', label: '51-200 empleados' },
  { value: '201-500', label: '201-500 empleados' },
  { value: '501-1000', label: '501-1000 empleados' },
  { value: '1001-5000', label: '1001-5000 empleados' },
  { value: '5000+', label: '5000+ empleados' },
]

const INDUSTRIES = [
  'Tecnologia',
  'Salud',
  'Legal',
  'Finanzas',
  'Manufactura',
  'Educacion',
  'Retail',
  'Construccion',
  'Dental',
  'Hospitality',
  'Logistica',
  'Otro',
]

export default function ClientsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated } = useAuthStore()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNonClients, setShowNonClients] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showJobsModal, setShowJobsModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientJobs, setClientJobs] = useState<ClientJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)

  // Form state
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    description: '',
    website: '',
    industry: '',
    size: '',
    client_code: '',
    match_threshold: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isRecruiter()) {
      router.push('/dashboard')
      return
    }

    loadClients()
  }, [isAuthenticated, accessToken, router, page, showNonClients])

  const loadClients = async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const data = await adminApi.getClients(accessToken, {
        include_non_clients: showNonClients,
        search: search || undefined,
        page,
        page_size: 20,
      })
      setClients(data.items)
      setTotalPages(data.total_pages)
      setTotal(data.total)
    } catch (err) {
      console.error('Error loading clients:', err)
      setMessage({ type: 'error', text: 'Error al cargar clientes' })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    loadClients()
  }

  const openCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      website: '',
      industry: '',
      size: '',
      client_code: '',
      match_threshold: '',
    })
    setShowCreateModal(true)
  }

  const openEditModal = (client: Client) => {
    setSelectedClient(client)
    setFormData({
      name: client.name,
      description: client.description || '',
      website: client.website || '',
      industry: client.industry || '',
      size: client.size || '',
      client_code: client.client_code || '',
      match_threshold: client.match_threshold?.toString() || '',
    })
    setShowEditModal(true)
  }

  const openJobsModal = async (client: Client) => {
    setSelectedClient(client)
    setShowJobsModal(true)
    setLoadingJobs(true)
    try {
      const data = await adminApi.getClientJobs(accessToken!, client.id)
      setClientJobs(data.items)
    } catch (err) {
      console.error('Error loading client jobs:', err)
    } finally {
      setLoadingJobs(false)
    }
  }

  const handleCreateClient = async () => {
    if (!accessToken || !formData.name.trim()) return

    setSaving(true)
    setMessage(null)

    try {
      await adminApi.createClient(accessToken, {
        name: formData.name,
        description: formData.description || undefined,
        website: formData.website || undefined,
        industry: formData.industry || undefined,
        size: formData.size || undefined,
        client_code: formData.client_code || undefined,
        match_threshold: formData.match_threshold ? parseInt(formData.match_threshold) : undefined,
      })
      setMessage({ type: 'success', text: 'Cliente creado exitosamente' })
      setShowCreateModal(false)
      loadClients()
    } catch (err: any) {
      console.error('Error creating client:', err)
      setMessage({ type: 'error', text: err.message || 'Error al crear cliente' })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateClient = async () => {
    if (!accessToken || !selectedClient) return

    setSaving(true)
    setMessage(null)

    try {
      await adminApi.updateClient(accessToken, selectedClient.id, {
        name: formData.name || undefined,
        description: formData.description,
        website: formData.website,
        industry: formData.industry,
        size: formData.size,
        client_code: formData.client_code,
        match_threshold: formData.match_threshold ? parseInt(formData.match_threshold) : undefined,
      })
      setMessage({ type: 'success', text: 'Cliente actualizado exitosamente' })
      setShowEditModal(false)
      loadClients()
    } catch (err: any) {
      console.error('Error updating client:', err)
      setMessage({ type: 'error', text: err.message || 'Error al actualizar cliente' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleClient = async (client: Client) => {
    if (!accessToken) return

    try {
      await adminApi.updateClient(accessToken, client.id, {
        is_client: !client.is_client,
      })
      setMessage({ type: 'success', text: `${client.name} ${!client.is_client ? 'marcado como cliente' : 'desmarcado como cliente'}` })
      loadClients()
    } catch (err: any) {
      console.error('Error toggling client status:', err)
      setMessage({ type: 'error', text: err.message || 'Error al actualizar estado' })
    }
  }

  const handleToggleActive = async (client: Client) => {
    if (!accessToken) return

    try {
      await adminApi.updateClient(accessToken, client.id, {
        is_active: !client.is_active,
      })
      setMessage({ type: 'success', text: `${client.name} ${!client.is_active ? 'activado' : 'desactivado'}` })
      loadClients()
    } catch (err: any) {
      console.error('Error toggling active status:', err)
      setMessage({ type: 'error', text: err.message || 'Error al actualizar estado' })
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <BrandHero
        title="Gestion de Clientes"
        subtitle="Administra las empresas marcadas como clientes"
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

      {/* Filters and Actions */}
      <div className="mt-6">
        <BrandCard>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Search */}
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Buscar por nombre o codigo..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-bloque-navy900 text-white rounded-lg hover:bg-bloque-navy800 transition-colors"
              >
                Buscar
              </button>
            </div>

            {/* Toggle show non-clients */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showNonClients}
                onChange={(e) => {
                  setShowNonClients(e.target.checked)
                  setPage(1)
                }}
                className="w-4 h-4 rounded border-gray-300 text-bloque-gold500 focus:ring-bloque-gold500"
              />
              <span className="text-sm text-muted-foreground">Mostrar todas las empresas</span>
            </label>

            {/* Create button */}
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-bloque-gold500 text-bloque-navy900 rounded-lg hover:bg-bloque-gold400 transition-colors font-medium"
            >
              <Plus className="h-4 w-4" />
              Nuevo Cliente
            </button>
          </div>
        </BrandCard>
      </div>

      {/* Clients List */}
      <div className="mt-6">
        <BrandCard>
          <BrandCardHeader
            title={`Clientes (${total})`}
            description={showNonClients ? 'Mostrando todas las empresas' : 'Mostrando solo clientes'}
          />

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No se encontraron clientes</p>
              <button
                onClick={openCreateModal}
                className="mt-4 text-bloque-gold500 hover:text-bloque-gold400 font-medium"
              >
                Crear primer cliente
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nombre</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Codigo</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Threshold</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Trabajos</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Creado</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Estado</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id} className="border-b hover:bg-bloque-gray50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-bloque-navy900 rounded-lg flex items-center justify-center text-white font-semibold">
                              {client.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-bloque-navy900">{client.name}</p>
                              {client.industry && (
                                <p className="text-sm text-muted-foreground">{client.industry}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {client.client_code ? (
                            <code className="px-2 py-1 bg-bloque-gray50 rounded text-sm font-mono">
                              {client.client_code}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {client.match_threshold !== null ? (
                            <span className="font-medium">{client.match_threshold}%</span>
                          ) : (
                            <span className="text-muted-foreground">Por defecto</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => openJobsModal(client)}
                            className="flex items-center gap-1 text-bloque-navy900 hover:text-bloque-gold500 transition-colors"
                          >
                            <Briefcase className="h-4 w-4" />
                            <span className="font-medium">{client.job_count}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {formatDate(client.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {client.is_client ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                Cliente
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                                Empresa
                              </span>
                            )}
                            {!client.is_active && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                Inactivo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(client)}
                              className="p-2 text-muted-foreground hover:text-bloque-navy900 hover:bg-bloque-gray50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleClient(client)}
                              className={`p-2 rounded-lg transition-colors ${
                                client.is_client
                                  ? 'text-green-600 hover:bg-green-50'
                                  : 'text-muted-foreground hover:bg-bloque-gray50'
                              }`}
                              title={client.is_client ? 'Desmarcar como cliente' : 'Marcar como cliente'}
                            >
                              <Toggle className="h-4 w-4" />
                            </button>
                            {client.website && (
                              <a
                                href={client.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-muted-foreground hover:text-bloque-navy900 hover:bg-bloque-gray50 rounded-lg transition-colors"
                                title="Visitar sitio web"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
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

      {/* Create Client Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} title="Nuevo Cliente">
          <ClientForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleCreateClient}
            onCancel={() => setShowCreateModal(false)}
            saving={saving}
            submitLabel="Crear Cliente"
          />
        </Modal>
      )}

      {/* Edit Client Modal */}
      {showEditModal && selectedClient && (
        <Modal onClose={() => setShowEditModal(false)} title={`Editar: ${selectedClient.name}`}>
          <ClientForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdateClient}
            onCancel={() => setShowEditModal(false)}
            saving={saving}
            submitLabel="Guardar Cambios"
          />
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-bloque-navy900">Estado del cliente</p>
                <p className="text-sm text-muted-foreground">
                  {selectedClient.is_active ? 'Activo' : 'Inactivo'}
                </p>
              </div>
              <button
                onClick={() => {
                  handleToggleActive(selectedClient)
                  setShowEditModal(false)
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedClient.is_active
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {selectedClient.is_active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Jobs Modal */}
      {showJobsModal && selectedClient && (
        <Modal onClose={() => setShowJobsModal(false)} title={`Trabajos de ${selectedClient.name}`}>
          {loadingJobs ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : clientJobs.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Este cliente no tiene trabajos</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {clientJobs.map((job) => (
                <div key={job.id} className="p-3 bg-bloque-gray50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-bloque-navy900">{job.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        {job.category && <span>{job.category}</span>}
                        {job.location && <span>- {job.location}</span>}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      job.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : job.status === 'DRAFT'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Creado: {formatDate(job.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t flex justify-end">
            <button
              onClick={() => setShowJobsModal(false)}
              className="px-4 py-2 border rounded-lg hover:bg-bloque-gray50 transition-colors"
            >
              Cerrar
            </button>
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
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
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

// Client Form Component
function ClientForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
}: {
  formData: ClientFormData
  setFormData: (data: ClientFormData) => void
  onSubmit: () => void
  onCancel: () => void
  saving: boolean
  submitLabel: string
}) {
  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-bloque-navy900 mb-1">
          Nombre <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
          placeholder="Nombre de la empresa"
        />
      </div>

      {/* Client Code */}
      <div>
        <label className="block text-sm font-medium text-bloque-navy900 mb-1">
          Codigo de Cliente
        </label>
        <input
          type="text"
          value={formData.client_code}
          onChange={(e) => setFormData({ ...formData, client_code: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent font-mono"
          placeholder="Ej: CLI-001"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Identificador unico para el cliente
        </p>
      </div>

      {/* Match Threshold */}
      <div>
        <label className="block text-sm font-medium text-bloque-navy900 mb-1">
          Threshold de Match
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            value={formData.match_threshold}
            onChange={(e) => setFormData({ ...formData, match_threshold: e.target.value })}
            className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
            placeholder="70"
          />
          <span className="text-muted-foreground">%</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Dejar vacio para usar el threshold del sistema
        </p>
      </div>

      {/* Industry */}
      <div>
        <label className="block text-sm font-medium text-bloque-navy900 mb-1">
          Industria
        </label>
        <select
          value={formData.industry}
          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
        >
          <option value="">Seleccionar...</option>
          {INDUSTRIES.map((industry) => (
            <option key={industry} value={industry}>{industry}</option>
          ))}
        </select>
      </div>

      {/* Size */}
      <div>
        <label className="block text-sm font-medium text-bloque-navy900 mb-1">
          Tamano
        </label>
        <select
          value={formData.size}
          onChange={(e) => setFormData({ ...formData, size: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
        >
          <option value="">Seleccionar...</option>
          {COMPANY_SIZES.map((size) => (
            <option key={size.value} value={size.value}>{size.label}</option>
          ))}
        </select>
      </div>

      {/* Website */}
      <div>
        <label className="block text-sm font-medium text-bloque-navy900 mb-1">
          Sitio Web
        </label>
        <input
          type="url"
          value={formData.website}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
          placeholder="https://ejemplo.com"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-bloque-navy900 mb-1">
          Descripcion
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent"
          placeholder="Descripcion de la empresa..."
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
          disabled={saving || !formData.name.trim()}
          className="flex-1 px-4 py-2 bg-bloque-navy900 text-white rounded-lg hover:bg-bloque-navy800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
