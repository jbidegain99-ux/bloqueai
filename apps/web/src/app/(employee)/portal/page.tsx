'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import {
  employeeApi,
  type EmployeeDashboardData,
} from '@/lib/api'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Download,
  MessageCircle,
  UserCircle,
  DollarSign,
  TrendingUp,
  Calendar,
  AlertCircle,
} from 'lucide-react'

// ── Helpers ─────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function monthName(month: number): string {
  const names = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]
  return names[month - 1] || ''
}

// ── Page ────────────────────────────────────────────────────────
export default function EmployeePortalPage() {
  const router = useRouter()
  const { user, accessToken, isAuthenticated, isHydrated } = useAuthStore()

  const [data, setData] = useState<EmployeeDashboardData | null>(null)
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
        const res = await employeeApi.getDashboard(accessToken)
        setData(res)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al cargar el dashboard'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isHydrated, isAuthenticated, accessToken, router])

  if (!isHydrated || loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-60 rounded-lg" />
          <Skeleton className="h-60 rounded-lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const displayName = data?.employee_name || user?.full_name || 'Colaborador'
  const lastPayslip = data?.last_payslip
  const ytd = data?.ytd_summary

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-bloque-navy900">
          Hola, {displayName.split(' ')[0]}!
        </h1>
        <p className="text-muted-foreground mt-1">
          {data?.position && data?.department
            ? `${data.position} — ${data.department}`
            : 'Bienvenido a tu portal de empleado'}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2 hover:border-bloque-gold500"
          onClick={() => router.push('/portal/payslips')}
        >
          <FileText className="h-6 w-6 text-bloque-navy900" />
          <span className="text-sm font-medium">Ver colillas</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2 hover:border-bloque-gold500"
          onClick={() => router.push('/portal/documents')}
        >
          <Download className="h-6 w-6 text-bloque-navy900" />
          <span className="text-sm font-medium">Descargar comprobante</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2 hover:border-bloque-gold500"
          onClick={() => router.push('/portal/assistant')}
        >
          <MessageCircle className="h-6 w-6 text-bloque-navy900" />
          <span className="text-sm font-medium">Preguntar al asistente</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2 hover:border-bloque-gold500"
          onClick={() => router.push('/portal/profile')}
        >
          <UserCircle className="h-6 w-6 text-bloque-navy900" />
          <span className="text-sm font-medium">Actualizar perfil</span>
        </Button>
      </div>

      {/* Main Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Last Payslip */}
        <BrandCard>
          <BrandCardHeader
            title="Ultima Colilla de Pago"
            description={
              lastPayslip
                ? `${monthName(lastPayslip.month)} ${lastPayslip.year}`
                : 'Sin colillas disponibles'
            }
            action={
              lastPayslip ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/portal/payslips/${lastPayslip.id}`)}
                >
                  Ver detalle
                </Button>
              ) : undefined
            }
          />
          {lastPayslip ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-bloque-slate200">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>Salario bruto</span>
                </div>
                <span className="font-semibold text-bloque-navy900">
                  {formatCurrency(lastPayslip.gross_salary)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-bloque-slate200">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span>Deducciones</span>
                </div>
                <span className="font-semibold text-red-600">
                  -{formatCurrency(lastPayslip.total_deductions)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2 font-medium text-bloque-navy900">
                  <Calendar className="h-4 w-4" />
                  <span>Salario neto</span>
                </div>
                <span className="text-xl font-bold text-green-600">
                  {formatCurrency(lastPayslip.net_salary)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Aun no tienes colillas de pago disponibles.
            </p>
          )}
        </BrandCard>

        {/* YTD Summary */}
        <BrandCard>
          <BrandCardHeader
            title="Resumen del Ano"
            description="Acumulado del ano fiscal actual"
          />
          {ytd ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-bloque-slate200">
                <span className="text-muted-foreground">Total bruto</span>
                <span className="font-semibold text-bloque-navy900">
                  {formatCurrency(ytd.total_gross)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-bloque-slate200">
                <span className="text-muted-foreground">ISSS acumulado</span>
                <span className="font-semibold">{formatCurrency(ytd.total_isss)}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-bloque-slate200">
                <span className="text-muted-foreground">AFP acumulado</span>
                <span className="font-semibold">{formatCurrency(ytd.total_afp)}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-bloque-slate200">
                <span className="text-muted-foreground">ISR acumulado</span>
                <span className="font-semibold">{formatCurrency(ytd.total_isr)}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="font-medium text-bloque-navy900">Total neto</span>
                <span className="text-xl font-bold text-green-600">
                  {formatCurrency(ytd.total_net)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No hay datos acumulados disponibles.
            </p>
          )}
        </BrandCard>
      </div>
    </div>
  )
}
