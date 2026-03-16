'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  FileText,
  Bot,
  BarChart3,
  Users,
  Building2,
  Briefcase,
  CheckCircle,
  ArrowRight,
  Clock,
  Shield,
  TrendingUp,
  Zap,
  Menu,
  X,
} from 'lucide-react'
import { getErrorMessage } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    country: '',
    roles_needed: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/public/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Error al enviar el formulario')
      }

      setSubmitted(true)
      setFormData({ name: '', email: '', company: '', country: '', roles_needed: '', message: '' })
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Error al enviar. Intenta nuevamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm z-50 border-b border-bloque-slate200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-bloque-navy900 rounded-lg flex items-center justify-center">
                <span className="text-bloque-gold500 font-bold text-sm">T</span>
              </div>
              <span className="text-bloque-navy900 font-bold text-lg">TalentOS</span>
              <span className="text-xs text-bloque-slate200 hidden sm:inline">by Bloque</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#como-funciona" className="text-sm text-bloque-navy700 hover:text-bloque-navy900">
                Como funciona
              </a>
              <a href="#beneficios" className="text-sm text-bloque-navy700 hover:text-bloque-navy900">
                Beneficios
              </a>
              <a href="#planes" className="text-sm text-bloque-navy700 hover:text-bloque-navy900">
                Planes
              </a>
              <a href="#contacto" className="text-sm text-bloque-navy700 hover:text-bloque-navy900">
                Contacto
              </a>
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Iniciar sesion
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-bloque-gold500 text-bloque-navy900 hover:bg-bloque-gold500/90">
                  Registrarse
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-bloque-slate200 py-4">
            <div className="flex flex-col gap-4 px-4">
              <a href="#como-funciona" className="text-sm text-bloque-navy700" onClick={() => setMobileMenuOpen(false)}>
                Como funciona
              </a>
              <a href="#beneficios" className="text-sm text-bloque-navy700" onClick={() => setMobileMenuOpen(false)}>
                Beneficios
              </a>
              <a href="#planes" className="text-sm text-bloque-navy700" onClick={() => setMobileMenuOpen(false)}>
                Planes
              </a>
              <a href="#contacto" className="text-sm text-bloque-navy700" onClick={() => setMobileMenuOpen(false)}>
                Contacto
              </a>
              <Link href="/login">
                <Button variant="outline" size="sm" className="w-full">
                  Iniciar sesion
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="w-full bg-bloque-gold500 text-bloque-navy900 hover:bg-bloque-gold500/90">
                  Registrarse
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-bloque-navy900 via-bloque-navy700 to-bloque-blue600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Reclutamiento inteligente con{' '}
              <span className="text-bloque-gold500">IA</span>
            </h1>
            <p className="text-xl text-bloque-slate200 mb-8 max-w-3xl mx-auto">
              TalentOS automatiza el filtrado, entrevistas y ranking de candidatos
              para entregarte shortlists en tiempo record.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#contacto">
                <Button size="lg" className="bg-bloque-gold500 text-bloque-navy900 hover:bg-bloque-gold500/90 w-full sm:w-auto">
                  Solicitar demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <Link href="/register">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 w-full sm:w-auto">
                  Comenzar gratis
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-bloque-gold500">72h</div>
              <div className="text-sm text-bloque-slate200">Tiempo a shortlist</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-bloque-gold500">85%</div>
              <div className="text-sm text-bloque-slate200">Reduccion de tiempo</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-bloque-gold500">100%</div>
              <div className="text-sm text-bloque-slate200">Trazabilidad</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-bloque-gold500">0</div>
              <div className="text-sm text-bloque-slate200">Sesgo inconsciente</div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-20 bg-bloque-gray50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-bloque-navy900 mb-4">
              Como funciona
            </h2>
            <p className="text-bloque-navy700 max-w-2xl mx-auto">
              Tres pasos para transformar tu proceso de reclutamiento
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-bloque-slate200">
              <div className="w-14 h-14 bg-bloque-navy900 rounded-xl flex items-center justify-center mb-6">
                <FileText className="h-7 w-7 text-bloque-gold500" />
              </div>
              <div className="text-sm text-bloque-gold500 font-semibold mb-2">Paso 1</div>
              <h3 className="text-xl font-bold text-bloque-navy900 mb-4">
                CV Parsing con IA
              </h3>
              <ul className="space-y-3 text-bloque-navy700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Extraccion automatica de skills y experiencia</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Soporte para PDF y DOCX</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Estructuracion de datos para matching</span>
                </li>
              </ul>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-bloque-slate200">
              <div className="w-14 h-14 bg-bloque-navy900 rounded-xl flex items-center justify-center mb-6">
                <Bot className="h-7 w-7 text-bloque-gold500" />
              </div>
              <div className="text-sm text-bloque-gold500 font-semibold mb-2">Paso 2</div>
              <h3 className="text-xl font-bold text-bloque-navy900 mb-4">
                Entrevista con IA
              </h3>
              <ul className="space-y-3 text-bloque-navy700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Evaluacion de competencias estandarizada</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Preguntas adaptativas por rol</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Transcripcion y analisis automatico</span>
                </li>
              </ul>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-bloque-slate200">
              <div className="w-14 h-14 bg-bloque-navy900 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="h-7 w-7 text-bloque-gold500" />
              </div>
              <div className="text-sm text-bloque-gold500 font-semibold mb-2">Paso 3</div>
              <h3 className="text-xl font-bold text-bloque-navy900 mb-4">
                Ranking + Shortlist
              </h3>
              <ul className="space-y-3 text-bloque-navy700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Score compuesto por criterios configurables</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Explicacion de razones y riesgos</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Exportacion a CSV para tu ATS</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="beneficios" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-bloque-navy900 mb-4">
              Beneficios cuantificables
            </h2>
            <p className="text-bloque-navy700 max-w-2xl mx-auto">
              Resultados medibles que impactan tu operacion de talento
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-6 rounded-xl bg-bloque-gray50">
              <Clock className="h-10 w-10 text-bloque-navy900 mx-auto mb-4" />
              <h3 className="font-bold text-bloque-navy900 mb-2">Ahorra tiempo</h3>
              <p className="text-sm text-bloque-navy700">
                De semanas a horas. Shortlist listo en 72h maximo.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl bg-bloque-gray50">
              <Shield className="h-10 w-10 text-bloque-navy900 mx-auto mb-4" />
              <h3 className="font-bold text-bloque-navy900 mb-2">Menos sesgo</h3>
              <p className="text-sm text-bloque-navy700">
                Evaluacion objetiva basada en competencias, no en apariencias.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl bg-bloque-gray50">
              <TrendingUp className="h-10 w-10 text-bloque-navy900 mx-auto mb-4" />
              <h3 className="font-bold text-bloque-navy900 mb-2">Consistencia</h3>
              <p className="text-sm text-bloque-navy700">
                Mismos criterios para todos los candidatos, siempre.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl bg-bloque-gray50">
              <Zap className="h-10 w-10 text-bloque-navy900 mx-auto mb-4" />
              <h3 className="font-bold text-bloque-navy900 mb-2">Trazabilidad</h3>
              <p className="text-sm text-bloque-navy700">
                Auditoria completa de cada decision con evidencia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For whom */}
      <section className="py-20 bg-bloque-navy900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Para quien es TalentOS
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-bloque-gold500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8 text-bloque-gold500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Empresas</h3>
              <p className="text-bloque-slate200">
                Hiring Managers que necesitan contratar rapido y bien.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-bloque-gold500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="h-8 w-8 text-bloque-gold500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Recruiters / HR</h3>
              <p className="text-bloque-slate200">
                Profesionales que quieren automatizar el filtrado inicial.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-bloque-gold500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-bloque-gold500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Talento</h3>
              <p className="text-bloque-slate200">
                Candidatos que quieren un proceso justo y transparente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planes" className="py-20 bg-bloque-gray50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-bloque-navy900 mb-4">
              Planes y servicios
            </h2>
            <p className="text-bloque-navy700 max-w-2xl mx-auto">
              Opciones flexibles para cada etapa de tu empresa
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Pilot */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-bloque-slate200">
              <div className="text-sm text-bloque-gold500 font-semibold mb-2">Piloto</div>
              <h3 className="text-2xl font-bold text-bloque-navy900 mb-2">
                Por rol
              </h3>
              <p className="text-bloque-navy700 mb-6">
                Ideal para probar con un proceso especifico.
              </p>
              <ul className="space-y-3 mb-8 text-sm text-bloque-navy700">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Hasta 50 candidatos
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  CV parsing + entrevista IA
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Shortlist con scores
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Soporte por email
                </li>
              </ul>
              <a href="#contacto">
                <Button className="w-full" variant="outline">
                  Solicitar cotizacion
                </Button>
              </a>
            </div>

            {/* Company */}
            <div className="bg-bloque-navy900 rounded-xl p-8 shadow-lg border-2 border-bloque-gold500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-bloque-gold500 text-bloque-navy900 text-xs font-bold px-3 py-1 rounded-full">
                Recomendado
              </div>
              <div className="text-sm text-bloque-gold500 font-semibold mb-2">Empresa</div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Suscripcion
              </h3>
              <p className="text-bloque-slate200 mb-6">
                Para equipos con volumen recurrente.
              </p>
              <ul className="space-y-3 mb-8 text-sm text-bloque-slate200">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-bloque-gold500" />
                  Candidatos ilimitados
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-bloque-gold500" />
                  Rubricas personalizadas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-bloque-gold500" />
                  Dashboard y analytics
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-bloque-gold500" />
                  Soporte prioritario
                </li>
              </ul>
              <a href="#contacto">
                <Button className="w-full bg-bloque-gold500 text-bloque-navy900 hover:bg-bloque-gold500/90">
                  Agenda llamada
                </Button>
              </a>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-bloque-slate200">
              <div className="text-sm text-bloque-gold500 font-semibold mb-2">Enterprise</div>
              <h3 className="text-2xl font-bold text-bloque-navy900 mb-2">
                Custom
              </h3>
              <p className="text-bloque-navy700 mb-6">
                Integraciones y SLA a medida.
              </p>
              <ul className="space-y-3 mb-8 text-sm text-bloque-navy700">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Todo de Empresa
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  API para integracion
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  SSO y compliance
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Account manager dedicado
                </li>
              </ul>
              <a href="#contacto">
                <Button className="w-full" variant="outline">
                  Contactanos
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contacto" className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-bloque-navy900 mb-4">
              Solicita una demo
            </h2>
            <p className="text-bloque-navy700">
              Cuentanos sobre tu necesidad y te contactamos en menos de 24 horas.
            </p>
          </div>

          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-green-800 mb-2">
                Gracias por tu interes
              </h3>
              <p className="text-green-700">
                Hemos recibido tu solicitud. Nos pondremos en contacto contigo pronto.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-xl p-8 shadow-sm border border-bloque-slate200">
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Tu nombre"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="tu@empresa.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="company">Empresa</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Nombre de tu empresa"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Pais</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="Mexico, Colombia, etc."
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="mb-6">
                <Label htmlFor="roles">Roles que necesitas contratar</Label>
                <Input
                  id="roles"
                  value={formData.roles_needed}
                  onChange={(e) => setFormData({ ...formData, roles_needed: e.target.value })}
                  placeholder="Ej: 3 desarrolladores senior, 2 data scientists"
                  className="mt-1"
                />
              </div>

              <div className="mb-6">
                <Label htmlFor="message">Mensaje (opcional)</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Cuentanos mas sobre tu necesidad..."
                  className="mt-1"
                  rows={4}
                />
              </div>

              {error && (
                <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-bloque-navy900 hover:bg-bloque-navy700"
                disabled={submitting}
              >
                {submitting ? 'Enviando...' : 'Enviar solicitud'}
              </Button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-bloque-navy900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-bloque-gold500 rounded-lg flex items-center justify-center">
                <span className="text-bloque-navy900 font-bold text-sm">T</span>
              </div>
              <span className="text-white font-bold">TalentOS</span>
              <span className="text-bloque-slate200 text-sm">by Bloque Internacional</span>
            </div>

            <div className="flex gap-8 text-sm text-bloque-slate200">
              <Link href="/login" className="hover:text-white">
                Iniciar sesion
              </Link>
              <a href="#contacto" className="hover:text-white">
                Contacto
              </a>
            </div>

            <div className="text-sm text-bloque-slate200">
              contacto@bloque.com
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-bloque-navy700 text-center text-sm text-bloque-slate200">
            2024 Bloque Internacional. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}
