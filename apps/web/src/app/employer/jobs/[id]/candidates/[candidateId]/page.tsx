'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScoreDisplay } from '@/components/brand/ScoreDisplay'
import { useAuthStore, isEmployer } from '@/lib/auth'
import { employerApi } from '@/lib/api'
import { getErrorMessage } from '@/types'
import {
  ArrowLeft,
  User,
  MapPin,
  Briefcase,
  GraduationCap,
  Languages,
  Star,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Clock,
  FileText,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  Edit,
  Send
} from 'lucide-react'

interface CandidateDetail {
  job: {
    id: string
    title: string
  }
  candidate: {
    id: string
    headline?: string
    location?: string
    skills?: string[]
    experience?: Array<{
      title: string
      company: string
      start_date?: string
      end_date?: string
      description?: string
    }>
    education?: Array<{
      degree: string
      institution: string
      year?: string
    }>
    languages?: Array<{
      language: string
      level: string
    }>
    summary?: string
    competency_scores?: Record<string, { score: number; notes?: string }>
    user?: {
      full_name: string
      email: string
    }
  }
  shortlist?: {
    rank?: number
    total_score?: number
    status?: string
    top_reasons?: string[]
    risks?: string[]
    recruiter_notes?: string
    score_breakdown?: Record<string, number | string | undefined>
  }
  interview?: {
    id: string
    status: string
    started_at?: string
    completed_at?: string
    duration_seconds?: number
    total_messages: number
  }
  report?: {
    id: string
    summary?: string
    overall_score?: number
    confidence_score?: number
    competency_scores?: Record<string, { score: number; notes?: string }>
    strengths?: string[]
    weaknesses?: string[]
    risks?: string[]
    recommendations?: string[]
    flags?: string[]
    score_overridden?: boolean
    original_score?: number
  }
  transcript?: Array<{
    role: 'assistant' | 'user'
    content: string
    timestamp?: string
  }>
}

export default function CandidateDetailPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string
  const candidateId = params.candidateId as string

  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [data, setData] = useState<CandidateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isEmployer()) {
      router.push('/dashboard')
      return
    }

    loadCandidateDetail()
  }, [isHydrated, isAuthenticated, accessToken, router, jobId, candidateId])

  const loadCandidateDetail = async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)

    try {
      const result = await employerApi.getCandidateDetail(accessToken, jobId, candidateId) as CandidateDetail
      setData(result)
      setNotes(result.shortlist?.recruiter_notes || '')
    } catch (err: unknown) {
      console.error('Error loading candidate:', err)
      setError(getErrorMessage(err) || 'Error al cargar el candidato')
    } finally {
      setLoading(false)
    }
  }

  const saveNotes = async () => {
    if (!accessToken || !data?.shortlist) return
    setSavingNotes(true)

    try {
      // Need shortlist item ID - for now we'll skip this functionality
      // Would need to pass the shortlist item ID from the backend
      setEditingNotes(false)
    } catch (err) {
      console.error('Error saving notes:', err)
    } finally {
      setSavingNotes(false)
    }
  }

  const getStatusBadge = (status?: string) => {
    if (!status) return null
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline">Pendiente</Badge>
      case 'CONTACTED':
        return <Badge variant="success">Contactado</Badge>
      case 'INTERVIEW_SCHEDULED':
        return <Badge variant="warning">Entrevista Programada</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Rechazado</Badge>
      case 'HIRED':
        return <Badge className="bg-green-600">Contratado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getInterviewStatusBadge = (status?: string) => {
    if (!status) return null
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">Completada</Badge>
      case 'IN_PROGRESS':
        return <Badge variant="warning">En Progreso</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    return `${mins} min`
  }

  if (!isHydrated || !isAuthenticated) return null

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Cargando candidato...</div>
        </div>
      </AppShell>
    )
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-600 mb-4">{error || 'Candidato no encontrado'}</p>
          <Button onClick={() => router.back()} variant="outline">
            Volver
          </Button>
        </div>
      </AppShell>
    )
  }

  const { candidate, shortlist, interview, report, transcript } = data

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-6">
        <Link href={`/employer/jobs/${jobId}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a {data.job.title}
          </Button>
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-bloque-gray50 rounded-full">
              <User className="h-8 w-8 text-bloque-navy900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-bloque-navy900">
                {candidate.user?.full_name || candidate.headline || 'Candidato'}
              </h1>
              {candidate.headline && candidate.user?.full_name && (
                <p className="text-muted-foreground">{candidate.headline}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {candidate.location && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {candidate.location}
                  </span>
                )}
                {candidate.user?.email && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {candidate.user.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            {shortlist && (
              <div className="flex items-center gap-3">
                {shortlist.rank && (
                  <div className="text-center">
                    <div className="w-10 h-10 bg-bloque-navy900 text-white rounded-full flex items-center justify-center text-lg font-bold">
                      {shortlist.rank}
                    </div>
                    <span className="text-xs text-muted-foreground">Rank</span>
                  </div>
                )}
                {report?.overall_score && (
                  <ScoreDisplay score={report.overall_score} size="lg" />
                )}
              </div>
            )}
            <div className="mt-2">
              {getStatusBadge(shortlist?.status)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Summary */}
          {report && (
            <BrandCard>
              <BrandCardHeader
                title="Evaluacion AI"
                description="Resumen generado por inteligencia artificial"
              />

              {report.summary && (
                <p className="text-bloque-navy900 mb-4">{report.summary}</p>
              )}

              {/* Competency Scores */}
              {report.competency_scores && Object.keys(report.competency_scores).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-bloque-navy900 mb-3">Competencias</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(report.competency_scores).map(([key, value]) => {
                      const score = typeof value === 'number' ? value : value?.score ?? 0
                      const labels: Record<string, string> = {
                        technical_skills: 'Tecnicas',
                        communication: 'Comunicacion',
                        problem_solving: 'Resolucion Problemas',
                        teamwork: 'Trabajo en Equipo',
                        leadership: 'Liderazgo',
                        adaptability: 'Adaptabilidad',
                        cultural_fit: 'Fit Cultural',
                      }
                      return (
                        <div key={key} className="flex items-center justify-between p-2 bg-bloque-gray50 rounded">
                          <span className="text-xs text-muted-foreground">{labels[key] || key}</span>
                          <span className={`text-sm font-semibold ${
                            score >= 4 ? 'text-green-600' :
                            score >= 3 ? 'text-amber-600' :
                            'text-red-600'
                          }`}>{score.toFixed(1)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                {report.strengths && report.strengths.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Fortalezas
                    </h4>
                    <ul className="space-y-1">
                      {report.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <Star className="h-3 w-3 text-green-600 flex-shrink-0 mt-1" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.weaknesses && report.weaknesses.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Areas de Mejora
                    </h4>
                    <ul className="space-y-1">
                      {report.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-amber-600">-</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Risks */}
              {report.risks && report.risks.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg">
                  <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Riesgos Identificados
                  </h4>
                  <ul className="space-y-1">
                    {report.risks.map((r, i) => (
                      <li key={i} className="text-sm text-red-600">{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {report.recommendations && report.recommendations.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-700 mb-2">Recomendaciones</h4>
                  <ul className="space-y-1">
                    {report.recommendations.map((r, i) => (
                      <li key={i} className="text-sm text-blue-600">{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Score Override Info */}
              {report.score_overridden && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg text-sm">
                  <span className="text-amber-700">
                    Puntaje modificado manualmente. Original: {report.original_score?.toFixed(1)}
                  </span>
                </div>
              )}
            </BrandCard>
          )}

          {/* Interview Transcript */}
          {transcript && transcript.length > 0 && (
            <BrandCard>
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full flex items-center justify-between"
              >
                <BrandCardHeader
                  title="Transcripcion de Entrevista"
                  description={`${transcript.length} mensajes • ${formatDuration(interview?.duration_seconds)}`}
                />
                {showTranscript ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </button>

              {showTranscript && (
                <div className="mt-4 space-y-4 max-h-[500px] overflow-y-auto">
                  {transcript.map((message, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg ${
                        message.role === 'assistant'
                          ? 'bg-bloque-gray50 mr-8'
                          : 'bg-bloque-navy900/5 ml-8'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-bloque-navy900">
                          {message.role === 'assistant' ? 'AI Entrevistador' : 'Candidato'}
                        </span>
                        {message.timestamp && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.timestamp).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </BrandCard>
          )}

          {/* Experience & Education */}
          <Tabs defaultValue="experience">
            <TabsList>
              <TabsTrigger value="experience">
                <Briefcase className="h-4 w-4 mr-2" />
                Experiencia
              </TabsTrigger>
              <TabsTrigger value="education">
                <GraduationCap className="h-4 w-4 mr-2" />
                Educacion
              </TabsTrigger>
              <TabsTrigger value="skills">
                <Star className="h-4 w-4 mr-2" />
                Skills
              </TabsTrigger>
            </TabsList>

            <TabsContent value="experience">
              <BrandCard>
                {candidate.experience && candidate.experience.length > 0 ? (
                  <div className="space-y-4">
                    {candidate.experience.map((exp, i) => (
                      <div key={i} className="border-l-2 border-bloque-navy900 pl-4">
                        <h4 className="font-medium text-bloque-navy900">{exp.title}</h4>
                        <p className="text-sm text-muted-foreground">{exp.company}</p>
                        {(exp.start_date || exp.end_date) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {exp.start_date} - {exp.end_date || 'Presente'}
                          </p>
                        )}
                        {exp.description && (
                          <p className="text-sm mt-2">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No hay experiencia registrada
                  </p>
                )}
              </BrandCard>
            </TabsContent>

            <TabsContent value="education">
              <BrandCard>
                {candidate.education && candidate.education.length > 0 ? (
                  <div className="space-y-4">
                    {candidate.education.map((edu, i) => (
                      <div key={i} className="border-l-2 border-bloque-gold500 pl-4">
                        <h4 className="font-medium text-bloque-navy900">{edu.degree}</h4>
                        <p className="text-sm text-muted-foreground">{edu.institution}</p>
                        {edu.year && (
                          <p className="text-xs text-muted-foreground mt-1">{edu.year}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No hay educacion registrada
                  </p>
                )}
              </BrandCard>
            </TabsContent>

            <TabsContent value="skills">
              <BrandCard>
                {candidate.skills && candidate.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill, i) => (
                      <Badge key={i} variant="outline" className="text-sm">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No hay skills registrados
                  </p>
                )}
              </BrandCard>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Interview Status */}
          {interview && (
            <BrandCard>
              <BrandCardHeader
                title="Estado Entrevista"
                description="Informacion de la entrevista AI"
              />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  {getInterviewStatusBadge(interview.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mensajes</span>
                  <span className="text-sm font-medium">{interview.total_messages}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duracion</span>
                  <span className="text-sm font-medium">{formatDuration(interview.duration_seconds)}</span>
                </div>
                {interview.completed_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Completada</span>
                    <span className="text-sm font-medium">
                      {new Date(interview.completed_at).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                )}
              </div>
            </BrandCard>
          )}

          {/* Top Reasons */}
          {shortlist?.top_reasons && shortlist.top_reasons.length > 0 && (
            <BrandCard>
              <BrandCardHeader
                title="Por que este candidato"
                description="Razones principales del ranking"
              />
              <ul className="space-y-2">
                {shortlist.top_reasons.map((reason, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <Star className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    {reason}
                  </li>
                ))}
              </ul>
            </BrandCard>
          )}

          {/* Recruiter Notes */}
          <BrandCard>
            <BrandCardHeader
              title="Notas del Reclutador"
              description="Comentarios internos"
            />
            {editingNotes ? (
              <div className="space-y-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 border rounded-lg text-sm min-h-[100px]"
                  placeholder="Agrega notas sobre este candidato..."
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingNotes(false)
                      setNotes(shortlist?.recruiter_notes || '')
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveNotes}
                    disabled={savingNotes}
                  >
                    {savingNotes ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                {notes ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sin notas</p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setEditingNotes(true)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {notes ? 'Editar' : 'Agregar'} notas
                </Button>
              </div>
            )}
          </BrandCard>

          {/* Actions */}
          <BrandCard>
            <BrandCardHeader
              title="Acciones"
              description="Gestionar candidato"
            />
            <div className="space-y-2">
              {candidate.user?.email && (
                <Button className="w-full" variant="outline">
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar Email
                </Button>
              )}
              <Link href={`/employer/jobs/${jobId}`} className="block">
                <Button className="w-full" variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a Shortlist
                </Button>
              </Link>
            </div>
          </BrandCard>
        </div>
      </div>
    </AppShell>
  )
}
