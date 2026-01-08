'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore } from '@/lib/auth'
import { candidateApi } from '@/lib/api'
import { Send, Bot, User, CheckCircle } from 'lucide-react'

interface Message {
  role: 'AI' | 'CANDIDATE'
  content: string
  sequence: number
}

export default function InterviewPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, user } = useAuthStore()
  const [session, setSession] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startInterview = async () => {
    if (!accessToken) return
    setStarting(true)

    try {
      const response = await candidateApi.startInterview(accessToken) as any
      setSession(response)
      if (response.messages) {
        setMessages(response.messages)
      }
    } catch (err) {
      console.error('Error starting interview:', err)
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
            setCompleted(true) // Still show completed - profile will indicate the issue
          } else {
            setCompleted(true)
          }
        } catch (completeErr) {
          console.error('Error completing interview:', completeErr)
          setCompleted(true) // Show completed anyway - user can try to regenerate from profile
        }
      }
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setLoading(false)
    }
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
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Nuestra IA te hará una serie de preguntas para evaluar tus competencias
                y generar tu perfil profesional. La entrevista dura aproximadamente 15-20 minutos.
              </p>
              <Button onClick={startInterview} disabled={starting} size="lg">
                {starting ? 'Iniciando...' : 'Comenzar entrevista'}
              </Button>
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
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === 'CANDIDATE' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'AI' && (
                    <Avatar className="h-8 w-8">
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
                    <Avatar className="h-8 w-8">
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
                      <div className="w-2 h-2 bg-bloque-navy700 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-bloque-navy700 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

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
                ¡Entrevista completada!
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Gracias por completar la entrevista. Tu reporte está siendo generado
                y podrás verlo en tu perfil en unos momentos.
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
