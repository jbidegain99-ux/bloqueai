'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth'
import { candidateApi } from '@/lib/api'
import {
  Send,
  Bot,
  User,
  CheckCircle,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  StopCircle
} from 'lucide-react'

interface Message {
  role: 'AI' | 'CANDIDATE'
  content: string
  sequence: number
}

export default function InterviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobIdParam = searchParams.get('job_id')

  const { accessToken, isAuthenticated, user } = useAuthStore()
  const [session, setSession] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [jobInfo, setJobInfo] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load job info if job_id is provided
  useEffect(() => {
    if (jobIdParam && accessToken) {
      // For now we just store the job_id, in a full implementation we'd fetch job details
      setJobInfo({ id: jobIdParam })
    }
  }, [jobIdParam, accessToken])

  const startInterview = async (jobId?: string) => {
    if (!accessToken) return
    if (!consent) {
      setError('Debes aceptar los terminos para continuar')
      return
    }

    setStarting(true)
    setError(null)

    try {
      const response = await candidateApi.startInterview(accessToken, jobId || jobIdParam || undefined) as any
      setSession(response)
      if (response.messages) {
        setMessages(response.messages)
      }
    } catch (err: any) {
      console.error('Error starting interview:', err)
      setError(err?.message || 'Error al iniciar la entrevista. Intenta de nuevo.')
    } finally {
      setStarting(false)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !session || !accessToken) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)
    setError(null)

    // Add user message immediately
    const tempMessage: Message = {
      role: 'CANDIDATE',
      content: userMessage,
      sequence: messages.length,
    }
    setMessages(prev => [...prev, tempMessage])

    try {
      const response = await candidateApi.sendMessage(accessToken, session.id, userMessage) as any
      setSession(response)

      // Update with actual messages from response
      if (response.messages) {
        setMessages(response.messages)
      }

      // Check if completed
      if (response.status === 'COMPLETED') {
        // Trigger report generation and wait for it
        try {
          const completeResponse = await candidateApi.completeInterview(accessToken, session.id) as any
          console.log('Interview completed:', completeResponse)

          if (completeResponse.report_status === 'completed' || completeResponse.report_status?.startsWith('completed')) {
            setCompleted(true)
          } else if (completeResponse.report_status?.startsWith('failed')) {
            console.error('Report generation failed:', completeResponse.report_status)
            setCompleted(true)
          } else {
            setCompleted(true)
          }
        } catch (completeErr) {
          console.error('Error completing interview:', completeErr)
          setCompleted(true)
        }
      }
    } catch (err: any) {
      console.error('Error sending message:', err)
      setError('Error al enviar tu respuesta. Intenta de nuevo.')
      // Remove the temp message on error
      setMessages(prev => prev.filter(m => m !== tempMessage))
    } finally {
      setLoading(false)
    }
  }

  const retryLastMessage = () => {
    setError(null)
    // Re-add input if it was cleared
  }

  const progress = session
    ? ((session.current_question_index + 1) / session.total_questions) * 100
    : 0

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-bloque-navy900 mb-6">
          Entrevista con IA
        </h1>

        {!session && !completed && (
          <BrandCard>
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-bloque-navy900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="h-10 w-10 text-bloque-gold500" />
              </div>
              <h2 className="text-xl font-semibold text-bloque-navy900 mb-2">
                Bienvenido a tu entrevista virtual
              </h2>

              {jobIdParam && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Badge variant="outline" className="text-sm">
                    <Briefcase className="h-3 w-3 mr-1" />
                    Entrevista para puesto especifico
                  </Badge>
                </div>
              )}

              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {jobIdParam
                  ? 'Esta entrevista evaluara tus competencias especificamente para el puesto al que aplicaste.'
                  : 'Nuestra IA te hara una serie de preguntas para evaluar tus competencias y generar tu perfil profesional.'}
                {' '}La entrevista dura aproximadamente 15-20 minutos.
              </p>

              {/* Consent checkbox */}
              <div className="max-w-md mx-auto mb-6">
                <label className="flex items-start gap-3 text-left cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-muted-foreground">
                    Acepto ser evaluado por inteligencia artificial y entiendo que mis respuestas
                    seran analizadas para generar un perfil profesional que sera compartido con
                    potenciales empleadores.
                  </span>
                </label>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center justify-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button
                onClick={() => startInterview()}
                disabled={starting || !consent}
                size="lg"
              >
                {starting ? 'Iniciando...' : 'Comenzar entrevista'}
              </Button>

              <p className="text-xs text-muted-foreground mt-4">
                Al continuar, aceptas nuestros terminos de servicio y politica de privacidad.
              </p>
            </div>
          </BrandCard>
        )}

        {session && !completed && (
          <BrandCard className="flex flex-col h-[600px]">
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Progreso de la entrevista</span>
                <span>{session.current_question_index + 1} / {session.total_questions}</span>
              </div>
              <Progress value={progress} className="h-2" />
              {session.ai_analysis?.dynamic_mode && (
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">
                    Entrevista dinamica
                  </Badge>
                  {session.ai_analysis?.current_phase && (
                    <Badge variant="secondary" className="text-xs">
                      {session.ai_analysis.current_phase}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === 'CANDIDATE' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'AI' && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-bloque-navy900 text-white">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === 'AI'
                        ? 'bg-bloque-gray50 text-bloque-navy900'
                        : 'bg-bloque-navy900 text-white'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === 'CANDIDATE' && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-bloque-gold500 text-bloque-navy900">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-bloque-navy900 text-white">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-bloque-gray50 p-3 rounded-lg">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-bloque-navy700 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-bloque-navy700 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-bloque-navy700 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-2 p-2 bg-red-50 text-red-600 rounded-lg text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </span>
                <Button variant="ghost" size="sm" onClick={retryLastMessage}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Input area */}
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu respuesta..."
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </BrandCard>
        )}

        {completed && (
          <BrandCard>
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-bloque-navy900 mb-2">
                Entrevista completada!
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Gracias por completar la entrevista. Tu reporte esta siendo generado
                y podras verlo en tu perfil en unos momentos.
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => router.push('/candidate/profile')}>
                  Ver mi perfil
                </Button>
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  Volver al inicio
                </Button>
              </div>
            </div>
          </BrandCard>
        )}
      </div>
    </AppShell>
  )
}
