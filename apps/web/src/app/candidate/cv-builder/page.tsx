'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { candidateApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import {
  ArrowLeft,
  ArrowRight,
  User,
  Briefcase,
  GraduationCap,
  Code,
  Globe,
  Sparkles,
  Plus,
  X,
  Trash2,
  CheckCircle2,
  Loader2,
  Download,
  FileText,
  Save,
} from 'lucide-react'

// Types
interface PersonalInfo {
  name: string
  email: string
  phone: string
  location: string
  headline: string
}

interface WorkEntry {
  id: string
  company: string
  title: string
  start_date: string
  end_date: string
  description: string
  achievements: string[]
}

interface EducationEntry {
  id: string
  institution: string
  degree: string
  field: string
  year: string
}

interface Skills {
  technical: string[]
  soft: string[]
}

interface LanguageEntry {
  id: string
  language: string
  level: string
}

interface CVData {
  personal_info: PersonalInfo
  work_history: WorkEntry[]
  education: EducationEntry[]
  skills: Skills
  languages: LanguageEntry[]
}

interface GeneratedCV {
  success: boolean
  message: string
  resume_id: string
  file_url: string | null
  summary: string
  html_preview: string
}

type WizardStep = 'personal' | 'work' | 'education' | 'skills' | 'languages' | 'preview'

const STEPS: { id: WizardStep; label: string; icon: React.ElementType }[] = [
  { id: 'personal', label: 'Datos Personales', icon: User },
  { id: 'work', label: 'Experiencia', icon: Briefcase },
  { id: 'education', label: 'Educacion', icon: GraduationCap },
  { id: 'skills', label: 'Habilidades', icon: Code },
  { id: 'languages', label: 'Idiomas', icon: Globe },
  { id: 'preview', label: 'Vista Previa', icon: Sparkles },
]

const LANGUAGE_LEVELS = [
  { value: 'Nativo', label: 'Nativo' },
  { value: 'Avanzado', label: 'Avanzado (C1-C2)' },
  { value: 'Intermedio', label: 'Intermedio (B1-B2)' },
  { value: 'Basico', label: 'Basico (A1-A2)' },
]

const STORAGE_KEY = 'cv_builder_draft'

const generateId = () => Math.random().toString(36).substr(2, 9)

export default function CVBuilderPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated, accessToken, user } = useAuthStore()

  const [step, setStep] = useState<WizardStep>('personal')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedCV, setGeneratedCV] = useState<GeneratedCV | null>(null)

  // Form state
  const [cvData, setCvData] = useState<CVData>({
    personal_info: {
      name: '',
      email: '',
      phone: '',
      location: '',
      headline: '',
    },
    work_history: [],
    education: [],
    skills: { technical: [], soft: [] },
    languages: [],
  })

  // Skill input state
  const [technicalSkillInput, setTechnicalSkillInput] = useState('')
  const [softSkillInput, setSoftSkillInput] = useState('')

  // Redirect if not authenticated
  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login?redirect=/candidate/cv-builder')
    }
  }, [isAuthenticated, isHydrated, router])

  // Load draft from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setCvData(parsed)
      } catch {
        // Ignore invalid data
      }
    }
  }, [])

  // Pre-fill user data
  useEffect(() => {
    if (user && !cvData.personal_info.name && !cvData.personal_info.email) {
      setCvData((prev) => ({
        ...prev,
        personal_info: {
          ...prev.personal_info,
          name: user.full_name || '',
          email: user.email || '',
        },
      }))
    }
  }, [user, cvData.personal_info.name, cvData.personal_info.email])

  // Save draft to localStorage
  const saveDraft = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cvData))
  }, [cvData])

  // Auto-save draft on change
  useEffect(() => {
    const timer = setTimeout(saveDraft, 1000)
    return () => clearTimeout(timer)
  }, [cvData, saveDraft])

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY)
  }

  const getCurrentStepIndex = () => STEPS.findIndex((s) => s.id === step)
  const getProgress = () => ((getCurrentStepIndex() + 1) / STEPS.length) * 100

  const canGoNext = () => {
    switch (step) {
      case 'personal':
        return cvData.personal_info.name.trim() !== '' && cvData.personal_info.email.trim() !== ''
      case 'work':
        return true // Optional
      case 'education':
        return true // Optional
      case 'skills':
        return true // Optional
      case 'languages':
        return true // Optional
      case 'preview':
        return true
      default:
        return false
    }
  }

  const goNext = () => {
    const currentIndex = getCurrentStepIndex()
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1].id)
    }
  }

  const goBack = () => {
    const currentIndex = getCurrentStepIndex()
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1].id)
    }
  }

  // Personal Info handlers
  const updatePersonalInfo = (field: keyof PersonalInfo, value: string) => {
    setCvData((prev) => ({
      ...prev,
      personal_info: { ...prev.personal_info, [field]: value },
    }))
  }

  // Work History handlers
  const addWorkEntry = () => {
    setCvData((prev) => ({
      ...prev,
      work_history: [
        ...prev.work_history,
        {
          id: generateId(),
          company: '',
          title: '',
          start_date: '',
          end_date: '',
          description: '',
          achievements: [],
        },
      ],
    }))
  }

  const updateWorkEntry = (id: string, field: keyof WorkEntry, value: string | string[]) => {
    setCvData((prev) => ({
      ...prev,
      work_history: prev.work_history.map((w) => (w.id === id ? { ...w, [field]: value } : w)),
    }))
  }

  const removeWorkEntry = (id: string) => {
    setCvData((prev) => ({
      ...prev,
      work_history: prev.work_history.filter((w) => w.id !== id),
    }))
  }

  const addAchievement = (workId: string) => {
    setCvData((prev) => ({
      ...prev,
      work_history: prev.work_history.map((w) =>
        w.id === workId ? { ...w, achievements: [...w.achievements, ''] } : w
      ),
    }))
  }

  const updateAchievement = (workId: string, index: number, value: string) => {
    setCvData((prev) => ({
      ...prev,
      work_history: prev.work_history.map((w) =>
        w.id === workId
          ? {
              ...w,
              achievements: w.achievements.map((a, i) => (i === index ? value : a)),
            }
          : w
      ),
    }))
  }

  const removeAchievement = (workId: string, index: number) => {
    setCvData((prev) => ({
      ...prev,
      work_history: prev.work_history.map((w) =>
        w.id === workId
          ? { ...w, achievements: w.achievements.filter((_, i) => i !== index) }
          : w
      ),
    }))
  }

  // Education handlers
  const addEducationEntry = () => {
    setCvData((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          id: generateId(),
          institution: '',
          degree: '',
          field: '',
          year: '',
        },
      ],
    }))
  }

  const updateEducationEntry = (id: string, field: keyof EducationEntry, value: string) => {
    setCvData((prev) => ({
      ...prev,
      education: prev.education.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }))
  }

  const removeEducationEntry = (id: string) => {
    setCvData((prev) => ({
      ...prev,
      education: prev.education.filter((e) => e.id !== id),
    }))
  }

  // Skills handlers
  const addSkill = (type: 'technical' | 'soft', value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (cvData.skills[type].includes(trimmed)) return

    setCvData((prev) => ({
      ...prev,
      skills: {
        ...prev.skills,
        [type]: [...prev.skills[type], trimmed],
      },
    }))
  }

  const removeSkill = (type: 'technical' | 'soft', skill: string) => {
    setCvData((prev) => ({
      ...prev,
      skills: {
        ...prev.skills,
        [type]: prev.skills[type].filter((s) => s !== skill),
      },
    }))
  }

  const handleTechnicalSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSkill('technical', technicalSkillInput)
      setTechnicalSkillInput('')
    }
  }

  const handleSoftSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSkill('soft', softSkillInput)
      setSoftSkillInput('')
    }
  }

  // Language handlers
  const addLanguageEntry = () => {
    setCvData((prev) => ({
      ...prev,
      languages: [
        ...prev.languages,
        {
          id: generateId(),
          language: '',
          level: 'Intermedio',
        },
      ],
    }))
  }

  const updateLanguageEntry = (id: string, field: keyof LanguageEntry, value: string) => {
    setCvData((prev) => ({
      ...prev,
      languages: prev.languages.map((l) => (l.id === id ? { ...l, [field]: value } : l)),
    }))
  }

  const removeLanguageEntry = (id: string) => {
    setCvData((prev) => ({
      ...prev,
      languages: prev.languages.filter((l) => l.id !== id),
    }))
  }

  // Generate CV
  const generateCV = async () => {
    if (!accessToken) return

    setGenerating(true)
    setError(null)

    try {
      // Prepare data for API (remove internal IDs)
      const payload = {
        personal_info: cvData.personal_info,
        work_history: cvData.work_history.map(({ id, ...rest }) => ({
          ...rest,
          achievements: rest.achievements.filter((a) => a.trim() !== ''),
        })),
        education: cvData.education.map(({ id, ...rest }) => rest),
        skills: cvData.skills,
        languages: cvData.languages.map(({ id, ...rest }) => rest),
      }

      const result = await candidateApi.generateCV(accessToken, payload)
      setGeneratedCV(result)
      clearDraft()
    } catch (err: any) {
      console.error('Error generating CV:', err)
      setError(err?.message || 'Error al generar el CV. Intenta de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  // Download CV
  const downloadCV = () => {
    if (!generatedCV?.html_preview) return

    const blob = new Blob([generatedCV.html_preview], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cv_${cvData.personal_info.name.replace(/\s+/g, '_')}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!isHydrated || !isAuthenticated) return null

  // Success state - CV generated
  if (generatedCV) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto">
          <BrandCard className="p-8">
            <div className="text-center mb-8">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-bloque-navy900 mb-2">
                CV Generado Exitosamente
              </h1>
              <p className="text-muted-foreground">{generatedCV.message}</p>
            </div>

            {/* AI Summary */}
            <div className="bg-bloque-gray50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-bloque-navy900 mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-bloque-gold500" />
                Resumen Profesional (Generado por IA)
              </h3>
              <p className="text-muted-foreground">{generatedCV.summary}</p>
            </div>

            {/* CV Preview */}
            <div className="border rounded-lg overflow-hidden mb-6">
              <div className="bg-gray-100 px-4 py-2 border-b flex items-center justify-between">
                <span className="text-sm font-medium">Vista Previa del CV</span>
                <Button variant="ghost" size="sm" onClick={downloadCV}>
                  <Download className="h-4 w-4 mr-1" />
                  Descargar HTML
                </Button>
              </div>
              <div className="p-4 bg-white max-h-[500px] overflow-y-auto">
                <iframe
                  srcDoc={generatedCV.html_preview}
                  className="w-full h-[450px] border-0"
                  title="CV Preview"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setGeneratedCV(null)
                  setStep('personal')
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Crear otro CV
              </Button>
              <Button className="flex-1" onClick={() => router.push('/candidate/jobs')}>
                <Briefcase className="h-4 w-4 mr-2" />
                Usar este CV para aplicar
              </Button>
            </div>
          </BrandCard>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <Button variant="ghost" onClick={() => router.push('/candidate/profile')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a mi perfil
        </Button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-bloque-navy900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-bloque-gold500" />
            Crear CV con IA
          </h1>
          <p className="text-muted-foreground mt-1">
            Completa los pasos para generar tu CV profesional
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <Progress value={getProgress()} className="h-2 mb-4" />
          <div className="flex justify-between">
            {STEPS.map((s, idx) => {
              const isActive = s.id === step
              const isPast = idx < getCurrentStepIndex()
              const Icon = s.icon

              return (
                <button
                  key={s.id}
                  onClick={() => {
                    // Allow going back to previous steps
                    if (idx <= getCurrentStepIndex()) {
                      setStep(s.id)
                    }
                  }}
                  className={`flex flex-col items-center gap-1 text-xs transition-colors ${
                    isActive
                      ? 'text-bloque-navy900 font-medium'
                      : isPast
                      ? 'text-green-600 cursor-pointer'
                      : 'text-muted-foreground'
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      isActive
                        ? 'bg-bloque-navy900 text-white'
                        : isPast
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="hidden sm:block">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Auto-save indicator */}
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground mb-4">
          <Save className="h-3 w-3" />
          <span>Guardado automatico activo</span>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
        )}

        {/* Step Content */}
        <BrandCard className="p-6 mb-6">
          {/* Step 1: Personal Info */}
          {step === 'personal' && (
            <div className="space-y-4">
              <BrandCardHeader
                title="Datos Personales"
                description="Informacion basica para tu CV"
              />

              <div className="grid gap-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre completo *</Label>
                    <Input
                      id="name"
                      value={cvData.personal_info.name}
                      onChange={(e) => updatePersonalInfo('name', e.target.value)}
                      placeholder="Juan Perez Garcia"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={cvData.personal_info.email}
                      onChange={(e) => updatePersonalInfo('email', e.target.value)}
                      placeholder="juan@email.com"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefono</Label>
                    <Input
                      id="phone"
                      value={cvData.personal_info.phone}
                      onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                      placeholder="+52 55 1234 5678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Ubicacion</Label>
                    <Input
                      id="location"
                      value={cvData.personal_info.location}
                      onChange={(e) => updatePersonalInfo('location', e.target.value)}
                      placeholder="Ciudad de Mexico, Mexico"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headline">Titulo profesional</Label>
                  <Input
                    id="headline"
                    value={cvData.personal_info.headline}
                    onChange={(e) => updatePersonalInfo('headline', e.target.value)}
                    placeholder="Desarrollador Full Stack | 5 anos de experiencia"
                  />
                  <p className="text-xs text-muted-foreground">
                    Un titulo breve que describa tu perfil profesional
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Work History */}
          {step === 'work' && (
            <div className="space-y-4">
              <BrandCardHeader
                title="Experiencia Laboral"
                description="Agrega tus experiencias profesionales (opcional)"
              />

              {cvData.work_history.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-3">
                    No has agregado experiencia laboral
                  </p>
                  <Button onClick={addWorkEntry}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar experiencia
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {cvData.work_history.map((work, idx) => (
                    <div key={work.id} className="border rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                        onClick={() => removeWorkEntry(work.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      <h4 className="font-medium mb-4">Experiencia {idx + 1}</h4>

                      <div className="grid gap-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Empresa *</Label>
                            <Input
                              value={work.company}
                              onChange={(e) => updateWorkEntry(work.id, 'company', e.target.value)}
                              placeholder="Nombre de la empresa"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Puesto *</Label>
                            <Input
                              value={work.title}
                              onChange={(e) => updateWorkEntry(work.id, 'title', e.target.value)}
                              placeholder="Desarrollador Senior"
                            />
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Fecha inicio</Label>
                            <Input
                              value={work.start_date}
                              onChange={(e) =>
                                updateWorkEntry(work.id, 'start_date', e.target.value)
                              }
                              placeholder="Ene 2020"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Fecha fin</Label>
                            <Input
                              value={work.end_date}
                              onChange={(e) => updateWorkEntry(work.id, 'end_date', e.target.value)}
                              placeholder="Presente"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Descripcion</Label>
                          <Textarea
                            value={work.description}
                            onChange={(e) =>
                              updateWorkEntry(work.id, 'description', e.target.value)
                            }
                            placeholder="Describe tus responsabilidades principales..."
                            rows={3}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Logros (opcional)</Label>
                          {work.achievements.map((achievement, aIdx) => (
                            <div key={aIdx} className="flex gap-2">
                              <Input
                                value={achievement}
                                onChange={(e) =>
                                  updateAchievement(work.id, aIdx, e.target.value)
                                }
                                placeholder="Ej: Aumente las ventas en 30%"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAchievement(work.id, aIdx)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addAchievement(work.id)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Agregar logro
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button variant="outline" onClick={addWorkEntry}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar otra experiencia
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Education */}
          {step === 'education' && (
            <div className="space-y-4">
              <BrandCardHeader
                title="Educacion"
                description="Agrega tu formacion academica (opcional)"
              />

              {cvData.education.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-3">No has agregado educacion</p>
                  <Button onClick={addEducationEntry}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar educacion
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {cvData.education.map((edu, idx) => (
                    <div key={edu.id} className="border rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                        onClick={() => removeEducationEntry(edu.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      <h4 className="font-medium mb-4">Educacion {idx + 1}</h4>

                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>Institucion *</Label>
                          <Input
                            value={edu.institution}
                            onChange={(e) =>
                              updateEducationEntry(edu.id, 'institution', e.target.value)
                            }
                            placeholder="Universidad Nacional"
                          />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Titulo/Grado *</Label>
                            <Input
                              value={edu.degree}
                              onChange={(e) =>
                                updateEducationEntry(edu.id, 'degree', e.target.value)
                              }
                              placeholder="Licenciatura"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Campo de estudio</Label>
                            <Input
                              value={edu.field}
                              onChange={(e) =>
                                updateEducationEntry(edu.id, 'field', e.target.value)
                              }
                              placeholder="Ingenieria en Sistemas"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Ano de graduacion</Label>
                          <Input
                            value={edu.year}
                            onChange={(e) => updateEducationEntry(edu.id, 'year', e.target.value)}
                            placeholder="2020"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button variant="outline" onClick={addEducationEntry}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar otra educacion
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Skills */}
          {step === 'skills' && (
            <div className="space-y-6">
              <BrandCardHeader
                title="Habilidades"
                description="Agrega tus habilidades tecnicas y blandas"
              />

              {/* Technical Skills */}
              <div className="space-y-3">
                <Label>Habilidades Tecnicas</Label>
                <div className="flex gap-2">
                  <Input
                    value={technicalSkillInput}
                    onChange={(e) => setTechnicalSkillInput(e.target.value)}
                    onKeyDown={handleTechnicalSkillKeyDown}
                    placeholder="Ej: Python, React, SQL..."
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      addSkill('technical', technicalSkillInput)
                      setTechnicalSkillInput('')
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cvData.skills.technical.map((skill) => (
                    <Badge
                      key={skill}
                      variant="outline"
                      className="cursor-pointer hover:bg-red-50"
                      onClick={() => removeSkill('technical', skill)}
                    >
                      {skill}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Presiona Enter o el boton + para agregar. Click en una habilidad para eliminarla.
                </p>
              </div>

              {/* Soft Skills */}
              <div className="space-y-3">
                <Label>Habilidades Blandas</Label>
                <div className="flex gap-2">
                  <Input
                    value={softSkillInput}
                    onChange={(e) => setSoftSkillInput(e.target.value)}
                    onKeyDown={handleSoftSkillKeyDown}
                    placeholder="Ej: Liderazgo, Comunicacion..."
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      addSkill('soft', softSkillInput)
                      setSoftSkillInput('')
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cvData.skills.soft.map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="cursor-pointer hover:bg-red-50"
                      onClick={() => removeSkill('soft', skill)}
                    >
                      {skill}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Languages */}
          {step === 'languages' && (
            <div className="space-y-4">
              <BrandCardHeader
                title="Idiomas"
                description="Agrega los idiomas que dominas"
              />

              {cvData.languages.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-3">No has agregado idiomas</p>
                  <Button onClick={addLanguageEntry}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar idioma
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cvData.languages.map((lang, idx) => (
                    <div key={lang.id} className="flex items-end gap-3">
                      <div className="flex-1 space-y-2">
                        <Label>Idioma</Label>
                        <Input
                          value={lang.language}
                          onChange={(e) =>
                            updateLanguageEntry(lang.id, 'language', e.target.value)
                          }
                          placeholder="Espanol"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Label>Nivel</Label>
                        <Select
                          value={lang.level}
                          onValueChange={(value) => updateLanguageEntry(lang.id, 'level', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona nivel" />
                          </SelectTrigger>
                          <SelectContent>
                            {LANGUAGE_LEVELS.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => removeLanguageEntry(lang.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <Button variant="outline" onClick={addLanguageEntry}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar otro idioma
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Preview & Generate */}
          {step === 'preview' && (
            <div className="space-y-6">
              <BrandCardHeader
                title="Vista Previa y Generacion"
                description="Revisa tu informacion antes de generar el CV"
              />

              {/* Summary of entered data */}
              <div className="space-y-4">
                {/* Personal Info Summary */}
                <div className="bg-bloque-gray50 rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Datos Personales
                  </h4>
                  <p className="text-sm">
                    <strong>{cvData.personal_info.name}</strong>
                    {cvData.personal_info.headline && ` - ${cvData.personal_info.headline}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {cvData.personal_info.email}
                    {cvData.personal_info.phone && ` | ${cvData.personal_info.phone}`}
                    {cvData.personal_info.location && ` | ${cvData.personal_info.location}`}
                  </p>
                </div>

                {/* Work Summary */}
                {cvData.work_history.length > 0 && (
                  <div className="bg-bloque-gray50 rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Experiencia ({cvData.work_history.length})
                    </h4>
                    {cvData.work_history.map((w) => (
                      <p key={w.id} className="text-sm text-muted-foreground">
                        {w.title} en {w.company} ({w.start_date} - {w.end_date || 'Presente'})
                      </p>
                    ))}
                  </div>
                )}

                {/* Education Summary */}
                {cvData.education.length > 0 && (
                  <div className="bg-bloque-gray50 rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Educacion ({cvData.education.length})
                    </h4>
                    {cvData.education.map((e) => (
                      <p key={e.id} className="text-sm text-muted-foreground">
                        {e.degree} {e.field && `en ${e.field}`} - {e.institution}
                      </p>
                    ))}
                  </div>
                )}

                {/* Skills Summary */}
                {(cvData.skills.technical.length > 0 || cvData.skills.soft.length > 0) && (
                  <div className="bg-bloque-gray50 rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Habilidades
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {[...cvData.skills.technical, ...cvData.skills.soft].map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Languages Summary */}
                {cvData.languages.length > 0 && (
                  <div className="bg-bloque-gray50 rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Idiomas ({cvData.languages.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {cvData.languages.map((l) => (
                        <span key={l.id} className="text-sm text-muted-foreground">
                          {l.language} ({l.level})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Generation Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Generacion con IA</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Al generar tu CV, nuestra IA creara un resumen profesional personalizado
                      basado en tu experiencia y habilidades. El CV se guardara en tu perfil y
                      podras usarlo para aplicar a puestos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </BrandCard>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={goBack} disabled={step === 'personal'}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          {step === 'preview' ? (
            <Button onClick={generateCV} disabled={generating || !canGoNext()}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando CV...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generar CV con IA
                </>
              )}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canGoNext()}>
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  )
}
