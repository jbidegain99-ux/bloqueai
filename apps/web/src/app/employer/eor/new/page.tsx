'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore, isEmployer } from '@/lib/auth'
import { eorApi } from '@/lib/api'
import { ChevronLeft, ChevronRight, Check, Loader2, User, Briefcase, Building2, ClipboardCheck } from 'lucide-react'

// ── Step definitions ─────────────────────────────────────

const STEPS = [
  { id: 'personal', label: 'Datos Personales', icon: User },
  { id: 'labor', label: 'Datos Laborales', icon: Briefcase },
  { id: 'social', label: 'Seguridad Social y Banco', icon: Building2 },
  { id: 'review', label: 'Revision', icon: ClipboardCheck },
] as const

type StepId = typeof STEPS[number]['id']

// ── Interfaces ───────────────────────────────────────────

interface FormData {
  // Personal
  first_name: string
  last_name: string
  email: string
  phone: string
  dui: string
  nit: string
  birth_date: string
  address: string
  // Labor
  position: string
  department: string
  base_salary: string
  contract_type: string
  payment_frequency: string
  start_date: string
  contract_end_date: string
  // Social & Bank
  isss_number: string
  afp_provider: string
  afp_number: string
  bank_name: string
  bank_account_number: string
  bank_account_type: string
}

const INITIAL_FORM: FormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  dui: '',
  nit: '',
  birth_date: '',
  address: '',
  position: '',
  department: '',
  base_salary: '',
  contract_type: 'INDEFINIDO',
  payment_frequency: 'MENSUAL',
  start_date: '',
  contract_end_date: '',
  isss_number: '',
  afp_provider: 'AFP_CRECER',
  afp_number: '',
  bank_name: '',
  bank_account_number: '',
  bank_account_type: 'AHORRO',
}

// ── Step indicator ───────────────────────────────────────

function StepIndicator({
  steps,
  currentIndex,
}: {
  steps: typeof STEPS
  currentIndex: number
}) {
  return (
    <nav className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => {
        const isDone = i < currentIndex
        const isCurrent = i === currentIndex
        const Icon = step.icon
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isCurrent
                  ? 'bg-brand-50 text-brand-600 border border-brand-200'
                  : isDone
                  ? 'bg-success-50 text-success-600'
                  : 'text-neutral-400'
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isCurrent
                    ? 'bg-brand-500 text-white'
                    : isDone
                    ? 'bg-success-500 text-white'
                    : 'bg-neutral-200 text-neutral-500'
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className="hidden md:inline">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`hidden md:block w-8 h-0.5 ${
                  i < currentIndex ? 'bg-success-400' : 'bg-neutral-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ── Review item ──────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-neutral-100 last:border-0">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-bloque-navy900">
        {value || '—'}
      </span>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────

export default function NewEOREmployeePage() {
  const router = useRouter()
  const { accessToken, isAuthenticated } = useAuthStore()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) router.push('/login')
    else if (!isEmployer()) router.push('/dashboard')
  }, [isAuthenticated, router])

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const canAdvance = (): boolean => {
    if (step === 0) return !!(form.first_name && form.last_name && form.email)
    if (step === 1) return !!(form.position && form.base_salary && form.start_date)
    return true
  }

  const handleSubmit = async () => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || null,
        dui: form.dui || null,
        nit: form.nit || null,
        birth_date: form.birth_date || null,
        address: form.address || null,
        position: form.position || null,
        department: form.department || null,
        base_salary: parseFloat(form.base_salary),
        contract_type: form.contract_type,
        payment_frequency: form.payment_frequency,
        start_date: form.start_date,
        contract_end_date: form.contract_end_date || null,
        isss_number: form.isss_number || null,
        afp_provider: form.afp_provider || null,
        afp_number: form.afp_number || null,
        bank_name: form.bank_name || null,
        bank_account_number: form.bank_account_number || null,
        bank_account_type: form.bank_account_type || null,
      }
      const created = await eorApi.createEmployee(accessToken, payload)
      router.push(`/employer/eor/${created.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear empleado'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-bloque-navy900 mb-2">
          Agregar Empleado EOR
        </h1>
        <p className="text-sm text-neutral-500 mb-6">
          Registra un nuevo empleado bajo contrato EOR con Bloque S.A. de C.V.
        </p>

        <StepIndicator steps={STEPS} currentIndex={step} />

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        {/* Step 0: Personal */}
        {step === 0 && (
          <BrandCard>
            <BrandCardHeader
              title="Datos Personales"
              description="Informacion basica del empleado"
            />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Nombre *</Label>
                  <Input
                    id="first_name"
                    value={form.first_name}
                    onChange={(e) => update('first_name', e.target.value)}
                    placeholder="Juan"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Apellido *</Label>
                  <Input
                    id="last_name"
                    value={form.last_name}
                    onChange={(e) => update('last_name', e.target.value)}
                    placeholder="Perez"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Correo electronico *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="juan.perez@empresa.com"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Telefono</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    placeholder="+503 7000 0000"
                  />
                </div>
                <div>
                  <Label htmlFor="birth_date">Fecha de nacimiento</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => update('birth_date', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dui">DUI</Label>
                  <Input
                    id="dui"
                    value={form.dui}
                    onChange={(e) => update('dui', e.target.value)}
                    placeholder="00000000-0"
                  />
                </div>
                <div>
                  <Label htmlFor="nit">NIT</Label>
                  <Input
                    id="nit"
                    value={form.nit}
                    onChange={(e) => update('nit', e.target.value)}
                    placeholder="0000-000000-000-0"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Direccion</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="Col. Escalon, San Salvador"
                />
              </div>
            </div>
          </BrandCard>
        )}

        {/* Step 1: Labor */}
        {step === 1 && (
          <BrandCard>
            <BrandCardHeader
              title="Datos Laborales"
              description="Puesto, salario y tipo de contrato"
            />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="position">Puesto *</Label>
                  <Input
                    id="position"
                    value={form.position}
                    onChange={(e) => update('position', e.target.value)}
                    placeholder="Desarrollador Senior"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="department">Departamento</Label>
                  <Input
                    id="department"
                    value={form.department}
                    onChange={(e) => update('department', e.target.value)}
                    placeholder="Ingenieria"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="base_salary">Salario mensual (USD) *</Label>
                  <Input
                    id="base_salary"
                    type="number"
                    step="0.01"
                    value={form.base_salary}
                    onChange={(e) => update('base_salary', e.target.value)}
                    placeholder="2000.00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="payment_frequency">Frecuencia de pago</Label>
                  <Select
                    value={form.payment_frequency}
                    onValueChange={(v) => update('payment_frequency', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MENSUAL">Mensual</SelectItem>
                      <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contract_type">Tipo de contrato</Label>
                  <Select
                    value={form.contract_type}
                    onValueChange={(v) => update('contract_type', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDEFINIDO">Indefinido</SelectItem>
                      <SelectItem value="PLAZO_FIJO">Plazo fijo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="start_date">Fecha de inicio *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => update('start_date', e.target.value)}
                    required
                  />
                </div>
              </div>
              {form.contract_type === 'PLAZO_FIJO' && (
                <div>
                  <Label htmlFor="contract_end_date">Fecha fin de contrato</Label>
                  <Input
                    id="contract_end_date"
                    type="date"
                    value={form.contract_end_date}
                    onChange={(e) => update('contract_end_date', e.target.value)}
                  />
                </div>
              )}
            </div>
          </BrandCard>
        )}

        {/* Step 2: Social Security & Bank */}
        {step === 2 && (
          <BrandCard>
            <BrandCardHeader
              title="Seguridad Social y Datos Bancarios"
              description="ISSS, AFP y cuenta de deposito"
            />
            <div className="space-y-4">
              <div>
                <Label htmlFor="isss_number">Numero ISSS</Label>
                <Input
                  id="isss_number"
                  value={form.isss_number}
                  onChange={(e) => update('isss_number', e.target.value)}
                  placeholder="000000000"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="afp_provider">AFP</Label>
                  <Select
                    value={form.afp_provider}
                    onValueChange={(v) => update('afp_provider', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AFP_CRECER">AFP Crecer</SelectItem>
                      <SelectItem value="AFP_CONFIA">AFP Confia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="afp_number">Numero AFP</Label>
                  <Input
                    id="afp_number"
                    value={form.afp_number}
                    onChange={(e) => update('afp_number', e.target.value)}
                    placeholder="000000000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bank_name">Banco</Label>
                  <Input
                    id="bank_name"
                    value={form.bank_name}
                    onChange={(e) => update('bank_name', e.target.value)}
                    placeholder="Banco Agricola"
                  />
                </div>
                <div>
                  <Label htmlFor="bank_account_number">No. de cuenta</Label>
                  <Input
                    id="bank_account_number"
                    value={form.bank_account_number}
                    onChange={(e) => update('bank_account_number', e.target.value)}
                    placeholder="00000000000"
                  />
                </div>
                <div>
                  <Label htmlFor="bank_account_type">Tipo de cuenta</Label>
                  <Select
                    value={form.bank_account_type}
                    onValueChange={(v) => update('bank_account_type', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AHORRO">Ahorro</SelectItem>
                      <SelectItem value="CORRIENTE">Corriente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </BrandCard>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <BrandCard>
              <BrandCardHeader title="Datos Personales" />
              <ReviewRow label="Nombre" value={`${form.first_name} ${form.last_name}`} />
              <ReviewRow label="Correo" value={form.email} />
              <ReviewRow label="Telefono" value={form.phone} />
              <ReviewRow label="DUI" value={form.dui} />
              <ReviewRow label="NIT" value={form.nit} />
              <ReviewRow label="Direccion" value={form.address} />
            </BrandCard>
            <BrandCard>
              <BrandCardHeader title="Datos Laborales" />
              <ReviewRow label="Puesto" value={form.position} />
              <ReviewRow label="Departamento" value={form.department} />
              <ReviewRow
                label="Salario"
                value={form.base_salary ? `$${parseFloat(form.base_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
              />
              <ReviewRow label="Contrato" value={form.contract_type === 'INDEFINIDO' ? 'Indefinido' : 'Plazo fijo'} />
              <ReviewRow label="Inicio" value={form.start_date} />
            </BrandCard>
            <BrandCard>
              <BrandCardHeader title="Seguridad Social y Banco" />
              <ReviewRow label="ISSS" value={form.isss_number} />
              <ReviewRow label="AFP" value={form.afp_provider === 'AFP_CRECER' ? 'AFP Crecer' : 'AFP Confia'} />
              <ReviewRow label="No. AFP" value={form.afp_number} />
              <ReviewRow label="Banco" value={form.bank_name} />
              <ReviewRow label="Cuenta" value={form.bank_account_number} />
              <ReviewRow label="Tipo" value={form.bank_account_type === 'AHORRO' ? 'Ahorro' : 'Corriente'} />
            </BrandCard>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (step === 0) router.push('/employer/eor')
              else setStep((s) => s - 1)
            }}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {step === 0 ? 'Cancelar' : 'Anterior'}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              disabled={!canAdvance()}
              onClick={() => setStep((s) => s + 1)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1.5" />
                  Crear Empleado
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  )
}
