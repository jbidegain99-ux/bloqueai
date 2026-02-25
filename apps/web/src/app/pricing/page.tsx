'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { Check, Sparkles, ArrowRight } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PlanFeature {
  text: string
  included: boolean
}

interface PricingPlan {
  name: string
  description: string
  monthlyPrice: number | null
  annualPrice: number | null
  priceLabel: string | null
  features: PlanFeature[]
  cta: string
  ctaHref: string
  highlighted: boolean
  badge: string | null
}

type BillingCycle = 'monthly' | 'annual'

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const plans: PricingPlan[] = [
  {
    name: 'Free',
    description: 'Para equipos pequeños que están comenzando con la contratación.',
    monthlyPrice: 0,
    annualPrice: 0,
    priceLabel: null,
    features: [
      { text: 'Hasta 3 publicaciones de empleo activas', included: true },
      { text: 'Evaluación básica con IA', included: true },
      { text: 'Panel de candidatos', included: true },
      { text: 'Integración con correo electrónico', included: true },
      { text: 'Soporte por comunidad', included: true },
      { text: 'Reportes avanzados', included: false },
      { text: 'Entrevistas con IA', included: false },
      { text: 'Nómina & EOR', included: false },
    ],
    cta: 'Empezar gratis',
    ctaHref: '/register',
    highlighted: false,
    badge: null,
  },
  {
    name: 'Growth',
    description: 'Ideal para empresas en crecimiento con necesidades de contratación recurrentes.',
    monthlyPrice: 99,
    annualPrice: 82,
    priceLabel: null,
    features: [
      { text: 'Hasta 15 publicaciones de empleo activas', included: true },
      { text: 'Evaluación avanzada con IA', included: true },
      { text: 'Shortlists inteligentes', included: true },
      { text: 'Entrevistas con IA (50/mes)', included: true },
      { text: 'Reportes y analítica', included: true },
      { text: 'Integraciones con ATS', included: true },
      { text: 'Soporte por email prioritario', included: true },
      { text: 'Nómina & EOR', included: false },
    ],
    cta: 'Iniciar prueba gratuita',
    ctaHref: '/register',
    highlighted: false,
    badge: null,
  },
  {
    name: 'Professional',
    description: 'Para empresas que necesitan automatización completa de reclutamiento.',
    monthlyPrice: 249,
    annualPrice: 207,
    priceLabel: null,
    features: [
      { text: 'Publicaciones de empleo ilimitadas', included: true },
      { text: 'IA generativa para descripciones', included: true },
      { text: 'Shortlists y matching avanzado', included: true },
      { text: 'Entrevistas con IA ilimitadas', included: true },
      { text: 'Nómina & EOR (hasta 50 empleados)', included: true },
      { text: 'Rúbricas personalizadas', included: true },
      { text: 'Dashboard de KPIs', included: true },
      { text: 'Soporte prioritario 24/7', included: true },
    ],
    cta: 'Iniciar prueba gratuita',
    ctaHref: '/register',
    highlighted: true,
    badge: 'Más popular',
  },
  {
    name: 'Enterprise',
    description: 'Solución completa para organizaciones con operaciones a gran escala.',
    monthlyPrice: null,
    annualPrice: null,
    priceLabel: 'Personalizado',
    features: [
      { text: 'Todo lo incluido en Professional', included: true },
      { text: 'Nómina & EOR ilimitados', included: true },
      { text: 'SSO & SCIM provisioning', included: true },
      { text: 'API personalizada', included: true },
      { text: 'Onboarding dedicado', included: true },
      { text: 'SLA garantizado (99.9%)', included: true },
      { text: 'Gerente de cuenta dedicado', included: true },
      { text: 'Facturación personalizada', included: true },
    ],
    cta: 'Contactar ventas',
    ctaHref: '/contact',
    highlighted: false,
    badge: null,
  },
]

const faqs: { question: string; answer: string }[] = [
  {
    question: '¿Puedo cambiar de plan en cualquier momento?',
    answer:
      'Sí, puedes actualizar o cambiar tu plan en cualquier momento. Los cambios se aplican de inmediato y se prorratea el cobro.',
  },
  {
    question: '¿Qué incluye la prueba gratuita?',
    answer:
      'La prueba gratuita de 14 días incluye todas las funcionalidades del plan seleccionado sin necesidad de tarjeta de crédito.',
  },
  {
    question: '¿Ofrecen descuentos para startups?',
    answer:
      'Sí, ofrecemos descuentos especiales para startups en etapa temprana. Contáctanos para más información.',
  },
  {
    question: '¿Cómo funciona la nómina & EOR?',
    answer:
      'Nuestro servicio de Employer of Record te permite contratar empleados en Latinoamérica sin necesidad de crear una entidad legal. Nosotros gestionamos la nómina, beneficios y cumplimiento legal.',
  },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatPrice(price: number): string {
  return price === 0 ? '$0' : `$${price}`
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
}

const faqVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.3 + i * 0.08, duration: 0.4, ease: 'easeOut' },
  }),
}

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>('monthly')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* ---- Header / Hero ---- */}
      <section className="relative overflow-hidden pt-24 pb-16 text-center">
        {/* Decorative gradient blob */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-transparent blur-3xl"
        />

        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl lg:text-6xl"
        >
          Planes y precios
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400"
        >
          Elige el plan que mejor se adapte a tu empresa. Todos incluyen prueba
          gratuita de 14 días sin compromiso.
        </motion.p>

        {/* Billing toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="relative mt-10 inline-flex items-center gap-3 rounded-full bg-white p-1 shadow-sm ring-1 ring-gray-200 dark:bg-slate-800 dark:ring-slate-700"
        >
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              billing === 'monthly'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => setBilling('annual')}
            className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              billing === 'annual'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Anual
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">
              -17%
            </span>
          </button>
        </motion.div>
      </section>

      {/* ---- Plan Cards ---- */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => {
            const price =
              billing === 'monthly' ? plan.monthlyPrice : plan.annualPrice

            return (
              <motion.div
                key={plan.name}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={cardVariants}
                className={`relative flex flex-col rounded-2xl border p-8 shadow-sm transition-shadow hover:shadow-lg ${
                  plan.highlighted
                    ? 'border-indigo-500 bg-white ring-2 ring-indigo-500/30 dark:border-indigo-400 dark:bg-slate-900 dark:ring-indigo-400/20'
                    : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow">
                    <Sparkles className="h-3.5 w-3.5" />
                    {plan.badge}
                  </span>
                )}

                {/* Plan name & description */}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mt-6 flex items-baseline gap-1">
                  {price !== null ? (
                    <>
                      <span className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                        {formatPrice(price)}
                      </span>
                      {price > 0 && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          /mes
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                      {plan.priceLabel}
                    </span>
                  )}
                </div>

                {billing === 'annual' && price !== null && price > 0 && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Facturado anualmente (${price * 12}/año)
                  </p>
                )}

                {/* CTA */}
                <Link
                  href={plan.ctaHref}
                  className={`mt-8 flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                    plan.highlighted
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/25'
                      : plan.monthlyPrice === 0
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : plan.monthlyPrice === null
                          ? 'border border-gray-300 bg-transparent text-gray-900 hover:bg-gray-100 dark:border-slate-600 dark:text-gray-100 dark:hover:bg-slate-800'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>

                {/* Divider */}
                <div className="my-8 h-px bg-gray-200 dark:bg-slate-700" />

                {/* Features */}
                <ul className="flex flex-1 flex-col gap-3 text-sm">
                  {plan.features.map((feature) => (
                    <li
                      key={feature.text}
                      className={`flex items-start gap-2.5 ${
                        feature.included
                          ? 'text-gray-700 dark:text-gray-300'
                          : 'text-gray-400 dark:text-gray-600'
                      }`}
                    >
                      <Check
                        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                          feature.included
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-300 dark:text-gray-700'
                        }`}
                      />
                      <span className={feature.included ? '' : 'line-through'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ---- FAQ Section ---- */}
      <section className="border-t border-gray-200 bg-white py-24 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Preguntas frecuentes
          </h2>

          <dl className="mt-12 space-y-8">
            {faqs.map((faq, i) => (
              <motion.div
                key={faq.question}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={faqVariants}
              >
                <dt className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {faq.question}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {faq.answer}
                </dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---- Bottom CTA ---- */}
      <section className="bg-gray-50 py-20 dark:bg-slate-950">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center px-4"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            ¿Listo para transformar tu proceso de contratación?
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Comienza tu prueba gratuita de 14 días. Sin tarjeta de crédito
            requerida.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-colors hover:bg-blue-700"
            >
              Empezar gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 dark:border-slate-600 dark:text-gray-100 dark:hover:bg-slate-800"
            >
              Contactar ventas
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
