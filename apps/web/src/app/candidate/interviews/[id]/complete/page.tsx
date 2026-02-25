'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  CheckCircle,
  Star,
  Lightbulb,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useAuthStore } from '@/lib/auth'
import { getInterviewResults, type InterviewResults } from '@/lib/livekit'

const impressionConfig = {
  positive: {
    title: 'Excelente entrevista!',
    message:
      'Tu desempeño fue muy positivo. El equipo de reclutamiento revisará los resultados pronto.',
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
  neutral: {
    title: 'Entrevista completada!',
    message:
      'Gracias por tu tiempo. El equipo evaluará tu perfil y te contactará.',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  needs_improvement: {
    title: 'Gracias por participar!',
    message:
      'Apreciamos tu interés. Sigue preparándote y mejorando tus habilidades.',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
  },
}

export default function InterviewCompletePage() {
  const params = useParams()
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const interviewId = params.id as string

  const [data, setData] = useState<InterviewResults | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated || !accessToken) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, accessToken, router])

  const fetchFeedback = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await getInterviewResults(interviewId, accessToken)
      setData(result)
    } catch (err: unknown) {
      // Silently handle - feedback may not be available yet
      if (err instanceof Error) {
        console.error('Error fetching feedback:', err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, interviewId])

  useEffect(() => {
    if (isHydrated && accessToken) {
      fetchFeedback()
    }
  }, [isHydrated, accessToken, fetchFeedback])

  if (!isHydrated || !isAuthenticated) return null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-bloque-gold500" />
      </div>
    )
  }

  const impression = data?.feedback?.overall_impression || 'neutral'
  const config = impressionConfig[impression]

  return (
    <div className="min-h-screen bg-bloque-gray50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div
              className={`w-24 h-24 ${config.bg} rounded-full flex items-center justify-center mx-auto mb-4`}
            >
              <CheckCircle className={`w-12 h-12 ${config.color}`} />
            </div>
            <h1 className={`text-2xl font-bold ${config.color}`}>
              {config.title}
            </h1>
            <p className="text-gray-600 mt-2">{config.message}</p>
          </div>

          {/* Interview Summary */}
          {data && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Entrevista para</p>
                  <p className="font-semibold text-lg">{data.job_title}</p>
                  <p className="text-gray-600">{data.company_name}</p>
                  {data.duration_minutes && (
                    <p className="text-sm text-gray-500 mt-2">
                      Duración: {data.duration_minutes} minutos
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feedback (if available) */}
          {data?.feedback && (
            <div className="space-y-4 mb-8">
              {/* Strengths */}
              {data.feedback.strengths_highlighted.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-5 h-5 text-yellow-500" />
                      <h3 className="font-medium">Puntos destacados</h3>
                    </div>
                    <ul className="space-y-2">
                      {data.feedback.strengths_highlighted.map(
                        (strength, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            {strength}
                          </li>
                        )
                      )}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Tip */}
              {data.feedback.tip && (
                <Card className="bg-blue-50 border-blue-100">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="w-5 h-5 text-blue-600" />
                      <h3 className="font-medium text-blue-900">
                        Consejo para mejorar
                      </h3>
                    </div>
                    <p className="text-sm text-blue-800">
                      {data.feedback.tip}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Next Steps */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-3">Qué sigue?</h3>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-bloque-navy900 text-white flex items-center justify-center flex-shrink-0 text-xs">
                    1
                  </span>
                  <span>
                    El equipo de reclutamiento revisará tu entrevista
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-bloque-navy900 text-white flex items-center justify-center flex-shrink-0 text-xs">
                    2
                  </span>
                  <span>Recibirás una notificación con el resultado</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-bloque-navy900 text-white flex items-center justify-center flex-shrink-0 text-xs">
                    3
                  </span>
                  <span>
                    Si avanzas, te contactarán para la siguiente etapa
                  </span>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="mt-8 space-y-3">
            <Link href="/candidate/applications" className="block">
              <Button className="w-full">
                Ver mis aplicaciones
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/candidate/jobs" className="block">
              <Button variant="outline" className="w-full">
                Explorar más trabajos
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
