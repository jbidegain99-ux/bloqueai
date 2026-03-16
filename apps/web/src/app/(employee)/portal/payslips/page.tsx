'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import {
  employeeApi,
  type EmployeePayslipListItem,
} from '@/lib/api'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Download,
  Eye,
  ChevronLeft,
  AlertCircle,
  Calendar,
  DollarSign,
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

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PAID: 'Pagado',
    PENDING: 'Pendiente',
    PROCESSING: 'Procesando',
  }
  return map[status] || status
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    PROCESSING: 'bg-blue-100 text-blue-700',
  }
  return map[status] || 'bg-gray-100 text-gray-700'
}

// ── Page ────────────────────────────────────────────────────────
export default function PayslipsListPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()

  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [payslips, setPayslips] = useState<EmployeePayslipListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated || !accessToken) {
      router.push('/login')
      return
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await employeeApi.getPayslips(accessToken, selectedYear)
        setPayslips(res)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al cargar las colillas'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isHydrated, isAuthenticated, accessToken, selectedYear, router])

  if (!isHydrated) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/portal')}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Portal
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-bloque-navy900">Colillas de Pago</h1>
            <p className="text-sm text-muted-foreground">
              Historial de pagos y comprobantes
            </p>
          </div>
        </div>
        <Select
          value={String(selectedYear)}
          onValueChange={(v) => setSelectedYear(Number(v))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : payslips.length === 0 ? (
        <BrandCard className="py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sin colillas para {selectedYear}</h3>
          <p className="text-muted-foreground">
            No se encontraron colillas de pago para el ano seleccionado.
          </p>
        </BrandCard>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <BrandCard padding="sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-bloque-slate200 text-left">
                    <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Periodo</th>
                    <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-right">Bruto</th>
                    <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-right">Deducciones</th>
                    <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-right">Neto</th>
                    <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-bloque-slate200 last:border-0 hover:bg-bloque-gray50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {monthName(p.month)} {p.year}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(p.gross_salary)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        -{formatCurrency(p.total_deductions)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">
                        {formatCurrency(p.net_salary)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={statusColor(p.status)}>
                          {statusLabel(p.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/portal/payslips/${p.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/portal/payslips/${p.id}?print=true`)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BrandCard>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {payslips.map((p) => (
              <BrandCard
                key={p.id}
                hover
                onClick={() => router.push(`/portal/payslips/${p.id}`)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-bloque-navy900">
                      {monthName(p.month)} {p.year}
                    </span>
                  </div>
                  <Badge className={statusColor(p.status)}>
                    {statusLabel(p.status)}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Bruto</p>
                    <p className="font-medium">{formatCurrency(p.gross_salary)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Deducciones</p>
                    <p className="font-medium text-red-600">
                      -{formatCurrency(p.total_deductions)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Neto</p>
                    <p className="font-bold text-green-600">
                      {formatCurrency(p.net_salary)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-bloque-slate200">
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Descargar
                  </Button>
                </div>
              </BrandCard>
            ))}
          </div>

          {/* Summary */}
          <BrandCard>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-5 w-5 text-bloque-navy900" />
              <h3 className="font-semibold text-bloque-navy900">
                Resumen {selectedYear}
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Total bruto</p>
                <p className="text-lg font-bold text-bloque-navy900">
                  {formatCurrency(
                    payslips.reduce((sum, p) => sum + p.gross_salary, 0)
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total deducciones</p>
                <p className="text-lg font-bold text-red-600">
                  {formatCurrency(
                    payslips.reduce((sum, p) => sum + p.total_deductions, 0)
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total neto</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(
                    payslips.reduce((sum, p) => sum + p.net_salary, 0)
                  )}
                </p>
              </div>
            </div>
          </BrandCard>
        </>
      )}
    </div>
  )
}
