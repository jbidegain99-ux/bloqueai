'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { useAuthStore, isRecruiter } from '@/lib/auth'
import { payrollApi } from '@/lib/api'
import { getErrorMessage } from '@/types'
import {
  ArrowLeft,
  User,
  Briefcase,
  FileText,
  Calendar,
  DollarSign,
  Phone,
  Mail,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit2,
  Save,
  X,
  PenTool,
} from 'lucide-react'

// Uses PayrollEmployeeDetail from api.ts via payrollApi.getEmployee
interface EmployeeDetail {
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
  termination_date: string | null
  document_type: string | null
  document_id: string | null
  salary: number | null
  salary_currency: string | null
  employment_type: string | null
  status: string | null
  bank_account_number: string | null
  active_contract: {
    contract_type: string | null
    base_salary: number | null
    currency: string | null
    pay_frequency: string | null
  } | null
  created_at: string | null
}

interface Contract {
  id: string
  contract_type: string
  position_title: string | null
  start_date: string
  end_date: string | null
  base_salary: number
  currency: string
  pay_frequency: string
  is_active: boolean
  signed_by_employee_at: string | null
  benefits: Record<string, unknown> | null
  created_at: string | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Activo', color: 'bg-green-100 text-green-700' },
  ON_LEAVE: { label: 'Con Permiso', color: 'bg-yellow-100 text-yellow-700' },
  TERMINATED: { label: 'Terminado', color: 'bg-red-100 text-red-700' },
  SUSPENDED: { label: 'Suspendido', color: 'bg-orange-100 text-orange-700' },
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: 'Tiempo Completo',
  PART_TIME: 'Medio Tiempo',
  CONTRACT: 'Contrato',
  FREELANCE: 'Freelance',
}

export default function EmployeeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const employeeId = params.id as string
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) { router.push('/login'); return }
    if (!isRecruiter()) { router.push('/dashboard'); return }
    loadData()
  }, [isHydrated, isAuthenticated, accessToken, router, employeeId])

  const loadData = async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const [empData, contractsData] = await Promise.all([
        payrollApi.getEmployee(accessToken, employeeId),
        payrollApi.getEmployeeContracts(accessToken, employeeId),
      ])
      setEmployee(empData as unknown as EmployeeDetail)
      setContracts(Array.isArray(contractsData) ? contractsData as unknown as Contract[] : [])
    } catch (err) {
      console.error('Error loading employee:', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    if (!employee) return
    setEditData({
      full_name: employee.full_name,
      email: employee.email || '',
      phone: employee.phone || '',
      position: employee.position || '',
      department: employee.department || '',
    })
    setEditing(true)
  }

  const handleSave = async () => {
    if (!accessToken || !employee) return
    setSaving(true)
    setMessage(null)
    try {
      await payrollApi.updateEmployee(accessToken, employeeId, editData)
      setMessage({ type: 'success', text: 'Empleado actualizado' })
      setEditing(false)
      loadData()
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const handleTerminate = async () => {
    if (!accessToken || !confirm('¿Está seguro que desea terminar a este empleado? Esta acción desactivará sus contratos activos.')) return
    setSaving(true)
    try {
      await payrollApi.terminateEmployee(accessToken, employeeId)
      setMessage({ type: 'success', text: 'Empleado terminado exitosamente' })
      loadData()
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const handleSignContract = async (contractId: string) => {
    if (!accessToken) return
    try {
      await payrollApi.signContract(accessToken, contractId)
      setMessage({ type: 'success', text: 'Contrato firmado exitosamente' })
      loadData()
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err) })
    }
  }

  const formatMoney = (amount: number | null, currency: string | null) => {
    if (amount === null) return '—'
    return `${currency || 'USD'} ${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
  }

  if (loading) {
    return (
      <AppShell>
        <BrandHero title="Cargando..." size="sm" />
        <div className="container mx-auto px-4 py-6 animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </AppShell>
    )
  }

  if (!employee) {
    return (
      <AppShell>
        <BrandHero title="Empleado no encontrado" size="sm" />
        <div className="container mx-auto px-4 py-6 text-center">
          <Link href="/admin/payroll/employees" className="text-blue-600 hover:underline">Volver</Link>
        </div>
      </AppShell>
    )
  }

  const statusInfo = STATUS_LABELS[employee.status || 'ACTIVE'] || STATUS_LABELS.ACTIVE

  return (
    <AppShell>
      <BrandHero
        title={employee.full_name}
        subtitle={`${employee.position || 'Sin puesto'} — ${employee.department || 'Sin departamento'}`}
        size="sm"
      />

      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/admin/payroll/employees" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Volver a empleados
          </Link>
          <div className="flex gap-2">
            {employee.status !== 'TERMINATED' && (
              <>
                <button onClick={handleEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50">
                  <Edit2 className="w-3 h-3" /> Editar
                </button>
                <button onClick={handleTerminate} disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50">
                  <XCircle className="w-3 h-3" /> Terminar
                </button>
              </>
            )}
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <BrandCard>
              <BrandCardHeader title="Información Personal" />
              <div className="p-4">
                {editing ? (
                  <div className="space-y-3">
                    {['full_name', 'email', 'phone', 'position', 'department'].map((field) => (
                      <div key={field}>
                        <label className="text-xs text-gray-500 uppercase">{field.replace('_', ' ')}</label>
                        <input
                          type="text"
                          value={editData[field] || ''}
                          onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                        <Save className="w-3 h-3" /> {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button onClick={() => setEditing(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                        <X className="w-3 h-3 inline mr-1" /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow icon={User} label="Nombre" value={employee.full_name} />
                    <InfoRow icon={Mail} label="Email" value={employee.email} />
                    <InfoRow icon={Phone} label="Teléfono" value={employee.phone} />
                    <InfoRow icon={Briefcase} label="Puesto" value={employee.position} />
                    <InfoRow icon={Briefcase} label="Departamento" value={employee.department} />
                    <InfoRow icon={FileText} label={employee.document_type || 'Documento'} value={employee.document_id} />
                    <InfoRow icon={Calendar} label="Fecha Inicio" value={employee.hire_date} />
                    <InfoRow icon={CreditCard} label="Cuenta Bancaria" value={employee.bank_account_number} />
                    {employee.termination_date && (
                      <InfoRow icon={Calendar} label="Fecha Terminación" value={employee.termination_date} />
                    )}
                  </div>
                )}
              </div>
            </BrandCard>

            {/* Contracts */}
            <BrandCard>
              <BrandCardHeader title={`Contratos (${contracts.length})`} />
              <div className="p-4">
                {contracts.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Sin contratos registrados</p>
                ) : (
                  <div className="space-y-3">
                    {contracts.map((c) => (
                      <div key={c.id} className={`border rounded-lg p-3 ${c.is_active ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {c.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                            <span className="text-sm font-medium">{c.contract_type.replace('_', ' ')}</span>
                          </div>
                          {c.is_active && !c.signed_by_employee_at && (
                            <button onClick={() => handleSignContract(c.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-teal-100 text-teal-700 hover:bg-teal-200">
                              <PenTool className="w-3 h-3" /> Firmar
                            </button>
                          )}
                          {c.signed_by_employee_at && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="w-3 h-3" /> Firmado
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
                          <div>
                            <span className="text-gray-400">Salario:</span>{' '}
                            <span className="font-medium">{formatMoney(c.base_salary, c.currency)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Frecuencia:</span> {c.pay_frequency}
                          </div>
                          <div>
                            <span className="text-gray-400">Inicio:</span> {c.start_date}
                          </div>
                          <div>
                            <span className="text-gray-400">Fin:</span> {c.end_date || 'Indefinido'}
                          </div>
                        </div>
                        {c.position_title && (
                          <p className="text-xs text-gray-500 mt-1">Puesto: {c.position_title}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </BrandCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Status */}
            <BrandCard>
              <div className="p-4 text-center">
                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${statusInfo.color}`}>
                  {employee.status === 'ACTIVE' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {statusInfo.label}
                </span>
              </div>
            </BrandCard>

            {/* Salary */}
            <BrandCard>
              <div className="p-4">
                <p className="text-xs text-gray-500 uppercase mb-1">Salario</p>
                <p className="text-2xl font-bold text-gray-900">{formatMoney(employee.salary, employee.salary_currency)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {EMPLOYMENT_LABELS[employee.employment_type || ''] || employee.employment_type || '—'}
                </p>
              </div>
            </BrandCard>

            {/* Quick Info */}
            <BrandCard>
              <div className="p-4 space-y-3 text-sm">
                <div>
                  <span className="text-gray-400">Código:</span>{' '}
                  <span className="font-mono">{employee.employee_code || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Cliente:</span>{' '}
                  <span>{employee.client_name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Registrado:</span>{' '}
                  <span>{employee.created_at ? new Date(employee.created_at).toLocaleDateString('es-SV') : '—'}</span>
                </div>
              </div>
            </BrandCard>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-900">{value || '—'}</p>
      </div>
    </div>
  )
}
