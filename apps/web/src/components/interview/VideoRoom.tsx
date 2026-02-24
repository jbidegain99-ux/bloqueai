'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useRoomContext,
  useParticipants,
  GridLayout,
  ParticipantTile,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track, RoomEvent } from 'livekit-client'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, AlertCircle, MessageSquare, MessageSquareOff } from 'lucide-react'
import { InterviewTimer } from './InterviewTimer'
import { TranscriptPanel } from './TranscriptPanel'

interface VideoRoomProps {
  token: string
  serverUrl: string
  roomName: string
  interviewId: string
  isCandidate: boolean
  onLeave: () => void
  onInterviewComplete: () => void
}

export function VideoRoom({
  token,
  serverUrl,
  roomName,
  interviewId,
  isCandidate,
  onLeave,
  onInterviewComplete,
}: VideoRoomProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isStarted, setIsStarted] = useState(false)
  const [showTranscript, setShowTranscript] = useState(true)
  const hasConnectedRef = useRef(false)

  const handleConnected = useCallback(() => {
    setConnectionError(null)
    setIsStarted(true)
    hasConnectedRef.current = true
  }, [])

  const handleError = useCallback((error: Error) => {
    console.error('[VideoRoom] LiveKit error:', error.message)
    setConnectionError(error.message)
  }, [])

  const handleDisconnected = useCallback(() => {
    console.log('[VideoRoom] Disconnected. hasConnectedOnce:', hasConnectedRef.current)
    if (hasConnectedRef.current) {
      // Normal disconnect after interview — go back to list
      onLeave()
    } else {
      // Never connected successfully — show error instead of redirecting
      setConnectionError('No se pudo conectar a la sala de entrevista. Verifica tu conexion e intenta de nuevo.')
    }
  }, [onLeave])

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        video={isCandidate}
        audio={isCandidate}
        onConnected={handleConnected}
        onError={handleError}
        onDisconnected={handleDisconnected}
        data-lk-theme="default"
        className="flex-1 flex flex-col"
      >
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-white font-semibold">Entrevista en Vivo</h1>
            {isStarted && <InterviewTimer />}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                showTranscript
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              aria-label={showTranscript ? 'Ocultar transcripcion' : 'Mostrar transcripcion'}
            >
              {showTranscript ? (
                <MessageSquareOff className="w-4 h-4" />
              ) : (
                <MessageSquare className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {showTranscript ? 'Ocultar' : 'Mostrar'}
              </span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex min-h-0">
          {/* Video Area */}
          <div className="flex-1 relative">
            <AnimatePresence>
              {connectionError && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-4 left-4 right-4 z-10"
                >
                  <div className="rounded-lg border border-red-800 bg-red-900/80 p-4 flex items-start gap-3 backdrop-blur-sm">
                    <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-200 font-medium text-sm">
                        Error de conexion
                      </p>
                      <p className="text-red-300 text-sm mt-1">
                        {connectionError}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <CustomVideoGrid isCandidate={isCandidate} />
          </div>

          {/* Transcript Panel */}
          <AnimatePresence>
            {showTranscript && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-gray-800 border-l border-gray-700 overflow-hidden flex-shrink-0"
              >
                <TranscriptPanel interviewId={interviewId} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 border-t border-gray-700 p-4 flex-shrink-0">
          <ControlBar
            variation="verbose"
            controls={{
              camera: isCandidate,
              microphone: isCandidate,
              screenShare: false,
              chat: false,
              leave: true,
            }}
          />
        </div>

        <RoomAudioRenderer />
        <RoomEventHandler
          interviewId={interviewId}
          onInterviewComplete={onInterviewComplete}
        />
      </LiveKitRoom>
    </div>
  )
}

function CustomVideoGrid({ isCandidate }: { isCandidate: boolean }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )

  const participants = useParticipants()
  const hasAIInterviewer = participants.some(
    (p) => p.identity === 'ai-interviewer'
  )

  if (participants.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Conectando a la sala...</p>
        </div>
      </div>
    )
  }

  if (!hasAIInterviewer && isCandidate) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Esperando al entrevistador IA...</p>
          <p className="text-gray-500 text-sm mt-2">
            Se unira en unos momentos
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full p-4">
      <GridLayout tracks={tracks} className="h-full">
        <ParticipantTile />
      </GridLayout>
    </div>
  )
}

function RoomEventHandler({
  interviewId,
  onInterviewComplete,
}: {
  interviewId: string
  onInterviewComplete: () => void
}) {
  const room = useRoomContext()

  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload)) as {
          type?: string
          speaker?: string
          text?: string
        }

        if (message.type === 'interview_complete') {
          onInterviewComplete()
        }

        // Forward transcript data as CustomEvent for TranscriptPanel
        if (message.type === 'transcript' && message.text) {
          window.dispatchEvent(
            new CustomEvent('interview-transcript', {
              detail: {
                speaker: message.speaker || 'system',
                text: message.text,
              },
            })
          )
        }
      } catch {
        // Ignore malformed data
      }
    }

    room.on(RoomEvent.DataReceived, handleDataReceived)

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived)
    }
  }, [room, onInterviewComplete])

  return null
}
