'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Mail, Lock } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authApi, employeeApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/animations'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const emailValue = emailRef.current?.value?.trim() || ''
    const passwordValue = passwordRef.current?.value || ''

    const errors: { email?: string; password?: string } = {}
    if (!emailValue) errors.email = 'Ingresa tu correo electrónico'
    if (!passwordValue) errors.password = 'Ingresa tu contraseña'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      if (errors.email) emailRef.current?.focus()
      else if (errors.password) passwordRef.current?.focus()
      return
    }

    setLoading(true)

    try {
      const tokens = await authApi.login(emailValue, passwordValue)
      const user = await authApi.me(tokens.access_token) as Parameters<typeof setAuth>[0]
      if (!user) throw new Error('No se pudo obtener el perfil del usuario')
      setAuth(user, tokens.access_token, tokens.refresh_token)
      toast.success('¡Bienvenido!', { description: 'Redirigiendo...' })

      // Role-based redirect
      // Check if user is a payroll employee (has Employee record linked)
      let isPayrollEmployee = false
      try {
        await employeeApi.getProfile(tokens.access_token)
        isPayrollEmployee = true
      } catch {
        // Not a payroll employee — that's fine
      }

      if (isPayrollEmployee) {
        router.push('/portal')
      } else if (user.role === 'ADMIN') {
        router.push('/admin/payroll/dashboard')
      } else if (user.role === 'RECRUITER') {
        router.push('/admin/dashboard')
      } else if (user.role === 'EMPLOYER') {
        router.push('/employer/dashboard')
      } else if (user.role === 'CANDIDATE') {
        router.push('/dashboard')
      } else {
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      let message = 'Error al iniciar sesión. Intente de nuevo.'
      if (err instanceof Error) {
        if (err.name === 'TypeError') {
          message = 'No se pudo conectar con el servidor. Verifique la conexión.'
        } else {
          message = err.message
        }
      } else if (typeof err === 'string') {
        message = err
      }
      setError(message)
      toast.error('Error al iniciar sesión', { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Brand Hero */}
      <motion.div
        className="hidden lg:flex lg:w-1/2 brand-gradient relative overflow-hidden"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        <motion.div
          className="relative z-10 flex flex-col justify-center px-12"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={staggerItem}>
            <Logo size="lg" variant="full" className="mb-8" />
          </motion.div>
          <motion.h1 variants={staggerItem} className="text-4xl font-bold text-white mb-4">
            Reclutamiento inteligente con IA
          </motion.h1>
          <motion.p variants={staggerItem} className="text-xl text-bloque-slate200 mb-8">
            Encuentra el talento perfecto con nuestra plataforma de reclutamiento
            potenciada por inteligencia artificial.
          </motion.p>
          <motion.div variants={staggerItem} className="flex gap-4">
            <div className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 bg-bloque-gold500 rounded-full flex items-center justify-center">
                <span className="text-bloque-navy900 font-bold">1</span>
              </div>
              <span>CV Parsing IA</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 bg-bloque-gold500 rounded-full flex items-center justify-center">
                <span className="text-bloque-navy900 font-bold">2</span>
              </div>
              <span>Entrevista IA</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 bg-bloque-gold500 rounded-full flex items-center justify-center">
                <span className="text-bloque-navy900 font-bold">3</span>
              </div>
              <span>Ranking Inteligente</span>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-bloque-gray50">
        <motion.div
          className="w-full max-w-md"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          <Card className="rounded-xl shadow-elevated border-neutral-200">
            <CardHeader className="text-center">
              <div className="lg:hidden flex justify-center mb-4">
                <div className="bg-bloque-navy900 p-3 rounded-lg">
                  <Logo size="md" variant="full" />
                </div>
              </div>
              <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
              <CardDescription>
                Ingresa tus credenciales para acceder a TalentOS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {error && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-error-50 text-error-600 p-3 rounded-lg text-sm border border-error-500/20"
                  >
                    {error}
                  </motion.div>
                )}

                <FormField label="Correo electrónico" error={fieldErrors.email}>
                  <Input
                    ref={emailRef}
                    id="email"
                    name="email"
                    type="email"
                    placeholder="tu@email.com"
                    autoComplete="email"
                    disabled={loading}
                    error={!!fieldErrors.email}
                    leftIcon={<Mail className="h-4 w-4" />}
                  />
                </FormField>

                <FormField label="Contraseña" error={fieldErrors.password}>
                  <Input
                    ref={passwordRef}
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    error={!!fieldErrors.password}
                    leftIcon={<Lock className="h-4 w-4" />}
                  />
                </FormField>

                <Button type="submit" className="w-full" isLoading={loading}>
                  Ingresar
                </Button>

                <div className="text-center text-sm text-neutral-500">
                  ¿No tienes cuenta?{' '}
                  <Link href="/register" className="text-brand-600 hover:text-brand-700 hover:underline font-medium transition-colors">
                    Regístrate
                  </Link>
                </div>
              </form>

              {/* Demo credentials */}
              <div className="mt-6 p-4 bg-neutral-50 rounded-lg border border-neutral-100">
                <p className="text-sm font-medium text-neutral-700 mb-2">
                  Cuentas de prueba:
                </p>
                <div className="text-xs text-neutral-500 space-y-1">
                  <p><strong>Admin (Nomina):</strong> admin@example.com / Admin123!</p>
                  <p><strong>Recruiter (Talento):</strong> recruiter@example.com / Recruiter123!</p>
                  <p><strong>Employer:</strong> employer@example.com / Employer123!</p>
                  <p><strong>Empleado 1:</strong> employee1@example.com / Employee123!</p>
                  <p><strong>Empleado 2:</strong> employee2@example.com / Employee123!</p>
                  <p><strong>Candidato:</strong> candidate1@example.com / Candidate123!</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
