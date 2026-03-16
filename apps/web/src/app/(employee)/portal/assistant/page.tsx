'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import {
  employeeApi,
  type EmployeeChatMessage,
} from '@/lib/api'
import { BrandCard } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Send,
  Trash2,
  Bot,
  User,
  ChevronLeft,
  AlertCircle,
  Sparkles,
} from 'lucide-react'

// ── Helpers ─────────────────────────────────────────────────────
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-SV', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Page ────────────────────────────────────────────────────────
export default function EmployeeAssistantPage() {
  const router = useRouter()
  const { user, accessToken, isAuthenticated, isHydrated } = useAuthStore()

  const [messages, setMessages] = useState<EmployeeChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
    'Cual es mi salario neto?',
    'Cuando es el proximo pago?',
    'Como solicito vacaciones?',
    'Cuanto he pagado de ISR este ano?',
    'Puedo ver mi colilla mas reciente?',
  ])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  // Auth guard
  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated || !accessToken) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, accessToken, router])

  // Welcome message
  useEffect(() => {
    if (isHydrated && messages.length === 0) {
      const firstName = user?.full_name?.split(' ')[0] || 'amigo'
      setMessages([
        {
          role: 'assistant',
          content: `Hola ${firstName}! Soy Valentina, tu asistente virtual de Recursos Humanos. Puedo ayudarte con consultas sobre tu salario, colillas de pago, vacaciones, documentos y mas. En que te puedo ayudar hoy?`,
          timestamp: new Date().toISOString(),
        },
      ])
    }
  }, [isHydrated, user, messages.length])

  const sendMessage = async (text: string) => {
    if (!text.trim() || !accessToken || isTyping) return

    const userMessage: EmployeeChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsTyping(true)
    setError(null)

    try {
      const res = await employeeApi.chat(accessToken, text.trim(), [
        ...messages,
        userMessage,
      ])

      const assistantMessage: EmployeeChatMessage = {
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (res.suggested_questions && res.suggested_questions.length > 0) {
        setSuggestedQuestions(res.suggested_questions)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar el mensaje'
      setError(msg)
    } finally {
      setIsTyping(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleSuggestionClick = (question: string) => {
    sendMessage(question)
  }

  const clearConversation = () => {
    const firstName = user?.full_name?.split(' ')[0] || 'amigo'
    setMessages([
      {
        role: 'assistant',
        content: `Hola de nuevo ${firstName}! Conversacion reiniciada. En que te puedo ayudar?`,
        timestamp: new Date().toISOString(),
      },
    ])
    setSuggestedQuestions([
      'Cual es mi salario neto?',
      'Cuando es el proximo pago?',
      'Como solicito vacaciones?',
      'Cuanto he pagado de ISR este ano?',
      'Puedo ver mi colilla mas reciente?',
    ])
    setError(null)
  }

  if (!isHydrated) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/portal')}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Portal
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-bloque-gold500 flex items-center justify-center">
              <Bot className="h-4 w-4 text-bloque-navy900" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-bloque-navy900">Valentina</h1>
              <p className="text-xs text-muted-foreground">Asistente de RRHH</p>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={clearConversation}>
          <Trash2 className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Limpiar</span>
        </Button>
      </div>

      {/* Chat Container */}
      <BrandCard className="flex-1 flex flex-col overflow-hidden p-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 ${
                msg.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'assistant'
                    ? 'bg-bloque-gold500'
                    : 'bg-bloque-navy900'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <Bot className="h-4 w-4 text-bloque-navy900" />
                ) : (
                  <User className="h-4 w-4 text-white" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'assistant'
                    ? 'bg-bloque-gray50 text-bloque-navy900 rounded-tl-sm'
                    : 'bg-bloque-navy900 text-white rounded-tr-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.role === 'assistant'
                      ? 'text-muted-foreground'
                      : 'text-bloque-slate200'
                  }`}
                >
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-bloque-gold500 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-bloque-navy900" />
              </div>
              <div className="bg-bloque-gray50 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-bloque-navy900/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 rounded-full bg-bloque-navy900/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 rounded-full bg-bloque-navy900/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 flex items-center gap-2 p-2 bg-red-50 text-red-600 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Suggestions */}
        {suggestedQuestions.length > 0 && messages.length <= 2 && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-1 mb-2">
              <Sparkles className="h-3 w-3 text-bloque-gold500" />
              <span className="text-xs text-muted-foreground">Sugerencias</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(q)}
                  disabled={isTyping}
                  className="text-xs px-3 py-1.5 rounded-full border border-bloque-slate200 text-bloque-navy900 hover:bg-bloque-gray50 hover:border-bloque-gold500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-bloque-slate200 p-4 flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            rows={1}
            disabled={isTyping}
            className="flex-1 resize-none rounded-xl border border-bloque-slate200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent disabled:opacity-50 min-h-[44px] max-h-[120px]"
            style={{
              height: 'auto',
              overflow: input.split('\n').length > 3 ? 'auto' : 'hidden',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`
            }}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="h-[44px] w-[44px] rounded-xl bg-bloque-navy900 hover:bg-bloque-navy900/90 p-0 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </BrandCard>
    </div>
  )
}
