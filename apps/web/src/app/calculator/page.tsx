'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Logo } from '@/components/brand/Logo'
import { BrandCard } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { eorApi } from '@/lib/api'
import type { EORCalculatorResult } from '@/lib/api'
import { smooth } from '@/lib/animations'
import {
  Calculator,
  DollarSign,
  TrendingDown,
  Building2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// ── FAQ data ─────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'Que es un servicio EOR?',
    a: 'Employer of Record (EOR) significa que Bloque actua como el empleador legal en El Salvador. Nos encargamos de contratos, nomina, ISSS, AFP, ISR y cumplimiento laboral mientras tu gestionas el trabajo diario.',
  },
  {
    q: 'Que incluye el costo mensual?',
    a: 'Incluye salario neto del empleado, contribuciones patronales (ISSS 7.5%, AFP 7.75%), ISR, y el fee de servicio de $349/mes. No hay costos ocultos.',
  },
  {
    q: 'Como funciona el aguinaldo en El Salvador?',
    a: 'El aguinaldo es obligatorio y se paga entre el 12-20 de diciembre. Son 15 dias de salario si el empleado tiene 1-3 anos, 19 dias con 3-10 anos, y 21 dias con mas de 10 anos.',
  },
  {
    q: 'Cuantos dias de vacaciones tiene un empleado?',
    a: 'Despues de cumplir 1 ano de trabajo continuo, el empleado tiene derecho a 15 dias de vacacion remunerada, mas un recargo del 30% sobre el salario de esos dias.',
  },
]

// ── FAQ Accordion ────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-neutral-200 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-4 text-left"
      >
        <span className="text-sm font-medium text-bloque-navy900">{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-neutral-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-neutral-400 flex-shrink-0" />
        )}
      </button>
      {open && (
        <p className="text-sm text-neutral-600 pb-4 leading-relaxed">{a}</p>
      )}
    </div>
  )
}

// ── Breakdown row ────────────────────────────────────────

function Row({
  label,
  value,
  bold,
  negative,
  highlight,
}: {
  label: string
  value: number
  bold?: boolean
  negative?: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={`flex justify-between py-2 ${
        bold ? 'border-t border-neutral-300 pt-3 mt-1' : ''
      }`}
    >
      <span
        className={`text-sm ${
          bold ? 'font-semibold text-bloque-navy900' : 'text-neutral-600'
        }`}
      >
        {label}
      </span>
      <span
        className={`text-sm tabular-nums font-medium ${
          highlight
            ? 'text-brand-600 font-bold'
            : negative
            ? 'text-error-500'
            : 'text-bloque-navy900'
        }`}
      >
        {negative ? '-' : ''}${Math.abs(value).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────

export default function CalculatorPage() {
  const [salary, setSalary] = useState('2000')
  const [salaryType, setSalaryType] = useState<'gross' | 'net'>('gross')
  const [result, setResult] = useState<EORCalculatorResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const calculate = async (val?: string, type?: string) => {
    const s = parseFloat(val ?? salary)
    if (!s || s <= 0) return
    setLoading(true)
    setError('')
    try {
      const data = await eorApi.calculate(s, type ?? salaryType)
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al calcular')
    } finally {
      setLoading(false)
    }
  }

  // Initial calculation
  useEffect(() => {
    calculate()
  }, [])

  // Recalculate on salary type change
  useEffect(() => {
    if (salary) calculate(salary, salaryType)
  }, [salaryType])

  return (
    <div className="min-h-screen bg-bloque-gray50">
      {/* Nav */}
      <header className="bg-bloque-navy900 text-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <Logo variant="full" size="md" />
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10">
                Iniciar sesion
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-bloque-navy900 via-bloque-navy700 to-bloque-blue600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={smooth}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full text-sm mb-6">
              <Calculator className="h-4 w-4" />
              Calculadora EOR El Salvador
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Calcula el costo de contratar en El Salvador
            </h1>
            <p className="text-lg text-white/80 max-w-2xl mx-auto">
              Conoce el desglose exacto de salario, deducciones y contribuciones
              patronales al instante.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Calculator */}
      <section className="container mx-auto px-4 -mt-8 relative z-10 mb-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Input card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...smooth, delay: 0.1 }}
          >
            <BrandCard className="h-full">
              <h2 className="text-lg font-semibold text-bloque-navy900 mb-4">
                Ingresa el salario
              </h2>

              {/* Toggle gross/net */}
              <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg mb-4">
                {([
                  { id: 'gross' as const, label: 'Salario Bruto' },
                  { id: 'net' as const, label: 'Salario Neto Deseado' },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSalaryType(opt.id)}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                      salaryType === opt.id
                        ? 'bg-white text-bloque-navy900 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="salary">Monto mensual (USD)</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      id="salary"
                      type="number"
                      step="50"
                      min="0"
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && calculate()}
                      className="pl-9"
                      placeholder="2000.00"
                    />
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => calculate()}
                  disabled={loading}
                >
                  {loading ? 'Calculando...' : 'Calcular'}
                </Button>

                {error && (
                  <p className="text-sm text-error-500">{error}</p>
                )}
              </div>

              <p className="text-xs text-neutral-400 mt-4">
                Tasas vigentes 2024-2025. ISSS empleado 3% (tope $1,000), AFP empleado
                7.25%. Incluye fee de servicio EOR de $349/mes.
              </p>
            </BrandCard>
          </motion.div>

          {/* Result card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...smooth, delay: 0.2 }}
          >
            {result ? (
              <BrandCard className="h-full">
                <h2 className="text-lg font-semibold text-bloque-navy900 mb-4">
                  Desglose mensual
                </h2>

                {/* Employee section */}
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-2">
                    Empleado
                  </p>
                  <Row label="Salario Bruto" value={result.salario_bruto} />
                  <Row label="ISSS (3%)" value={result.isss_empleado} negative />
                  <Row label="AFP (7.25%)" value={result.afp_empleado} negative />
                  <Row label="ISR" value={result.isr} negative />
                  <Row label="Total Deducciones" value={result.total_deducciones} negative bold />
                  <Row label="Salario Neto" value={result.salario_neto} bold highlight />
                </div>

                {/* Employer section */}
                <div>
                  <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-2">
                    Empleador (su costo)
                  </p>
                  <Row label="ISSS Patronal (7.5%)" value={result.isss_patronal} />
                  <Row label="AFP Patronal (7.75%)" value={result.afp_patronal} />
                  <Row label="Subtotal Patronal" value={result.subtotal_empleador} />
                  <Row label="Fee TalentOS" value={result.fee_talentos} />
                  <Row label="Costo Total Mensual" value={result.costo_total_mensual} bold highlight />
                </div>
              </BrandCard>
            ) : (
              <BrandCard className="h-full flex items-center justify-center">
                <div className="text-center py-12">
                  <Calculator className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">
                    Ingresa un salario para ver el desglose
                  </p>
                </div>
              </BrandCard>
            )}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-16 border-t border-neutral-200">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-bloque-navy900 mb-3">
            Listo para contratar en El Salvador?
          </h2>
          <p className="text-neutral-600 mb-6 max-w-lg mx-auto">
            Nosotros nos encargamos de todo: contratos, nomina, ISSS, AFP y
            cumplimiento legal. Tu solo te enfocas en tu equipo.
          </p>
          <Link href="/register">
            <Button variant="primary" size="lg">
              Comenzar ahora
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-bloque-navy900 mb-6 text-center">
            Preguntas frecuentes
          </h2>
          <BrandCard>
            {FAQ_ITEMS.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </BrandCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-bloque-navy900 text-white/60 py-8">
        <div className="container mx-auto px-4 text-center text-sm">
          <p>© 2024 TalentOS by Bloque Internacional. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
