'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Use refs to get actual input values at submit time (avoids React state race conditions)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    // Get values directly from DOM at submit time - this avoids state sync issues
    const emailValue = emailRef.current?.value?.trim() || ''
    const passwordValue = passwordRef.current?.value || ''

    // Validate using actual DOM values
    if (!emailValue) {
      setError('Por favor ingresa tu correo electrónico')
      emailRef.current?.focus()
      return
    }
    if (!passwordValue) {
      setError('Por favor ingresa tu contraseña')
      passwordRef.current?.focus()
      return
    }

    setLoading(true)

    try {
      const tokens = await authApi.login(emailValue, passwordValue)
      const user = await authApi.me(tokens.access_token)
      setAuth(user as any, tokens.access_token, tokens.refresh_token)
      router.push('/dashboard')
    } catch (err: any) {
      // Handle different error types
      if (err?.message && typeof err.message === 'string') {
        setError(err.message)
      } else if (typeof err === 'string') {
        setError(err)
      } else if (err?.name === 'TypeError') {
        setError('No se pudo conectar con el servidor. Verifique la conexión.')
      } else {
        setError('Error al iniciar sesión. Intente de nuevo.')
      }
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Brand Hero */}
      <div className="hidden lg:flex lg:w-1/2 brand-gradient relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12">
          <Logo size="lg" variant="full" className="mb-8" />
          <h1 className="text-4xl font-bold text-white mb-4">
            Reclutamiento inteligente con IA
          </h1>
          <p className="text-xl text-bloque-slate200 mb-8">
            Encuentra el talento perfecto con nuestra plataforma de reclutamiento
            potenciada por inteligencia artificial.
          </p>
          <div className="flex gap-4">
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
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-bloque-gray50">
        <Card className="w-full max-w-md">
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
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  placeholder="tu@email.com"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                ¿No tienes cuenta?{' '}
                <Link href="/register" className="text-bloque-navy900 hover:underline font-medium">
                  Regístrate
                </Link>
              </div>
            </form>

            {/* Demo credentials */}
            <div className="mt-6 p-4 bg-bloque-gray50 rounded-lg">
              <p className="text-sm font-medium text-bloque-navy900 mb-2">
                Cuentas de prueba:
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Admin:</strong> admin@example.com / Admin123!</p>
                <p><strong>Recruiter:</strong> recruiter@example.com / Recruiter123!</p>
                <p><strong>Employer:</strong> employer@example.com / Employer123!</p>
                <p><strong>Candidate:</strong> candidate1@example.com / Candidate123!</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
