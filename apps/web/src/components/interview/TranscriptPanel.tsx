'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare } from 'lucide-react'

interface TranscriptEntry {
  id: string
  speaker: 'candidate' | 'ai' | 'system'
  text: string
  timestamp: Date
}

interface TranscriptPanelProps {
  interviewId: string
}

export function TranscriptPanel({ interviewId }: TranscriptPanelProps) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries])

  // Poll for transcript updates (WebSocket can be added later)
  useEffect(() => {
    // For now, transcript entries are delivered via LiveKit data channel
    // or can be polled from the API. This is a placeholder that listens
    // for CustomEvents dispatched by the RoomEventHandler.
    const handleTranscriptEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        speaker: 'candidate' | 'ai' | 'system'
        text: string
      }
      if (detail?.text) {
        setEntries((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            speaker: detail.speaker,
            text: detail.text,
            timestamp: new Date(),
          },
        ])
      }
    }

    window.addEventListener('interview-transcript', handleTranscriptEvent)
    return () => {
      window.removeEventListener('interview-transcript', handleTranscriptEvent)
    }
  }, [interviewId])

  const speakerConfig = {
    ai: { label: 'Entrevistador', color: 'text-indigo-400' },
    candidate: { label: 'Candidato', color: 'text-green-400' },
    system: { label: 'Sistema', color: 'text-gray-400' },
  }

  return (
    <div className="h-full flex flex-col w-80">
      <div className="p-3 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <h3 className="text-white font-medium text-sm">Transcripcion</h3>
        </div>
        <p className="text-gray-500 text-xs mt-0.5">En tiempo real</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence initial={false}>
          {entries.length === 0 && (
            <div className="text-gray-500 text-sm text-center py-8">
              La transcripcion aparecera aqui cuando comience la conversacion.
            </div>
          )}

          {entries.map((entry) => {
            const config = speakerConfig[entry.speaker]
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-medium ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="text-gray-600 text-xs">
                    {entry.timestamp.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-gray-300">{entry.text}</p>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
