'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import {
  employeeApi,
  type EmployeeSalaryBreakdown,
} from '@/lib/api'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  AlertCircle,
  DollarSign,
  TrendingDown,
  Wallet,
  Heart,
  ShieldCheck,
  PiggyBank,
  Receipt,
} from 'lucide-react'

// ── Helpers ─────────────────────────────────────────────────────
function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatPercent(rate: number): string {
  return rate > 0 ? `${rate}%` : 'Progresiva'
}

function frequencyLabel(freq: string): string {
  const map: Record<string, string> = {
    MONTHLY: 'Mensual',
    BIWEEKLY: 'Quincenal',
    WEEKLY: 'Semanal',
  }
  return map[freq] || freq
}

// ── Page ────────────────────────────────────────────────────────
export default function SalaryBreakdownPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()

  const [data, setData] = useState<EmployeeSalaryBreakdown | null>(null)
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
        const res = await employeeApi.getSalaryBreakdown(accessToken)
        setData(res)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al cargar el desglose salarial'
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
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-60 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/portal')}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Portal
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-bloque-navy900">Desglose Salarial</h1>
          <p className="text-sm text-muted-foreground">
            Detalle de tu compensacion {frequencyLabel(data.payment_frequency).toLowerCase()}
          </p>
        </div>
      </div>

      {/* Current Salary Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BrandCard>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Salario bruto</p>
              <p className="text-xl font-bold text-bloque-navy900">
                {formatCurrency(data.base_salary, data.currency)}
              </p>
            </div>
          </div>
        </BrandCard>
        <BrandCard>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Deducciones</p>
              <p className="text-xl font-bold text-red-600">
                -{formatCurrency(data.total_employee_deductions, data.currency)}
              </p>
            </div>
          </div>
        </BrandCard>
        <BrandCard>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Salario neto</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(data.net_salary, data.currency)}
              </p>
            </div>
          </div>
        </BrandCard>
      </div>

      {/* Monthly Deductions Breakdown */}
      <BrandCard>
        <BrandCardHeader
          title="Desglose Mensual de Deducciones"
          description="Calculo detallado de cada deduccion aplicada"
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bloque-slate200">
              <th className="text-left py-3 font-medium text-muted-foreground">Concepto</th>
              <th className="text-right py-3 font-medium text-muted-foreground">Tasa</th>
              <th className="text-right py-3 font-medium text-muted-foreground">Tope</th>
              <th className="text-right py-3 font-medium text-muted-foreground">Empleado</th>
              <th className="text-right py-3 font-medium text-muted-foreground">Patronal</th>
            </tr>
          </thead>
          <tbody>
            {data.deductions.map((d, i) => (
              <tr key={i} className="border-b border-bloque-slate200 last:border-0">
                <td className="py-3 font-medium">{d.concept}</td>
                <td className="py-3 text-right text-muted-foreground">
                  {formatPercent(d.rate)}
                </td>
                <td className="py-3 text-right text-muted-foreground">
                  {d.cap ? formatCurrency(d.cap, data.currency) : 'Sin tope'}
                </td>
                <td className="py-3 text-right text-red-600">
                  -{formatCurrency(d.employee_amount, data.currency)}
                </td>
                <td className="py-3 text-right text-muted-foreground">
                  {formatCurrency(d.employer_amount, data.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-3" colSpan={3}>Total</td>
              <td className="py-3 text-right text-red-600">
                -{formatCurrency(data.total_employee_deductions, data.currency)}
              </td>
              <td className="py-3 text-right text-muted-foreground">
                {formatCurrency(data.total_employer_contributions, data.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </BrandCard>

      {/* Visual Breakdown */}
      <BrandCard>
        <BrandCardHeader title="Distribucion del Salario" />
        <div className="space-y-3">
          {/* Net bar */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Salario neto</span>
              <span className="font-medium text-green-600">
                {((data.net_salary / data.base_salary) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-4 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${(data.net_salary / data.base_salary) * 100}%` }}
              />
            </div>
          </div>
          {/* Deductions bar */}
          {data.deductions.map((d, i) => {
            const pct = (d.employee_amount / data.base_salary) * 100
            const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-purple-400']
            return (
              <div key={i}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{d.concept}</span>
                  <span className="font-medium">{pct.toFixed(1)}%</span>
                </div>
                <div className="h-4 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full ${colors[i % colors.length]} rounded-full transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </BrandCard>

      {/* YTD Summary */}
      <BrandCard>
        <BrandCardHeader
          title="Acumulado del Ano"
          description={`${data.ytd.months_paid} meses pagados`}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-3">
            <PiggyBank className="h-8 w-8 text-bloque-navy900" />
            <div>
              <p className="text-sm text-muted-foreground">Total bruto</p>
              <p className="text-lg font-bold">
                {formatCurrency(data.ytd.total_gross, data.currency)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Receipt className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total deducciones</p>
              <p className="text-lg font-bold text-red-600">
                {formatCurrency(data.ytd.total_deductions, data.currency)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Total neto</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(data.ytd.total_net, data.currency)}
              </p>
            </div>
          </div>
        </div>
      </BrandCard>

      {/* Benefits */}
      {data.benefits.length > 0 && (
        <BrandCard>
          <BrandCardHeader
            title="Beneficios"
            description="Prestaciones adicionales incluidas en tu compensacion"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.benefits.map((b, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-bloque-gray50"
              >
                <div className="h-8 w-8 rounded-full bg-bloque-gold500/20 flex items-center justify-center flex-shrink-0">
                  {i % 3 === 0 ? (
                    <Heart className="h-4 w-4 text-bloque-gold500" />
                  ) : i % 3 === 1 ? (
                    <ShieldCheck className="h-4 w-4 text-bloque-gold500" />
                  ) : (
                    <DollarSign className="h-4 w-4 text-bloque-gold500" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm text-bloque-navy900">{b.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{b.description}</p>
                  {b.value && (
                    <p className="text-xs font-medium text-bloque-gold500 mt-1">{b.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </BrandCard>
      )}
    </div>
  )
}
