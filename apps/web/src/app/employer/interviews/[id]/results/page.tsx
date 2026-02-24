'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  User,
  Briefcase,
  Clock,
  Star,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Minus,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/lib/auth'
import {
  getInterviewResults,
  analyzeInterview,
  type InterviewResults,
  type RecommendationData,
  type CompetencyScoreData,
} from '@/lib/livekit'

const COMPETENCY_NAMES: Record<string, string> = {
  communication: 'Comunicacion',
  technical: 'Competencia Tecnica',
  problem_solving: 'Resolucion de Problemas',
  cultural_fit: 'Ajuste Cultural',
  experience: 'Experiencia Relevante',
}

export default function InterviewResultsPage() {
  const params = useParams()
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const interviewId = params.id as string

  const [results, setResults] = useState<InterviewResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated || !accessToken) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, accessToken, router])

  const fetchResults = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true)
      setError(null)
      const data = await getInterviewResults(interviewId, accessToken)
      setResults(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar resultados'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [accessToken, interviewId])

  useEffect(() => {
    if (isHydrated && accessToken) {
      fetchResults()
    }
  }, [isHydrated, accessToken, fetchResults])

  const triggerAnalysis = async () => {
    if (!accessToken) return
    setAnalyzing(true)
    try {
      await analyzeInterview(interviewId, accessToken)
      await fetchResults()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error en el análisis'
      setError(message)
    } finally {
      setAnalyzing(false)
    }
  }

  if (!isHydrated || !isAuthenticated) return null

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-bloque-gold500" />
      </div>
    )
  }

  if (error || !results) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 mb-4">{error || 'No se encontraron resultados'}</p>
        <Button onClick={() => router.back()}>Volver</Button>
      </div>
    )
  }

  const { analysis } = results

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Volver a entrevistas
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-bloque-navy900">
              Resultados de Entrevista
            </h1>
            <div className="flex items-center gap-4 mt-2 text-gray-600">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {results.candidate_name}
              </span>
              <span className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {results.job_title}
              </span>
              {results.duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {results.duration_minutes} min
                </span>
              )}
            </div>
          </div>

          {!analysis && (
            <Button onClick={triggerAnalysis} disabled={analyzing}>
              {analyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Analizar con IA
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="analysis" className="space-y-6">
        <TabsList>
          <TabsTrigger value="analysis">Análisis</TabsTrigger>
          <TabsTrigger value="transcript">Transcripción</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis">
          {analysis ? (
            <div className="space-y-6">
              {/* Overall Score + Recommendation */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Puntuación General</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-bloque-gold500">
                          {analysis.overall_score.toFixed(1)}
                        </span>
                        <span className="text-gray-400">/ 10</span>
                      </div>
                    </div>
                    {analysis.recommendation && (
                      <RecommendationBadge recommendation={analysis.recommendation} />
                    )}
                  </div>
                  <p className="mt-4 text-gray-700">{analysis.executive_summary}</p>
                </CardContent>
              </Card>

              {/* Competency Scores */}
              <Card>
                <CardHeader>
                  <CardTitle>Evaluación por Competencias</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(analysis.scores).map(([key, data]) => {
                    if (!data) return null
                    return (
                      <CompetencyScoreBar
                        key={key}
                        name={COMPETENCY_NAMES[key] || key}
                        score={data.score}
                        justification={data.justification}
                      />
                    )
                  })}
                </CardContent>
              </Card>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Fortalezas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Star className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      Áreas de Mejora
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.areas_for_improvement.map((a, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center mt-0.5 flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm">{a}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Red Flags */}
              {analysis.red_flags.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="w-5 h-5" />
                      Señales de Alerta
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.red_flags.map((flag, i) => (
                        <li key={i} className="text-sm text-red-700">
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Next Steps */}
              {analysis.suggested_next_steps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Próximos Pasos Sugeridos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-2">
                      {analysis.suggested_next_steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-bloque-navy900 text-white text-sm flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Análisis no disponible</h3>
                <p className="text-gray-500 mb-4">
                  Haz clic en &quot;Analizar con IA&quot; para obtener una evaluación detallada
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Transcripción
              </CardTitle>
              <CardDescription>
                {results.transcript?.length || 0} intercambios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-y-auto pr-4 space-y-4">
                {results.transcript?.map((entry, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="mb-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-medium ${
                          entry.speaker === 'ai'
                            ? 'text-indigo-600'
                            : 'text-green-600'
                        }`}
                      >
                        {entry.speaker === 'ai' ? 'Entrevistador' : 'Candidato'}
                      </span>
                      {entry.timestamp && (
                        <span className="text-xs text-gray-400">
                          {entry.timestamp}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{entry.text}</p>
                  </motion.div>
                ))}
                {(!results.transcript || results.transcript.length === 0) && (
                  <p className="text-center text-gray-500 py-8">
                    No hay transcripción disponible
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============== Sub-components ==============

function RecommendationBadge({
  recommendation,
}: {
  recommendation: RecommendationData
}) {
  const configs: Record<
    string,
    { color: string; icon: typeof ThumbsUp; text: string }
  > = {
    STRONGLY_RECOMMEND: {
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: ThumbsUp,
      text: 'Altamente Recomendado',
    },
    RECOMMEND: {
      color: 'bg-green-50 text-green-600 border-green-100',
      icon: ThumbsUp,
      text: 'Recomendado',
    },
    NEUTRAL: {
      color: 'bg-gray-100 text-gray-600 border-gray-200',
      icon: Minus,
      text: 'Neutral',
    },
    NOT_RECOMMEND: {
      color: 'bg-red-50 text-red-600 border-red-100',
      icon: ThumbsDown,
      text: 'No Recomendado',
    },
    STRONGLY_NOT_RECOMMEND: {
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: ThumbsDown,
      text: 'No Recomendado',
    },
  }

  const config = configs[recommendation.decision] || configs.NEUTRAL
  const Icon = config.icon

  return (
    <div className={`px-4 py-2 rounded-lg border ${config.color}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5" />
        <span className="font-medium">{config.text}</span>
      </div>
      <p className="text-xs mt-1 opacity-80">
        Confianza: {Math.round(recommendation.confidence * 100)}%
      </p>
    </div>
  )
}

function CompetencyScoreBar({
  name,
  score,
  justification,
}: {
  name: string
  score: number
  justification: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-sm font-bold">{score}/10</span>
      </div>
      <Progress value={score * 10} className="h-2 mb-2" />
      <p className="text-xs text-gray-500">{justification}</p>
    </div>
  )
}
