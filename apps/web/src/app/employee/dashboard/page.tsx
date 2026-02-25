'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard } from '@/components/brand/BrandCard'
import { MetricCard } from '@/components/ui/metric-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/auth'
import { eorApi } from '@/lib/api'
import type { EOREmployeeDetail } from '@/lib/api'
import {
  DollarSign,
  CalendarDays,
  FileText,
  User,
  ChevronRight,
} from 'lucide-react'

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-soft transition-all duration-200 hover:shadow-medium hover:border-neutral-300 cursor-pointer group">
        <div className="flex-shrink-0 p-2.5 bg-bloque-gray50 rounded-lg group-hover:bg-brand-50 transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-bloque-navy900">{title}</h3>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-brand-500 transition-colors" />
      </div>
    </Link>
  )
}

export default function EmployeeDashboardPage() {
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
      // Employee portal: fetch own data using user ID as employee ID
      const data = await eorApi.getEmployee(accessToken, user.id)
      setEmployee(data)
    } catch {
      // Employee may not have EOR data — graceful degradation
    } finally {
      setLoading(false)
    }
  }

  if (!isHydrated || !isAuthenticated) return null

  const firstName = user?.full_name?.split(' ')[0] ?? 'Empleado'
  const cost = employee?.monthly_cost
  const nextPayment = cost?.net_salary
    ? `$${cost.net_salary.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : '—'

  return (
    <AppShell>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-bloque-navy900">
          Hola, {firstName}
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Portal del empleado EOR
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Proximo Pago"
          value={0}
          format={() => nextPayment}
          icon={<DollarSign className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="Dias Vacacion"
          value={employee?.vacation_days_available ?? 15}
          icon={<CalendarDays className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="Dias Usados"
          value={employee?.vacation_days_used ?? 0}
          icon={<CalendarDays className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          label="Salario Base"
          value={employee?.base_salary ?? 0}
          format={(v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickAction
          href="/employee/payslips"
          icon={<FileText className="h-5 w-5 text-bloque-navy900" />}
          title="Mis Boletas"
          description="Ver historial de pagos"
        />
        <QuickAction
          href="/employee/documents"
          icon={<FileText className="h-5 w-5 text-bloque-navy900" />}
          title="Documentos"
          description="Contratos y certificados"
        />
        <QuickAction
          href="/employee/vacation"
          icon={<CalendarDays className="h-5 w-5 text-bloque-navy900" />}
          title="Vacaciones"
          description="Solicitar dias libres"
        />
        <QuickAction
          href="/employee/profile"
          icon={<User className="h-5 w-5 text-bloque-navy900" />}
          title="Mi Perfil"
          description="Datos personales y banco"
        />
      </div>
    </AppShell>
  )
}
