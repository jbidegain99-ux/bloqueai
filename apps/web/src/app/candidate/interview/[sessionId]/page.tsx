'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth'
import { candidateApi } from '@/lib/api'
import {
  Send,
  Loader2,
  CheckCircle2,
  MessageSquare,
  User,
  Bot,
  AlertCircle,
  ArrowLeft,
  Clock,
} from 'lucide-react'

interface InterviewMessage {
  role: 'assistant' | 'user'
  content: string
  timestamp?: string
}

interface InterviewSession {
  id: string
  status: string
  current_question_index: number
  total_questions: number
  messages: Array<{
    role: string
    content: string
    sequence: number
  }>
  job_id?: string
  started_at?: string
}

export default function InterviewSessionPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const { isAuthenticated, isHydrated, accessToken } = useAuthStore()
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [messages, setMessages] = useState<InterviewMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Redirect if not authenticated
  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isHydrated, router])

  // Load session
  useEffect(() => {
    const loadSession = async () => {
      if (!accessToken || !sessionId) return

      setLoading(true)
      setError(null)

      try {
        const sessionData = await candidateApi.getInterviewSession(accessToken, sessionId)
        setSession(sessionData)

        // Convert messages to chat format
        const chatMessages: InterviewMessage[] = (sessionData.messages || []).map((msg: any) => ({
          role: msg.role === 'AI' || msg.role === 'SYSTEM' ? 'assistant' : 'user',
          content: msg.content,
        }))
        setMessages(chatMessages)
      } catch (err: any) {
        console.error('Error loading session:', err)
        setError(err?.message || 'Error al cargar la sesion de entrevista')
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [sessionId, accessToken])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !accessToken || !session || sending) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setSending(true)
    setError(null)

    // Optimistically add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      // Send message to backend
      const response = await candidateApi.sendMessage(accessToken, sessionId, userMessage)

      // Update session with new state
      setSession(response)

      // Get the new AI message from response
      const newMessages: InterviewMessage[] = (response.messages || []).map((msg: any) => ({
        role: msg.role === 'AI' || msg.role === 'SYSTEM' ? 'assistant' : 'user',
        content: msg.content,
      }))
      setMessages(newMessages)

      // Check if interview completed
      if (response.status === 'COMPLETED') {
        // Auto-complete the interview
        await handleComplete()
      }
    } catch (err: any) {
      console.error('Error sending message:', err)
      setError(err?.message || 'Error al enviar el mensaje')
      // Remove the optimistic message on error
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setSending(false)
    }
  }

  const handleComplete = async () => {
    if (!accessToken || completing) return

    setCompleting(true)
    setError(null)

    try {
      await candidateApi.completeInterview(accessToken, sessionId)
      // Redirect to applications or profile
      router.push('/candidate/applications')
    } catch (err: any) {
      console.error('Error completing interview:', err)
      setError(err?.message || 'Error al completar la entrevista')
    } finally {
      setCompleting(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!isHydrated || !isAuthenticated) return null

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-bloque-gold500 mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando entrevista...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (error && !session) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button variant="outline" onClick={() => router.push('/candidate/applications')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a aplicaciones
          </Button>
        </div>
      </AppShell>
    )
  }

  const isCompleted = session?.status === 'COMPLETED'
  const progress = session
    ? ((session.current_question_index + 1) / session.total_questions) * 100
    : 0

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-bloque-navy900 flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              Entrevista con IA
            </h1>
            <p className="text-muted-foreground mt-1">
              Responde las preguntas del entrevistador virtual
            </p>
          </div>
          {isCompleted ? (
            <Badge className="bg-green-100 text-green-700">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Completada
            </Badge>
          ) : (
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" />
              En progreso
            </Badge>
          )}
        </div>

        {/* Progress */}
        {!isCompleted && session && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Progreso</span>
              <span>
                Pregunta {session.current_question_index + 1} de {session.total_questions}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Chat Area */}
        <BrandCard className="mb-4">
          <div className="h-[400px] overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>La entrevista comenzara en un momento...</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${
                    msg.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'assistant'
                        ? 'bg-bloque-navy900 text-white'
                        : 'bg-bloque-gold500 text-white'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'assistant'
                        ? 'bg-bloque-gray50'
                        : 'bg-bloque-navy900 text-white'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-bloque-navy900 text-white flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-bloque-gray50 rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </BrandCard>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Input Area */}
        {!isCompleted ? (
          <div className="flex gap-3">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu respuesta..."
              className="min-h-[80px] resize-none"
              disabled={sending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || sending}
              className="self-end"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-green-50 p-6 rounded-lg mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold text-green-800 mb-2">
                Entrevista completada
              </h3>
              <p className="text-green-700 text-sm">
                Gracias por completar la entrevista. Tu reporte esta siendo generado.
              </p>
            </div>
            <Button onClick={() => router.push('/candidate/applications')}>
              Ver mis aplicaciones
              <ArrowLeft className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Tips */}
        {!isCompleted && (
          <div className="mt-6 p-4 bg-bloque-gray50 rounded-lg">
            <h4 className="text-sm font-medium text-bloque-navy900 mb-2">
              Consejos para la entrevista:
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Responde de manera clara y estructurada</li>
              <li>• Usa ejemplos concretos de tu experiencia</li>
              <li>• Presiona Enter para enviar, Shift+Enter para nueva linea</li>
              <li>• Tomate tu tiempo para pensar antes de responder</li>
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  )
}
