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
  Plus,
  Search,
  ChevronRight,
  X,
  Save,
} from 'lucide-react'

interface Employee {
  id: string
  client_id: string
  client_name: string | null
  full_name: string
  email: string | null
  phone: string | null
  employee_code: string | null
  department: string | null
  position: string | null
  is_active: boolean
  hire_date: string | null
  active_contract: {
    contract_type: string | null
    base_salary: number | null
    currency: string | null
    pay_frequency: string | null
  } | null
}

interface ClientOption {
  id: string
  name: string
}

export default function PayrollEmployeesPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated } = useAuthStore()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '', email: '', phone: '', employee_code: '',
    department: '', position: '', hire_date: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return }
    if (!isRecruiter()) { router.push('/dashboard'); return }
    loadClients()
  }, [isAuthenticated, accessToken, router])

  const loadClients = async () => {
    if (!accessToken) return
    try {
      const data = await adminApi.getClients(accessToken, { is_active: true })
      const list = data.items.map((c) => ({ id: c.id, name: c.name }))
      setClients(list)
      if (list.length > 0) {
        setSelectedClient(list[0].id)
        await loadEmployees(list[0].id)
      }
    } catch (err) {
      console.error('Error loading clients:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadEmployees = async (clientId: string, searchTerm?: string) => {
    if (!accessToken || !clientId) return
    setLoading(true)
    try {
      const data = await payrollApi.getEmployees(accessToken, {
        client_id: clientId,
        search: searchTerm || undefined,
      })
      setEmployees(data)
    } catch (err) {
      console.error('Error loading employees:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId)
    loadEmployees(clientId, search)
  }

  const handleSearch = () => {
    loadEmployees(selectedClient, search)
  }

  const handleCreate = async () => {
    if (!accessToken || !selectedClient || !formData.full_name.trim()) return
    setSaving(true)
    try {
      await payrollApi.createEmployee(accessToken, {
        client_id: selectedClient,
        full_name: formData.full_name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        employee_code: formData.employee_code || undefined,
        department: formData.department || undefined,
        position: formData.position || undefined,
        hire_date: formData.hire_date || undefined,
      })
      setShowModal(false)
      setFormData({ full_name: '', email: '', phone: '', employee_code: '', department: '', position: '', hire_date: '' })
      loadEmployees(selectedClient)
    } catch (err) {
      console.error('Error creating employee:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <BrandHero title="Empleados" subtitle="Gestion de empleados de nomina" />

      <nav className="flex items-center gap-2 text-sm text-muted-foreground mt-4 mb-2">
        <Link href="/admin/dashboard" className="hover:text-bloque-navy900 transition-colors">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/admin/payroll/dashboard" className="hover:text-bloque-navy900 transition-colors">Nomina</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-bloque-navy900 font-medium">Empleados</span>
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

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-bloque-gold"
            />
            <button onClick={handleSearch} className="p-2 bg-bloque-navy900 text-white rounded-lg hover:bg-bloque-navy900/90">
              <Search className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="ml-auto flex items-center gap-2 bg-bloque-gold text-bloque-navy900 font-semibold px-4 py-2 rounded-lg hover:bg-bloque-gold/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Empleado
          </button>
        </div>

        {/* Table */}
        <BrandCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left p-3 font-medium text-gray-600">Codigo</th>
                  <th className="text-left p-3 font-medium text-gray-600">Departamento</th>
                  <th className="text-left p-3 font-medium text-gray-600">Puesto</th>
                  <th className="text-right p-3 font-medium text-gray-600">Salario</th>
                  <th className="text-center p-3 font-medium text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">Cargando...</td></tr>
                ) : employees.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">No hay empleados registrados</td></tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{emp.full_name}</div>
                        {emp.email && <div className="text-xs text-gray-500">{emp.email}</div>}
                      </td>
                      <td className="p-3 text-gray-600">{emp.employee_code || '-'}</td>
                      <td className="p-3 text-gray-600">{emp.department || '-'}</td>
                      <td className="p-3 text-gray-600">{emp.position || '-'}</td>
                      <td className="p-3 text-right text-gray-700">
                        {emp.active_contract?.base_salary
                          ? `${emp.active_contract.currency || 'MXN'} ${emp.active_contract.base_salary.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${emp.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {emp.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </BrandCard>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-bloque-navy900">Nuevo Empleado</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codigo empleado</label>
                  <input type="text" value={formData.employee_code} onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha contratacion</label>
                  <input type="date" value={formData.hire_date} onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                  <input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puesto</label>
                  <input type="text" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formData.full_name.trim()}
                className="flex items-center gap-2 bg-bloque-gold text-bloque-navy900 font-semibold px-4 py-2 rounded-lg hover:bg-bloque-gold/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Crear Empleado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
