'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, ArrowLeft } from 'lucide-react'
import { PreJoinCheck } from '@/components/interview/PreJoinCheck'
import { VideoRoom } from '@/components/interview/VideoRoom'
import { useAuthStore } from '@/lib/auth'
import {
  joinInterviewRoom,
  startInterviewer,
  type InterviewRoomInfo,
} from '@/lib/livekit'
import { Button } from '@/components/ui/button'

type InterviewState = 'loading' | 'pre-join' | 'joining' | 'in-room' | 'completed' | 'error'

export default function CandidateVideoInterviewPage() {
  const params = useParams()
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const interviewId = params.id as string

  const [state, setState] = useState<InterviewState>('loading')
  const [roomInfo, setRoomInfo] = useState<InterviewRoomInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Auth guard
  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated || !accessToken) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, accessToken, router])

  const loadInterview = useCallback(async () => {
    if (!accessToken || !interviewId) return

    try {
      setState('loading')
      const room = await joinInterviewRoom(interviewId, accessToken)
      setRoomInfo(room)
      setState('pre-join')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      setState('error')
    }
  }, [accessToken, interviewId])

  useEffect(() => {
    if (isHydrated && accessToken) {
      loadInterview()
    }
  }, [isHydrated, accessToken, loadInterview])

  const handleReady = async () => {
    if (!roomInfo || !accessToken) return

    try {
      setState('joining')
      // Start the AI interviewer first, then show the room
      await startInterviewer(interviewId, accessToken)
      // Only go to in-room after agent started successfully
      setState('in-room')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar'
      setError(message)
      setState('error')
    }
  }

  const handleLeave = useCallback(() => {
    router.push('/candidate/interviews')
  }, [router])

  const handleComplete = useCallback(() => {
    setState('completed')
    setTimeout(() => {
      router.push('/candidate/interviews')
    }, 3000)
  }, [router])

  if (!isHydrated || !isAuthenticated) {
    return null
  }

  // Loading state
  if (state === 'loading' || state === 'joining') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-white">
            {state === 'loading' ? 'Cargando entrevista...' : 'Uniendose a la sala...'}
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">:(</span>
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">
            Error al cargar la entrevista
          </h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => router.push('/candidate/interviews')}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <Button onClick={loadInterview}>Reintentar</Button>
          </div>
        </div>
      </div>
    )
  }

  // Pre-join check
  if (state === 'pre-join') {
    return (
      <div className="min-h-screen bg-gray-900 py-8">
        <PreJoinCheck
          onReady={handleReady}
          onCancel={() => router.push('/candidate/interviews')}
        />
      </div>
    )
  }

  // In room
  if (state === 'in-room' && roomInfo) {
    return (
      <VideoRoom
        token={roomInfo.token}
        serverUrl={roomInfo.livekit_url}
        roomName={roomInfo.room_name}
        interviewId={interviewId}
        isCandidate={true}
        onLeave={handleLeave}
        onInterviewComplete={handleComplete}
      />
    )
  }

  // Completed
  if (state === 'completed') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">+</span>
          </div>
          <h2 className="text-white text-2xl font-semibold mb-2">
            Entrevista completada
          </h2>
          <p className="text-gray-400">
            Gracias por tu tiempo. Te redirigiremos en un momento...
          </p>
        </motion.div>
      </div>
    )
  }

  return null
}
