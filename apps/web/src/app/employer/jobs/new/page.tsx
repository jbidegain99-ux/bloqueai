'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/lib/auth'
import { employerApi } from '@/lib/api'

export default function NewJobPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: '',
    seniority: 'MID',
    salary_min: '',
    salary_max: '',
    salary_currency: 'USD',
    modality: 'REMOTE',
    location: '',
    country: '',
    must_haves: '',
    nice_to_haves: '',
    responsibilities: '',
    benefits: '',
    custom_questions: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessToken) return

    setLoading(true)
    setError('')

    try {
      const jobData = {
        title: formData.title,
        description: formData.description,
        department: formData.department || undefined,
        seniority: formData.seniority,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : undefined,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : undefined,
        salary_currency: formData.salary_currency,
        modality: formData.modality,
        location: formData.location || undefined,
        country: formData.country || undefined,
        must_haves: formData.must_haves.split('\n').filter(Boolean),
        nice_to_haves: formData.nice_to_haves.split('\n').filter(Boolean),
        responsibilities: formData.responsibilities.split('\n').filter(Boolean),
        benefits: formData.benefits.split('\n').filter(Boolean),
        custom_questions: formData.custom_questions.split('\n').filter(Boolean),
      }

      const job = await employerApi.createJob(accessToken, jobData)
      router.push(`/employer/jobs/${(job as any).id}`)
    } catch (err: any) {
      setError(err.message || 'Error al crear la vacante')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-bloque-navy900 mb-6">
          Nueva vacante
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <BrandCard>
            <BrandCardHeader
              title="Información básica"
              description="Define el título y descripción de la posición"
            />

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Título de la posición *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej: Senior Full Stack Developer"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Descripción *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe la posición, el equipo, y lo que buscas..."
                  rows={6}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Departamento</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Ej: Ingeniería"
                  />
                </div>

                <div>
                  <Label htmlFor="seniority">Nivel de seniority *</Label>
                  <Select
                    value={formData.seniority}
                    onValueChange={(value) => setFormData({ ...formData, seniority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INTERN">Pasante</SelectItem>
                      <SelectItem value="JUNIOR">Junior</SelectItem>
                      <SelectItem value="MID">Mid-level</SelectItem>
                      <SelectItem value="SENIOR">Senior</SelectItem>
                      <SelectItem value="LEAD">Lead</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </BrandCard>

          <BrandCard>
            <BrandCardHeader
              title="Compensación y ubicación"
              description="Define el rango salarial y modalidad de trabajo"
            />

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="salary_min">Salario mínimo</Label>
                  <Input
                    id="salary_min"
                    type="number"
                    value={formData.salary_min}
                    onChange={(e) => setFormData({ ...formData, salary_min: e.target.value })}
                    placeholder="50000"
                  />
                </div>
                <div>
                  <Label htmlFor="salary_max">Salario máximo</Label>
                  <Input
                    id="salary_max"
                    type="number"
                    value={formData.salary_max}
                    onChange={(e) => setFormData({ ...formData, salary_max: e.target.value })}
                    placeholder="80000"
                  />
                </div>
                <div>
                  <Label htmlFor="salary_currency">Moneda</Label>
                  <Select
                    value={formData.salary_currency}
                    onValueChange={(value) => setFormData({ ...formData, salary_currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="MXN">MXN</SelectItem>
                      <SelectItem value="COP">COP</SelectItem>
                      <SelectItem value="ARS">ARS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="modality">Modalidad *</Label>
                  <Select
                    value={formData.modality}
                    onValueChange={(value) => setFormData({ ...formData, modality: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REMOTE">Remoto</SelectItem>
                      <SelectItem value="HYBRID">Híbrido</SelectItem>
                      <SelectItem value="ONSITE">Presencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">Ubicación</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Ej: Ciudad de México"
                  />
                </div>
                <div>
                  <Label htmlFor="country">País</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="Ej: México"
                  />
                </div>
              </div>
            </div>
          </BrandCard>

          <BrandCard>
            <BrandCardHeader
              title="Requisitos"
              description="Define qué necesitas del candidato ideal (uno por línea)"
            />

            <div className="space-y-4">
              <div>
                <Label htmlFor="must_haves">Requisitos obligatorios</Label>
                <Textarea
                  id="must_haves"
                  value={formData.must_haves}
                  onChange={(e) => setFormData({ ...formData, must_haves: e.target.value })}
                  placeholder="React&#10;Node.js&#10;5+ años de experiencia"
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="nice_to_haves">Requisitos deseables</Label>
                <Textarea
                  id="nice_to_haves"
                  value={formData.nice_to_haves}
                  onChange={(e) => setFormData({ ...formData, nice_to_haves: e.target.value })}
                  placeholder="Docker&#10;Kubernetes&#10;AWS"
                  rows={3}
                />
              </div>
            </div>
          </BrandCard>

          <BrandCard>
            <BrandCardHeader
              title="Preguntas personalizadas"
              description="Agrega preguntas específicas para esta posición (una por línea)"
            />

            <Textarea
              value={formData.custom_questions}
              onChange={(e) => setFormData({ ...formData, custom_questions: e.target.value })}
              placeholder="¿Por qué te interesa esta posición?&#10;Describe un proyecto desafiante que hayas liderado"
              rows={3}
            />
          </BrandCard>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/employer/jobs')}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear vacante'}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
