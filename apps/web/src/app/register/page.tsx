'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import type { User } from '@/lib/auth'
import { validators, validate } from '@/lib/validations'
import { getErrorMessage } from '@/types'

interface FieldErrors {
  full_name?: string
  email?: string
  password?: string
  confirmPassword?: string
  company_name?: string
}

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: 'CANDIDATE',
    company_name: '',
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Field-level validation
    const errs: FieldErrors = {}
    errs.full_name = validators.required(formData.full_name) ?? undefined
    errs.email = validate(formData.email, validators.required, validators.email) ?? undefined
    errs.password = validators.password(formData.password) ?? undefined
    if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = 'Las contrasenas no coinciden'
    }
    if (formData.role === 'EMPLOYER' && !formData.company_name.trim()) {
      errs.company_name = 'Ingresa el nombre de tu empresa'
    }

    // Remove undefined entries
    const cleanedErrors: FieldErrors = {}
    for (const [k, v] of Object.entries(errs)) {
      if (v) cleanedErrors[k as keyof FieldErrors] = v
    }

    if (Object.keys(cleanedErrors).length > 0) {
      setFieldErrors(cleanedErrors)
      return
    }
    setFieldErrors({})

    setLoading(true)

    try {
      await authApi.register({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        role: formData.role,
        company_name: formData.role === 'EMPLOYER' ? formData.company_name : undefined,
      })

      // Auto-login after registration
      const tokens = await authApi.login(formData.email, formData.password)
      const user = await authApi.me(tokens.access_token)
      setAuth(user as User, tokens.access_token, tokens.refresh_token)
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-bloque-gray50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-bloque-navy900 p-3 rounded-lg">
              <Logo size="md" variant="full" />
            </div>
          </div>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription>
            Regístrate para acceder a TalentOS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input
                id="full_name"
                type="text"
                placeholder="Tu nombre"
                value={formData.full_name}
                onChange={(e) => {
                  setFormData({ ...formData, full_name: e.target.value })
                  if (fieldErrors.full_name) setFieldErrors({ ...fieldErrors, full_name: undefined })
                }}
                error={!!fieldErrors.full_name}
                required
              />
              {fieldErrors.full_name && (
                <p className="text-sm text-red-500">{fieldErrors.full_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value })
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined })
                }}
                error={!!fieldErrors.email}
                required
              />
              {fieldErrors.email && (
                <p className="text-sm text-red-500">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Tipo de cuenta</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CANDIDATE">Candidato - Busco empleo</SelectItem>
                  <SelectItem value="EMPLOYER">Empresa - Busco talento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === 'EMPLOYER' && (
              <div className="space-y-2">
                <Label htmlFor="company_name">Nombre de la empresa</Label>
                <Input
                  id="company_name"
                  type="text"
                  placeholder="Tu empresa"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value })
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined })
                }}
                error={!!fieldErrors.password}
                required
                minLength={8}
              />
              {fieldErrors.password ? (
                <p className="text-sm text-red-500">{fieldErrors.password}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Debe contener mayúsculas, minúsculas y números
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repite tu contraseña"
                value={formData.confirmPassword}
                onChange={(e) => {
                  setFormData({ ...formData, confirmPassword: e.target.value })
                  if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: undefined })
                }}
                error={!!fieldErrors.confirmPassword}
                required
              />
              {fieldErrors.confirmPassword && (
                <p className="text-sm text-red-500">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Registrando...' : 'Crear cuenta'}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-bloque-navy900 hover:underline font-medium">
                Inicia sesión
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
