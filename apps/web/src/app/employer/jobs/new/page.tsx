'use client'

import { useState, useMemo } from 'react'
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
import { Sparkles, Wand2, MessageSquare, Loader2, CheckCircle2, Video, MessageCircle } from 'lucide-react'

// Category-aware placeholder templates for requirements
const MUST_HAVES_PLACEHOLDERS: Record<string, string> = {
  TECHNOLOGY: 'React\nNode.js\n5+ anos de experiencia',
  HEALTHCARE: 'Titulo en medicina\nCedula profesional\n3+ anos en consulta',
  DENTAL: 'Titulo en odontologia\nCedula profesional\nExperiencia clinica',
  FINANCE: 'CPA/Contador\nExcel avanzado\nConocimiento de SAP',
  LEGAL: 'Cedula profesional\nLitigacion\nDerecho corporativo',
  SALES: 'Experiencia comercial\nManejo de CRM\nCierre de ventas',
  MANUFACTURING: 'Control de calidad\nSix Sigma\nManejo de inventarios',
  HUMAN_RESOURCES: 'Gestion de talento\nConocimiento de nominas\nEntrevistas por competencias',
  OTHER: 'Experiencia requerida\nHabilidades clave\nCertificaciones',
}

const NICE_TO_HAVES_PLACEHOLDERS: Record<string, string> = {
  TECHNOLOGY: 'Docker\nKubernetes\nAWS',
  HEALTHCARE: 'Especialidad medica\nIngles medico\nInvestigacion clinica',
  DENTAL: 'Especialidad en ortodoncia\nManejo de software dental\nIngles',
  FINANCE: 'MBA\nCertificacion CFA\nPower BI',
  LEGAL: 'Maestria en derecho\nIngles juridico\nMediacion',
  SALES: 'Ingles de negocios\nExperiencia en sector\nNegociacion avanzada',
  MANUFACTURING: 'Lean Manufacturing\nIngles tecnico\nERP',
  HUMAN_RESOURCES: 'Maestria en RRHH\nCertificacion SHRM\nIngles',
  OTHER: 'Certificaciones adicionales\nIdiomas\nHabilidades complementarias',
}

export default function NewJobPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copilotLoading, setCopilotLoading] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: '',
    category: 'TECHNOLOGY',
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
    interview_type: 'chat',
  })

  // Dynamic placeholders based on selected category
  const mustHavesPlaceholder = useMemo(() => {
    return MUST_HAVES_PLACEHOLDERS[formData.category] || MUST_HAVES_PLACEHOLDERS.OTHER
  }, [formData.category])

  const niceToHavesPlaceholder = useMemo(() => {
    return NICE_TO_HAVES_PLACEHOLDERS[formData.category] || NICE_TO_HAVES_PLACEHOLDERS.OTHER
  }, [formData.category])

  const showSuccess = (message: string) => {
    setSuccess(message)
    setTimeout(() => setSuccess(''), 4000)
  }

  const handleCopilotDescription = async () => {
    if (!accessToken || !formData.title) {
      setError('Primero ingresa un titulo para la vacante')
      return
    }
    setCopilotLoading('description')
    setError('')
    setSuccess('')
    try {
      const result = await employerApi.copilotSuggestDescription(accessToken, {
        title: formData.title,
        category: formData.category,
        seniority: formData.seniority,
        partial_description: formData.description || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else if (result.description) {
        setFormData({ ...formData, description: result.description })
        showSuccess('Descripcion generada exitosamente. Puedes editarla si lo deseas.')
      }
    } catch (err: any) {
      setError(err.message || 'Error al generar descripcion')
    } finally {
      setCopilotLoading(null)
    }
  }

  const handleCopilotRequirements = async () => {
    if (!accessToken || !formData.title) {
      setError('Primero ingresa un titulo para la vacante')
      return
    }
    setCopilotLoading('requirements')
    setError('')
    setSuccess('')
    try {
      const result = await employerApi.copilotSuggestRequirements(accessToken, {
        title: formData.title,
        category: formData.category,
        seniority: formData.seniority,
        description: formData.description || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setFormData({
          ...formData,
          must_haves: result.must_haves?.join('\n') || formData.must_haves,
          nice_to_haves: result.nice_to_haves?.join('\n') || formData.nice_to_haves,
        })
        showSuccess('Requisitos generados exitosamente. Puedes editarlos si lo deseas.')
      }
    } catch (err: any) {
      setError(err.message || 'Error al generar requisitos')
    } finally {
      setCopilotLoading(null)
    }
  }

  const handleCopilotQuestions = async () => {
    if (!accessToken || !formData.title) {
      setError('Primero ingresa un titulo para la vacante')
      return
    }
    setCopilotLoading('questions')
    setError('')
    setSuccess('')
    try {
      const result = await employerApi.copilotSuggestQuestions(accessToken, {
        title: formData.title,
        category: formData.category,
        seniority: formData.seniority,
        must_haves: formData.must_haves.split('\n').filter(Boolean),
        description: formData.description || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else if (result.questions) {
        const questions = result.questions.map(q => q.question).join('\n')
        setFormData({ ...formData, custom_questions: questions })
        showSuccess('Preguntas generadas exitosamente. Puedes editarlas si lo deseas.')
      }
    } catch (err: any) {
      setError(err.message || 'Error al generar preguntas')
    } finally {
      setCopilotLoading(null)
    }
  }

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
        category: formData.category,
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
        interview_type: formData.interview_type,
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

          {success && (
            <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              {success}
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
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="description">Descripcion *</Label>
                  <button
                    type="button"
                    onClick={handleCopilotDescription}
                    disabled={copilotLoading === 'description' || !formData.title}
                    className="flex items-center gap-1.5 px-3 py-1 text-sm bg-gradient-to-r from-bloque-gold400 to-bloque-gold500 text-bloque-navy900 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!formData.title ? 'Primero ingresa un titulo' : 'Generar descripcion con IA'}
                  >
                    {copilotLoading === 'description' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Sugerir con IA
                  </button>
                </div>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe la posicion, el equipo, y lo que buscas..."
                  rows={6}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="department">Departamento</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Ej: Ingenieria"
                  />
                </div>

                <div>
                  <Label htmlFor="category">Categoria *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TECHNOLOGY">Tecnologia</SelectItem>
                      <SelectItem value="HEALTHCARE">Salud</SelectItem>
                      <SelectItem value="DENTAL">Dental</SelectItem>
                      <SelectItem value="FINANCE">Finanzas</SelectItem>
                      <SelectItem value="LEGAL">Legal</SelectItem>
                      <SelectItem value="MANUFACTURING">Manufactura</SelectItem>
                      <SelectItem value="SALES">Ventas</SelectItem>
                      <SelectItem value="HUMAN_RESOURCES">Recursos Humanos</SelectItem>
                      <SelectItem value="OTHER">Otro</SelectItem>
                    </SelectContent>
                  </Select>
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
                      <SelectItem value="USD">USD</SelectItem>
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
            <div className="flex items-start justify-between">
              <BrandCardHeader
                title="Requisitos"
                description="Define que necesitas del candidato ideal (uno por linea)"
              />
              <button
                type="button"
                onClick={handleCopilotRequirements}
                disabled={copilotLoading === 'requirements' || !formData.title}
                className="flex items-center gap-1.5 px-3 py-1 text-sm bg-gradient-to-r from-bloque-gold400 to-bloque-gold500 text-bloque-navy900 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                title={!formData.title ? 'Primero ingresa un titulo' : 'Generar requisitos con IA'}
              >
                {copilotLoading === 'requirements' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                Sugerir con IA
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="must_haves">Requisitos obligatorios</Label>
                <Textarea
                  id="must_haves"
                  value={formData.must_haves}
                  onChange={(e) => setFormData({ ...formData, must_haves: e.target.value })}
                  placeholder={mustHavesPlaceholder}
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="nice_to_haves">Requisitos deseables</Label>
                <Textarea
                  id="nice_to_haves"
                  value={formData.nice_to_haves}
                  onChange={(e) => setFormData({ ...formData, nice_to_haves: e.target.value })}
                  placeholder={niceToHavesPlaceholder}
                  rows={3}
                />
              </div>
            </div>
          </BrandCard>

          <BrandCard>
            <div className="flex items-start justify-between">
              <BrandCardHeader
                title="Preguntas personalizadas"
                description="Agrega preguntas especificas para esta posicion (una por linea)"
              />
              <button
                type="button"
                onClick={handleCopilotQuestions}
                disabled={copilotLoading === 'questions' || !formData.title}
                className="flex items-center gap-1.5 px-3 py-1 text-sm bg-gradient-to-r from-bloque-gold400 to-bloque-gold500 text-bloque-navy900 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                title={!formData.title ? 'Primero ingresa un titulo' : 'Generar preguntas con IA'}
              >
                {copilotLoading === 'questions' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5" />
                )}
                Sugerir con IA
              </button>
            </div>

            <Textarea
              value={formData.custom_questions}
              onChange={(e) => setFormData({ ...formData, custom_questions: e.target.value })}
              placeholder="Por que te interesa esta posicion?&#10;Describe un proyecto desafiante que hayas liderado"
              rows={3}
            />
          </BrandCard>

          <BrandCard>
            <BrandCardHeader
              title="Tipo de entrevista"
              description="Selecciona como sera la entrevista con el candidato"
            />

            <div className="space-y-4">
              <Select
                value={formData.interview_type}
                onValueChange={(value) => setFormData({ ...formData, interview_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat">Chat con IA (texto)</SelectItem>
                  <SelectItem value="video">Video entrevista con IA (beta)</SelectItem>
                </SelectContent>
              </Select>

              {formData.interview_type === 'chat' ? (
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                  <MessageCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Entrevista por chat</p>
                    <p className="text-blue-700 mt-1">
                      El candidato respondera preguntas de un agente de IA por texto. Ideal para evaluaciones tecnicas y filtros iniciales.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg text-sm text-purple-800">
                  <Video className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Video entrevista (beta)</p>
                    <p className="text-purple-700 mt-1">
                      El candidato tendra una entrevista por video con un agente de IA. Permite evaluar comunicacion verbal y presencia.
                    </p>
                  </div>
                </div>
              )}
            </div>
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
