'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import {
  employeeApi,
  type EmployeeProfile,
} from '@/lib/api'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  AlertCircle,
  User,
  Briefcase,
  Building2,
  CreditCard,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Shield,
} from 'lucide-react'

// ── Helpers ─────────────────────────────────────────────────────
function contractLabel(type: string): string {
  const map: Record<string, string> = {
    PERMANENT: 'Permanente',
    TEMPORARY: 'Temporal',
    CONTRACTOR: 'Contratista',
    INTERN: 'Pasante',
  }
  return map[type] || type
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    ON_LEAVE: 'En licencia',
  }
  return map[status] || status
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    INACTIVE: 'bg-gray-100 text-gray-700',
    ON_LEAVE: 'bg-yellow-100 text-yellow-700',
  }
  return map[status] || 'bg-gray-100 text-gray-700'
}

// ── InfoRow component ───────────────────────────────────────────
interface InfoRowProps {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-bloque-slate200 last:border-0">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-bloque-navy900 truncate">
          {value || '—'}
        </p>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────
export default function EmployeeProfilePage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()

  const [data, setData] = useState<EmployeeProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated || !accessToken) {
      router.push('/login')
      return
    }

    const load = async () => {
      try {
        const res = await employeeApi.getProfile(accessToken)
        setData(res)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al cargar el perfil'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isHydrated, isAuthenticated, accessToken, router])

  if (!isHydrated || loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/portal')}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Portal
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-bloque-navy900">Mi Perfil</h1>
            <p className="text-sm text-muted-foreground">Informacion personal y laboral</p>
          </div>
        </div>
        <Badge className={statusColor(data.status)}>{statusLabel(data.status)}</Badge>
      </div>

      {/* Profile Header Card */}
      <BrandCard>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-bloque-navy900 flex items-center justify-center text-white text-xl font-bold">
            {data.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-bloque-navy900">{data.full_name}</h2>
            <p className="text-muted-foreground">{data.position}</p>
            <p className="text-sm text-muted-foreground">{data.department}</p>
          </div>
        </div>
      </BrandCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Information */}
        <BrandCard>
          <BrandCardHeader title="Informacion Personal" />
          <div className="space-y-0">
            <InfoRow
              icon={<User className="h-4 w-4" />}
              label="Nombre completo"
              value={data.full_name}
            />
            <InfoRow
              icon={<Mail className="h-4 w-4" />}
              label="Correo electronico"
              value={data.email}
            />
            <InfoRow
              icon={<Phone className="h-4 w-4" />}
              label="Telefono"
              value={data.phone}
            />
            <InfoRow
              icon={<MapPin className="h-4 w-4" />}
              label="Direccion"
              value={
                [data.address, data.city, data.country].filter(Boolean).join(', ') || null
              }
            />
            <InfoRow
              icon={<Calendar className="h-4 w-4" />}
              label="Fecha de nacimiento"
              value={
                data.date_of_birth
                  ? new Date(data.date_of_birth).toLocaleDateString('es-SV')
                  : null
              }
            />
            <InfoRow
              icon={<Shield className="h-4 w-4" />}
              label={data.national_id_type || 'DUI'}
              value={data.national_id}
            />
          </div>
        </BrandCard>

        {/* Employment Information */}
        <BrandCard>
          <BrandCardHeader title="Informacion Laboral" />
          <div className="space-y-0">
            <InfoRow
              icon={<Briefcase className="h-4 w-4" />}
              label="Cargo"
              value={data.position}
            />
            <InfoRow
              icon={<Building2 className="h-4 w-4" />}
              label="Departamento"
              value={data.department}
            />
            <InfoRow
              icon={<Calendar className="h-4 w-4" />}
              label="Fecha de ingreso"
              value={new Date(data.hire_date).toLocaleDateString('es-SV')}
            />
            <InfoRow
              icon={<FileText className="h-4 w-4" />}
              label="Tipo de contrato"
              value={contractLabel(data.contract_type)}
            />
            <InfoRow
              icon={<User className="h-4 w-4" />}
              label="Supervisor"
              value={data.manager_name}
            />
            {data.employee_code && (
              <InfoRow
                icon={<Shield className="h-4 w-4" />}
                label="Codigo de empleado"
                value={data.employee_code}
              />
            )}
          </div>
        </BrandCard>

        {/* Bank Information */}
        <BrandCard>
          <BrandCardHeader title="Informacion Bancaria" />
          <div className="space-y-0">
            <InfoRow
              icon={<Building2 className="h-4 w-4" />}
              label="Banco"
              value={data.bank_name}
            />
            <InfoRow
              icon={<CreditCard className="h-4 w-4" />}
              label="Cuenta"
              value={data.bank_account_masked}
            />
            <InfoRow
              icon={<FileText className="h-4 w-4" />}
              label="Tipo de cuenta"
              value={data.bank_account_type}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Por seguridad, el numero de cuenta se muestra parcialmente oculto.
            Para actualizar tu informacion bancaria, contacta a Recursos Humanos.
          </p>
        </BrandCard>

        {/* Emergency Contact */}
        <BrandCard>
          <BrandCardHeader title="Contacto de Emergencia" />
          {data.emergency_contact ? (
            <div className="space-y-0">
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="Nombre"
                value={data.emergency_contact.name}
              />
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="Parentesco"
                value={data.emergency_contact.relationship}
              />
              <InfoRow
                icon={<Phone className="h-4 w-4" />}
                label="Telefono"
                value={data.emergency_contact.phone}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6">
              No se ha registrado un contacto de emergencia.
            </p>
          )}
        </BrandCard>
      </div>

      {/* Request Update */}
      <BrandCard>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="font-medium text-bloque-navy900">
              Necesitas actualizar tu informacion?
            </p>
            <p className="text-sm text-muted-foreground">
              Para cambios en tus datos personales o bancarios, solicita una actualizacion.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/portal/documents')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Solicitar documento
          </Button>
        </div>
      </BrandCard>
    </div>
  )
}
