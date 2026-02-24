/**
 * LiveKit configuration and utilities for video interviews.
 */
import { ConnectionState } from 'livekit-client'

export const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || ''

export interface InterviewRoomInfo {
  token: string
  livekit_url: string
  room_name: string
}

export interface VideoInterviewItem {
  id: string
  room_name: string
  status: string
  application_id: string
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string | null
}

/**
 * Fetch interview room details and join token from the API.
 */
export async function joinInterviewRoom(
  interviewId: string,
  token: string
): Promise<InterviewRoomInfo> {
  const API_URL = typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    : '/api'

  const response = await fetch(`${API_URL}/interviews/${interviewId}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error al unirse a la entrevista' }))
    throw new Error(error.detail || 'Error al unirse a la entrevista')
  }

  return response.json()
}

/**
 * Start the AI interviewer agent for a room.
 */
export async function startInterviewer(
  interviewId: string,
  token: string
): Promise<{ status: string; message: string }> {
  const API_URL = typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    : '/api'

  const response = await fetch(`${API_URL}/interviews/${interviewId}/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error al iniciar entrevistador' }))
    throw new Error(error.detail || 'Error al iniciar entrevistador')
  }

  return response.json()
}

/**
 * Get interview status.
 */
export async function getInterviewStatus(
  interviewId: string,
  token: string
): Promise<{
  interview_id: string
  status: string
  started_at: string | null
  ended_at: string | null
  transcript_available: boolean
  recording_available: boolean
}> {
  const API_URL = typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    : '/api'

  const response = await fetch(`${API_URL}/interviews/${interviewId}/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error al obtener estado' }))
    throw new Error(error.detail || 'Error al obtener estado')
  }

  return response.json()
}

/**
 * List video interviews.
 */
export async function listVideoInterviews(
  token: string,
  status?: string
): Promise<{ items: VideoInterviewItem[]; total: number }> {
  const API_URL = typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    : '/api'

  const qs = status ? `?status=${status}` : ''
  const response = await fetch(`${API_URL}/interviews/${qs}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error al listar entrevistas' }))
    throw new Error(error.detail || 'Error al listar entrevistas')
  }

  return response.json()
}

// ============== Analysis Types & API ==============

export interface CompetencyScoreData {
  score: number
  justification: string
}

export interface AnalysisScoresData {
  communication?: CompetencyScoreData
  technical?: CompetencyScoreData
  problem_solving?: CompetencyScoreData
  cultural_fit?: CompetencyScoreData
  experience?: CompetencyScoreData
}

export interface RecommendationData {
  decision: string
  confidence: number
  rationale: string
}

export interface InterviewAnalysis {
  overall_score: number
  scores: AnalysisScoresData
  strengths: string[]
  areas_for_improvement: string[]
  red_flags: string[]
  executive_summary: string
  recommendation: RecommendationData | null
  suggested_next_steps: string[]
}

export interface InterviewResults {
  interview_id: string
  status: string
  job_title: string
  company_name: string
  candidate_name: string
  started_at: string | null
  ended_at: string | null
  duration_minutes: number | null
  transcript: Array<{
    speaker: string
    text: string
    timestamp: string
  }> | null
  analysis?: InterviewAnalysis
  feedback?: {
    overall_impression: 'positive' | 'neutral' | 'needs_improvement'
    strengths_highlighted: string[]
    tip: string | null
  }
}

/**
 * Trigger AI analysis on a completed interview.
 */
export async function analyzeInterview(
  interviewId: string,
  token: string
): Promise<InterviewAnalysis> {
  const API_URL = typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    : '/api'

  const response = await fetch(`${API_URL}/interviews/${interviewId}/analyze`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error al analizar entrevista' }))
    throw new Error(error.detail || 'Error al analizar entrevista')
  }

  return response.json()
}

/**
 * Fetch interview results (full for employer, limited for candidate).
 */
export async function getInterviewResults(
  interviewId: string,
  token: string
): Promise<InterviewResults> {
  const API_URL = typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    : '/api'

  const response = await fetch(`${API_URL}/interviews/${interviewId}/results`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error al obtener resultados' }))
    throw new Error(error.detail || 'Error al obtener resultados')
  }

  return response.json()
}

/**
 * Human-readable connection state labels in Spanish.
 */
export function getConnectionStateLabel(state: ConnectionState): string {
  const labels: Record<string, string> = {
    [ConnectionState.Disconnected]: 'Desconectado',
    [ConnectionState.Connecting]: 'Conectando...',
    [ConnectionState.Connected]: 'Conectado',
    [ConnectionState.Reconnecting]: 'Reconectando...',
  }
  return labels[state] || 'Desconocido'
}
