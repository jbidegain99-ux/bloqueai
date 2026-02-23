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
  Settings,
  Plus,
  ChevronRight,
  X,
  Save,
} from 'lucide-react'

interface DeductionType {
  id: string
  client_id: string
  name: string
  description: string | null
  calc_type: string
  value: number
  is_active: boolean
  is_mandatory: boolean
  created_at: string | null
}

interface ClientOption {
  id: string
  name: string
}

export default function PayrollDeductionsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [deductions, setDeductions] = useState<DeductionType[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '', description: '', calc_type: 'PERCENTAGE', value: '', is_mandatory: false,
  })
  const [saving, setSaving] = useState(false)

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
        await loadDeductions(list[0].id)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadDeductions = async (clientId: string) => {
    if (!accessToken || !clientId) return
    setLoading(true)
    try {
      const data = await payrollApi.getDeductionTypes(accessToken, clientId)
      setDeductions(data)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId)
    loadDeductions(clientId)
  }

  const handleCreate = async () => {
    if (!accessToken || !selectedClient || !formData.name.trim() || !formData.value) return
    setSaving(true)
    try {
      await payrollApi.createDeductionType(accessToken, {
        client_id: selectedClient,
        name: formData.name,
        description: formData.description || undefined,
        calc_type: formData.calc_type,
        value: parseFloat(formData.value),
        is_mandatory: formData.is_mandatory,
      })
      setShowModal(false)
      setFormData({ name: '', description: '', calc_type: 'PERCENTAGE', value: '', is_mandatory: false })
      loadDeductions(selectedClient)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <BrandHero title="Deducciones" subtitle="Tipos de deduccion por cliente" />

      <nav className="flex items-center gap-2 text-sm text-muted-foreground mt-4 mb-2">
        <Link href="/admin/dashboard" className="hover:text-bloque-navy900 transition-colors">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/admin/payroll/dashboard" className="hover:text-bloque-navy900 transition-colors">Nomina</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-bloque-navy900 font-medium">Deducciones</span>
      </nav>

      <div className="space-y-4 mt-4">
        <div className="flex flex-wrap items-center gap-4">
          <select value={selectedClient} onChange={(e) => handleClientChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold">
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <button onClick={() => setShowModal(true)}
            className="ml-auto flex items-center gap-2 bg-bloque-gold text-bloque-navy900 font-semibold px-4 py-2 rounded-lg hover:bg-bloque-gold/90">
            <Plus className="h-4 w-4" /> Nueva Deduccion
          </button>
        </div>

        <BrandCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left p-3 font-medium text-gray-600">Descripcion</th>
                  <th className="text-center p-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-right p-3 font-medium text-gray-600">Valor</th>
                  <th className="text-center p-3 font-medium text-gray-600">Obligatoria</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">Cargando...</td></tr>
                ) : deductions.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">No hay deducciones configuradas</td></tr>
                ) : (
                  deductions.map((d) => (
                    <tr key={d.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{d.name}</td>
                      <td className="p-3 text-gray-600 text-xs">{d.description || '-'}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${d.calc_type === 'PERCENTAGE' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                          {d.calc_type === 'PERCENTAGE' ? 'Porcentaje' : 'Fijo'}
                        </span>
                      </td>
                      <td className="p-3 text-right text-gray-700">
                        {d.calc_type === 'PERCENTAGE' ? `${d.value}%` : `USD ${d.value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="p-3 text-center">
                        {d.is_mandatory ? (
                          <span className="text-green-600 font-medium text-xs">Si</span>
                        ) : (
                          <span className="text-gray-400 text-xs">No</span>
                        )}
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-bloque-navy900">Nueva Deduccion</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold"
                  placeholder="Ej: IMSS, ISR, Fonacot" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de calculo</label>
                  <select value={formData.calc_type} onChange={(e) => setFormData({ ...formData, calc_type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold">
                    <option value="PERCENTAGE">Porcentaje</option>
                    <option value="FIXED">Monto Fijo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
                  <input type="number" step="0.01" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold"
                    placeholder={formData.calc_type === 'PERCENTAGE' ? 'Ej: 6.5' : 'Ej: 500.00'} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="mandatory" checked={formData.is_mandatory}
                  onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                  className="rounded border-gray-300" />
                <label htmlFor="mandatory" className="text-sm text-gray-700">Deduccion obligatoria</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !formData.name.trim() || !formData.value}
                className="flex items-center gap-2 bg-bloque-gold text-bloque-navy900 font-semibold px-4 py-2 rounded-lg hover:bg-bloque-gold/90 disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? 'Guardando...' : 'Crear Deduccion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
