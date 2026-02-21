'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { MaskedInput } from '@/components/ui/masked-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore, isEmployer } from '@/lib/auth'
import { eorApi } from '@/lib/api'
import { validators, validate } from '@/lib/validations'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  User,
  Briefcase,
  Building2,
  ClipboardCheck,
} from 'lucide-react'

// ── Step definitions ─────────────────────────────────────

const STEPS = [
  { id: 'personal', label: 'Datos Personales', icon: User },
  { id: 'labor', label: 'Datos Laborales', icon: Briefcase },
  { id: 'social', label: 'Seguridad Social y Banco', icon: Building2 },
  { id: 'review', label: 'Revision', icon: ClipboardCheck },
] as const

// ── Form data ────────────────────────────────────────────

interface FormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  dui: string
  nit: string
  birth_date: string
  address: string
  position: string
  department: string
  base_salary: string
  contract_type: string
  payment_frequency: string
  start_date: string
  contract_end_date: string
  isss_number: string
  afp_provider: string
  afp_number: string
  bank_name: string
  bank_account_number: string
  bank_account_type: string
}

type FormErrors = Partial<Record<keyof FormData, string | null>>

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

// ── Review row ───────────────────────────────────────────

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
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) router.push('/login')
    else if (!isEmployer()) router.push('/dashboard')
  }, [isAuthenticated, router])

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  // ── Step validation ────────────────────────────────────

  const validateStep = (s: number): FormErrors => {
    const errs: FormErrors = {}

    if (s === 0) {
      errs.first_name = validators.required(form.first_name)
      errs.last_name = validators.required(form.last_name)
      errs.email = validate(form.email, validators.required, validators.email)
      if (form.phone) errs.phone = validators.phone(form.phone)
      if (form.dui) errs.dui = validators.dui(form.dui)
      if (form.nit) errs.nit = validators.nit(form.nit)
    }

    if (s === 1) {
      errs.position = validators.required(form.position)
      errs.base_salary = validate(
        form.base_salary,
        validators.required,
        validators.salary
      )
      errs.start_date = validators.date(form.start_date)
    }

    if (s === 2) {
      if (form.bank_account_number)
        errs.bank_account_number = validators.bankAccount(form.bank_account_number)
    }

    // Remove null entries
    const cleaned: FormErrors = {}
    for (const [key, val] of Object.entries(errs)) {
      if (val) cleaned[key as keyof FormData] = val
    }
    return cleaned
  }

  const canAdvance = (): boolean => {
    const errs = validateStep(step)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    const errs = validateStep(step)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setStep((s) => s + 1)
  }

  const handleSubmit = async () => {
    if (!accessToken) return
    setLoading(true)
    setApiError('')
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
      const message =
        err instanceof Error ? err.message : 'Error al crear empleado'
      setApiError(message)
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

        {apiError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
            {apiError}
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
                <FormField label="Nombre" required error={errors.first_name ?? undefined}>
                  <Input
                    id="first_name"
                    value={form.first_name}
                    onChange={(e) => update('first_name', e.target.value)}
                    placeholder="Juan"
                    error={!!errors.first_name}
                  />
                </FormField>
                <FormField label="Apellido" required error={errors.last_name ?? undefined}>
                  <Input
                    id="last_name"
                    value={form.last_name}
                    onChange={(e) => update('last_name', e.target.value)}
                    placeholder="Perez"
                    error={!!errors.last_name}
                  />
                </FormField>
              </div>
              <FormField label="Correo electronico" required error={errors.email ?? undefined}>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="juan.perez@empresa.com"
                  error={!!errors.email}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Telefono" error={errors.phone ?? undefined} hint="Formato: 0000-0000">
                  <MaskedInput
                    mask="phone"
                    value={form.phone}
                    onValueChange={(v) => update('phone', v)}
                    error={!!errors.phone}
                  />
                </FormField>
                <FormField label="Fecha de nacimiento">
                  <Input
                    id="birth_date"
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => update('birth_date', e.target.value)}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="DUI" error={errors.dui ?? undefined} hint="Formato: 00000000-0">
                  <MaskedInput
                    mask="dui"
                    value={form.dui}
                    onValueChange={(v) => update('dui', v)}
                    error={!!errors.dui}
                  />
                </FormField>
                <FormField label="NIT" error={errors.nit ?? undefined} hint="Formato: 0000-000000-000-0">
                  <MaskedInput
                    mask="nit"
                    value={form.nit}
                    onValueChange={(v) => update('nit', v)}
                    error={!!errors.nit}
                  />
                </FormField>
              </div>
              <FormField label="Direccion">
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="Col. Escalon, San Salvador"
                />
              </FormField>
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
                <FormField label="Puesto" required error={errors.position ?? undefined}>
                  <Input
                    id="position"
                    value={form.position}
                    onChange={(e) => update('position', e.target.value)}
                    placeholder="Desarrollador Senior"
                    error={!!errors.position}
                  />
                </FormField>
                <FormField label="Departamento">
                  <Input
                    id="department"
                    value={form.department}
                    onChange={(e) => update('department', e.target.value)}
                    placeholder="Ingenieria"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Salario mensual (USD)"
                  required
                  error={errors.base_salary ?? undefined}
                  hint="Minimo $365"
                >
                  <Input
                    id="base_salary"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.base_salary}
                    onChange={(e) => update('base_salary', e.target.value)}
                    placeholder="2000.00"
                    error={!!errors.base_salary}
                  />
                </FormField>
                <FormField label="Frecuencia de pago">
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
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Tipo de contrato">
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
                </FormField>
                <FormField label="Fecha de inicio" required error={errors.start_date ?? undefined}>
                  <Input
                    id="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => update('start_date', e.target.value)}
                    error={!!errors.start_date}
                  />
                </FormField>
              </div>
              {form.contract_type === 'PLAZO_FIJO' && (
                <FormField label="Fecha fin de contrato">
                  <Input
                    id="contract_end_date"
                    type="date"
                    value={form.contract_end_date}
                    onChange={(e) => update('contract_end_date', e.target.value)}
                  />
                </FormField>
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
              <FormField label="Numero ISSS">
                <Input
                  id="isss_number"
                  value={form.isss_number}
                  onChange={(e) => update('isss_number', e.target.value)}
                  placeholder="000000000"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="AFP">
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
                </FormField>
                <FormField label="Numero AFP">
                  <Input
                    id="afp_number"
                    value={form.afp_number}
                    onChange={(e) => update('afp_number', e.target.value)}
                    placeholder="000000000"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Banco">
                  <Input
                    id="bank_name"
                    value={form.bank_name}
                    onChange={(e) => update('bank_name', e.target.value)}
                    placeholder="Banco Agricola"
                  />
                </FormField>
                <FormField label="No. de cuenta" error={errors.bank_account_number ?? undefined}>
                  <MaskedInput
                    mask="bank-account"
                    value={form.bank_account_number}
                    onValueChange={(v) => update('bank_account_number', v)}
                    error={!!errors.bank_account_number}
                  />
                </FormField>
                <FormField label="Tipo de cuenta">
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
                </FormField>
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
                value={
                  form.base_salary
                    ? `$${parseFloat(form.base_salary).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}`
                    : ''
                }
              />
              <ReviewRow
                label="Contrato"
                value={form.contract_type === 'INDEFINIDO' ? 'Indefinido' : 'Plazo fijo'}
              />
              <ReviewRow label="Inicio" value={form.start_date} />
            </BrandCard>
            <BrandCard>
              <BrandCardHeader title="Seguridad Social y Banco" />
              <ReviewRow label="ISSS" value={form.isss_number} />
              <ReviewRow
                label="AFP"
                value={form.afp_provider === 'AFP_CRECER' ? 'AFP Crecer' : 'AFP Confia'}
              />
              <ReviewRow label="No. AFP" value={form.afp_number} />
              <ReviewRow label="Banco" value={form.bank_name} />
              <ReviewRow label="Cuenta" value={form.bank_account_number} />
              <ReviewRow
                label="Tipo"
                value={form.bank_account_type === 'AHORRO' ? 'Ahorro' : 'Corriente'}
              />
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
            <Button type="button" onClick={handleNext}>
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button type="button" disabled={loading} onClick={handleSubmit}>
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
