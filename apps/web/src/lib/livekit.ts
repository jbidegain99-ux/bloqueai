/**
 * LiveKit configuration and utilities for video interviews.
 *
 * All API calls go through the Next.js /api proxy to avoid CORS issues.
 * We hardcode '/api' for client-side because this module is only used
 * in 'use client' components.
 */
import { ConnectionState } from 'livekit-client'

export const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || ''

// Always use the /api proxy — this module is only imported by client components
const API_BASE = '/api'

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
  const response = await fetch(`${API_BASE}/interviews/${interviewId}/join`, {
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
  const response = await fetch(`${API_BASE}/interviews/${interviewId}/start`, {
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
  const response = await fetch(`${API_BASE}/interviews/${interviewId}/status`, {
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
  const qs = status ? `?status=${status}` : ''
  const response = await fetch(`${API_BASE}/interviews${qs}`, {
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
  const response = await fetch(`${API_BASE}/interviews/${interviewId}/analyze`, {
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
  const response = await fetch(`${API_BASE}/interviews/${interviewId}/results`, {
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
