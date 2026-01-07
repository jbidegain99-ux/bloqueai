'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScoreDisplay } from '@/components/brand/ScoreDisplay'
import { useAuthStore, isRecruiter } from '@/lib/auth'
import { adminApi } from '@/lib/api'
import { AlertTriangle, MessageSquare, User, Clock, CheckCircle, ChevronDown, ChevronUp, Play, FileText } from 'lucide-react'

interface InterviewMessage {
  role: 'assistant' | 'user'
  content: string
  timestamp: string
}

interface Interview {
  id: string
  candidate_id: string
  job_id?: string
  status: string
  transcript: InterviewMessage[]
  started_at: string
  completed_at?: string
  total_messages: number
  duration_minutes?: number
  requires_review: boolean
  candidate?: {
    id: string
    user?: {
      full_name: string
      email: string
    }
  }
  report?: {
    id: string
    overall_score: number
    summary?: string
    confidence_score: number
    score_overridden: boolean
    original_score?: number
    competency_scores?: Record<string, { score: number; notes?: string }>
  }
}

type TabValue = 'completed' | 'flagged' | 'in_progress' | 'all'

export default function InterviewsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated } = useAuthStore()
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null)
  const [expandedTranscript, setExpandedTranscript] = useState(false)
  const [activeTab, setActiveTab] = useState<TabValue>('completed')

  // Override form
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [overrideScore, setOverrideScore] = useState(3)
  const [overrideReason, setOverrideReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isRecruiter()) {
      router.push('/dashboard')
      return
    }

    loadInterviews(activeTab)
  }, [isAuthenticated, accessToken, router])

  const loadInterviews = async (tab: TabValue) => {
    if (!accessToken) return
    setLoading(true)
    try {
      let data: Interview[] = []
      if (tab === 'flagged') {
        data = await adminApi.getFlaggedInterviews(accessToken) as Interview[]
      } else {
        const statusFilter = tab === 'completed' ? 'COMPLETED' : tab === 'in_progress' ? 'IN_PROGRESS' : 'ALL'
        data = await adminApi.getInterviews(accessToken, statusFilter, false) as Interview[]
      }
      setInterviews(data)
    } catch (err) {
      console.error('Error loading interviews:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabValue)
    setSelectedInterview(null)
    loadInterviews(tab as TabValue)
  }

  const selectInterview = (interview: Interview) => {
    setSelectedInterview(interview)
    setShowOverrideForm(false)
    setExpandedTranscript(false)
    if (interview.report) {
      setOverrideScore(interview.report.overall_score)
    }
  }

  const handleOverride = async () => {
    if (!accessToken || !selectedInterview?.report) return

    if (!overrideReason.trim()) {
      alert('Debes proporcionar una razón para el override')
      return
    }

    setSubmitting(true)
    try {
      await adminApi.overrideScore(
        accessToken,
        selectedInterview.report.id,
        overrideScore,
        overrideReason
      )
      await loadInterviews(activeTab)
      setShowOverrideForm(false)
      setOverrideReason('')
    } catch (err) {
      console.error('Error overriding score:', err)
      alert('Error al actualizar el puntaje')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string, requiresReview: boolean) => {
    if (requiresReview) {
      return <Badge variant="warning"><AlertTriangle className="h-3 w-3 mr-1" /> Flaggeada</Badge>
    }
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" /> Completada</Badge>
      case 'IN_PROGRESS':
        return <Badge variant="outline"><Play className="h-3 w-3 mr-1" /> En progreso</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (!isAuthenticated) return null

  if (loading && interviews.length === 0) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Cargando entrevistas...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <BrandHero
        title="Panel de Entrevistas"
        subtitle="Visualiza y revisa todas las entrevistas realizadas"
        size="sm"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
        <TabsList className="mb-6">
          <TabsTrigger value="completed">
            <CheckCircle className="h-4 w-4 mr-2" />
            Completadas
          </TabsTrigger>
          <TabsTrigger value="flagged">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Flaggeadas
          </TabsTrigger>
          <TabsTrigger value="in_progress">
            <Play className="h-4 w-4 mr-2" />
            En Progreso
          </TabsTrigger>
          <TabsTrigger value="all">
            <FileText className="h-4 w-4 mr-2" />
            Todas
          </TabsTrigger>
        </TabsList>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Interviews list */}
          <div className="lg:col-span-1">
            <BrandCard>
              <BrandCardHeader
                title={
                  activeTab === 'completed' ? 'Entrevistas Completadas' :
                  activeTab === 'flagged' ? 'Entrevistas Flaggeadas' :
                  activeTab === 'in_progress' ? 'Entrevistas en Progreso' :
                  'Todas las Entrevistas'
                }
                description={`${interviews.length} entrevista${interviews.length !== 1 ? 's' : ''}`}
              />
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-pulse">Cargando...</div>
                  </div>
                ) : interviews.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay entrevistas en esta categoría</p>
                  </div>
                ) : (
                  interviews.map((interview) => (
                    <button
                      key={interview.id}
                      onClick={() => selectInterview(interview)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedInterview?.id === interview.id
                          ? 'border-bloque-navy900 bg-bloque-gray50'
                          : 'border-gray-200 hover:border-bloque-navy900/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {interview.requires_review && (
                            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-bloque-navy900">
                              {interview.candidate?.user?.full_name || 'Candidato'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(interview.started_at)}
                            </p>
                          </div>
                        </div>
                        {interview.report && (
                          <div className="text-right">
                            <span className={`text-sm font-semibold ${
                              interview.report.overall_score >= 4 ? 'text-green-600' :
                              interview.report.overall_score >= 3 ? 'text-amber-600' :
                              'text-red-600'
                            }`}>
                              {interview.report.overall_score.toFixed(1)}
                            </span>
                            {interview.report.score_overridden && (
                              <span className="text-xs text-muted-foreground ml-1">(mod)</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        {getStatusBadge(interview.status, interview.requires_review)}
                        <span className="text-xs text-muted-foreground">
                          {interview.total_messages} msg
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </BrandCard>
          </div>

          {/* Interview detail */}
          <div className="lg:col-span-2">
            {selectedInterview ? (
              <div className="space-y-6">
                {/* Candidate info */}
                <BrandCard>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-bloque-gray50 rounded-full">
                        <User className="h-6 w-6 text-bloque-navy900" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-bloque-navy900">
                          {selectedInterview.candidate?.user?.full_name || 'Candidato'}
                        </h3>
                        <p className="text-muted-foreground">
                          {selectedInterview.candidate?.user?.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(selectedInterview.status, selectedInterview.requires_review)}
                      <div className="mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1 justify-end">
                          <Clock className="h-4 w-4" />
                          {selectedInterview.duration_minutes || '?'} min
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <MessageSquare className="h-4 w-4" />
                          {selectedInterview.total_messages} mensajes
                        </div>
                      </div>
                    </div>
                  </div>
                </BrandCard>

                {/* Score and override */}
                {selectedInterview.report && (
                  <BrandCard>
                    <BrandCardHeader
                      title="Puntuación"
                      description="Resultado de la entrevista AI"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <ScoreDisplay
                          score={selectedInterview.report.overall_score}
                          size="lg"
                        />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Confianza: {selectedInterview.report.confidence_score}%
                          </p>
                          {selectedInterview.report.score_overridden && (
                            <p className="text-sm text-amber-600">
                              Original: {selectedInterview.report.original_score?.toFixed(1)}
                            </p>
                          )}
                        </div>
                      </div>
                      {!showOverrideForm && (
                        <Button
                          variant="outline"
                          onClick={() => setShowOverrideForm(true)}
                        >
                          Modificar Puntaje
                        </Button>
                      )}
                    </div>

                    {selectedInterview.report.summary && (
                      <p className="mt-4 text-sm text-muted-foreground">
                        {selectedInterview.report.summary}
                      </p>
                    )}

                    {/* Competency scores */}
                    {selectedInterview.report.competency_scores && Object.keys(selectedInterview.report.competency_scores).length > 0 && (
                      <div className="mt-6 pt-4 border-t">
                        <h4 className="text-sm font-medium text-bloque-navy900 mb-3">Competencias Evaluadas</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {Object.entries(selectedInterview.report.competency_scores).map(([key, value]) => {
                            const score = typeof value === 'number' ? value : value?.score ?? 0
                            const labels: Record<string, string> = {
                              technical_skills: 'Técnicas',
                              communication: 'Comunicación',
                              problem_solving: 'Prob. Solving',
                              teamwork: 'Trabajo Equipo',
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

                    {showOverrideForm && (
                      <div className="mt-6 pt-6 border-t space-y-4">
                        <h4 className="font-medium text-bloque-navy900">Override de Puntaje</h4>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label>Nuevo Puntaje (1-5)</Label>
                            <Input
                              type="number"
                              min={1}
                              max={5}
                              step={0.1}
                              value={overrideScore}
                              onChange={(e) => setOverrideScore(parseFloat(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Razón del cambio *</Label>
                            <Input
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              placeholder="Explica por qué modificas el puntaje"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setShowOverrideForm(false)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleOverride}
                            disabled={submitting}
                          >
                            {submitting ? 'Guardando...' : 'Confirmar Override'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </BrandCard>
                )}

                {/* Transcript */}
                <BrandCard>
                  <button
                    onClick={() => setExpandedTranscript(!expandedTranscript)}
                    className="w-full flex items-center justify-between"
                  >
                    <BrandCardHeader
                      title="Transcripción"
                      description="Conversación completa de la entrevista"
                    />
                    {expandedTranscript ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  {expandedTranscript && (
                    <div className="mt-4 space-y-4 max-h-[500px] overflow-y-auto">
                      {selectedInterview.transcript && selectedInterview.transcript.length > 0 ? (
                        selectedInterview.transcript.map((message, index) => (
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
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No hay transcripción disponible
                        </p>
                      )}
                    </div>
                  )}
                </BrandCard>
              </div>
            ) : (
              <BrandCard className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona una entrevista para ver los detalles</p>
                </div>
              </BrandCard>
            )}
          </div>
        </div>
      </Tabs>
    </AppShell>
  )
}
