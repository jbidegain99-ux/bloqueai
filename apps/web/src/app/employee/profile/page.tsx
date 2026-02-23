'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/auth'
import { eorApi } from '@/lib/api'
import type { EOREmployeeDetail } from '@/lib/api'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Hash,
  Building2,
  CreditCard,
  Shield,
  Briefcase,
  DollarSign,
  Calendar,
} from 'lucide-react'

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-neutral-100 last:border-0">
      <Icon className="h-4 w-4 text-neutral-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-sm font-medium text-bloque-navy900">{value || '—'}</p>
      </div>
    </div>
  )
}

export default function EmployeeProfilePage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated, user } = useAuthStore()
  const [employee, setEmployee] = useState<EOREmployeeDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadData()
  }, [isHydrated, isAuthenticated, accessToken])

  const loadData = async () => {
    if (!accessToken || !user) return
    setLoading(true)
    try {
      const data = await eorApi.getEmployee(accessToken, user.id)
      setEmployee(data)
    } catch {
      // graceful
    } finally {
      setLoading(false)
    }
  }

  if (!isHydrated || !isAuthenticated) return null

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-bloque-navy900 mb-6">
          Mi Perfil
        </h1>

        <div className="grid md:grid-cols-2 gap-4">
          <BrandCard>
            <BrandCardHeader title="Datos Personales" />
            <InfoRow icon={User} label="Nombre" value={employee ? `${employee.first_name} ${employee.last_name}` : user?.full_name} />
            <InfoRow icon={Mail} label="Correo" value={employee?.email ?? user?.email} />
            <InfoRow icon={Phone} label="Telefono" value={employee?.phone} />
            <InfoRow icon={Hash} label="DUI" value={employee?.dui} />
            <InfoRow icon={Hash} label="NIT" value={employee?.nit} />
            <InfoRow icon={MapPin} label="Direccion" value={employee?.address} />
          </BrandCard>

          <BrandCard>
            <BrandCardHeader title="Datos Laborales" />
            <InfoRow icon={Briefcase} label="Puesto" value={employee?.position} />
            <InfoRow icon={Building2} label="Departamento" value={employee?.department} />
            <InfoRow
              icon={DollarSign}
              label="Salario Base"
              value={employee ? `$${Number(employee.base_salary).toFixed(2)}` : undefined}
            />
            <InfoRow
              icon={Calendar}
              label="Fecha Inicio"
              value={
                employee?.start_date
                  ? new Date(employee.start_date).toLocaleDateString('es-SV', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : undefined
              }
            />
          </BrandCard>

          <BrandCard>
            <BrandCardHeader title="Seguridad Social" />
            <InfoRow icon={Shield} label="ISSS" value={employee?.isss_number} />
            <InfoRow
              icon={Shield}
              label="AFP"
              value={
                employee?.afp_provider === 'CRECER'
                  ? 'AFP Crecer'
                  : employee?.afp_provider === 'CONFIA'
                  ? 'AFP Confia'
                  : employee?.afp_provider
              }
            />
            <InfoRow icon={Hash} label="No. AFP" value={employee?.afp_number} />
          </BrandCard>

          <BrandCard>
            <BrandCardHeader title="Datos Bancarios" />
            <InfoRow icon={Building2} label="Banco" value={employee?.bank_name} />
            <InfoRow icon={CreditCard} label="No. Cuenta" value={employee?.bank_account_number} />
            <InfoRow
              icon={CreditCard}
              label="Tipo"
              value={
                employee?.bank_account_type === 'AHORRO'
                  ? 'Ahorro'
                  : employee?.bank_account_type === 'CORRIENTE'
                  ? 'Corriente'
                  : employee?.bank_account_type
              }
            />
          </BrandCard>
        </div>
      </div>
    </AppShell>
  )
}
