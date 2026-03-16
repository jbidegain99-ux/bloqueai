'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import {
  employeeApi,
  type EmployeePayslipDetail,
} from '@/lib/api'
import { BrandCard } from '@/components/brand/BrandCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  Printer,
  Download,
  AlertCircle,
  Building2,
  User,
  Calendar,
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
export default function PayslipDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const payslipId = params.payslipId as string
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()

  const [data, setData] = useState<EmployeePayslipDetail | null>(null)
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
        const res = await employeeApi.getPayslip(accessToken, payslipId)
        setData(res)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al cargar la colilla'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isHydrated, isAuthenticated, accessToken, payslipId, router])

  // Auto-print if ?print=true
  useEffect(() => {
    if (data && searchParams.get('print') === 'true') {
      setTimeout(() => window.print(), 500)
    }
  }, [data, searchParams])

  const handlePrint = () => {
    window.print()
  }

  if (!isHydrated || loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Actions - hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.push('/portal/payslips')}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Volver a colillas
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Imprimir
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Download className="h-4 w-4 mr-1" />
            Descargar PDF
          </Button>
        </div>
      </div>

      {/* Payslip Document */}
      <BrandCard className="print:shadow-none print:border-0">
        {/* Header */}
        <div className="border-b-2 border-bloque-navy900 pb-4 mb-6">
          <div className="text-center">
            <h1 className="text-xl font-bold text-bloque-navy900 tracking-wide">
              COMPROBANTE DE PAGO
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {monthName(data.month)} {data.year}
            </p>
          </div>
        </div>

        {/* Company & Employee Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-bloque-navy900" />
              <span className="font-semibold text-sm text-bloque-navy900">EMPRESA</span>
            </div>
            <p className="text-sm font-medium">{data.company_name}</p>
            <p className="text-xs text-muted-foreground">NIT: {data.company_nit}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-bloque-navy900" />
              <span className="font-semibold text-sm text-bloque-navy900">EMPLEADO</span>
            </div>
            <p className="text-sm font-medium">{data.employee_name}</p>
            <p className="text-xs text-muted-foreground">DUI: {data.employee_id_number}</p>
            <p className="text-xs text-muted-foreground">
              {data.position} - {data.department}
            </p>
          </div>
        </div>

        {/* Payment Date */}
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Fecha de pago: {new Date(data.payment_date).toLocaleDateString('es-SV')}</span>
        </div>

        {/* Earnings */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-bloque-navy900 uppercase tracking-wide mb-3">
            Ingresos
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bloque-slate200">
                <th className="text-left py-2 font-medium text-muted-foreground">Concepto</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-bloque-slate200">
                <td className="py-2">Salario base</td>
                <td className="py-2 text-right">{formatCurrency(data.base_salary)}</td>
              </tr>
              {data.earnings.map((e, i) => (
                <tr key={i} className="border-b border-bloque-slate200">
                  <td className="py-2">{e.concept}</td>
                  <td className="py-2 text-right">{formatCurrency(e.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2">Total bruto</td>
                <td className="py-2 text-right">{formatCurrency(data.gross_salary)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Deductions */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-bloque-navy900 uppercase tracking-wide mb-3">
            Deducciones del Empleado
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bloque-slate200">
                <th className="text-left py-2 font-medium text-muted-foreground">Concepto</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Monto</th>
              </tr>
            </thead>
            <tbody>
              {data.deductions.map((d, i) => (
                <tr key={i} className="border-b border-bloque-slate200">
                  <td className="py-2">{d.concept}</td>
                  <td className="py-2 text-right text-red-600">
                    -{formatCurrency(d.employee_amount)}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2">Total deducciones</td>
                <td className="py-2 text-right text-red-600">
                  -{formatCurrency(data.total_deductions)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Net Salary */}
        <div className="bg-bloque-gray50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-bloque-navy900">SALARIO NETO</span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(data.net_salary)}
            </span>
          </div>
        </div>

        {/* Employer Contributions */}
        <div className="border-t border-bloque-slate200 pt-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Contribuciones Patronales (informativo)
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {data.employer_contributions.map((c, i) => (
                <tr key={i} className="border-b border-bloque-slate200 last:border-0">
                  <td className="py-2 text-muted-foreground">{c.concept}</td>
                  <td className="py-2 text-right text-muted-foreground">
                    {formatCurrency(c.employer_amount)}
                  </td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-2 text-muted-foreground">Total contribuciones</td>
                <td className="py-2 text-right text-muted-foreground">
                  {formatCurrency(data.total_employer_contributions)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-bloque-slate200 text-center">
          <p className="text-xs text-muted-foreground">
            Este comprobante es generado electronicamente y no requiere firma.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Generado por TalentOS - Bloque Internacional
          </p>
        </div>
      </BrandCard>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none,
          .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
