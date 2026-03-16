// ============================================
// Domain Models
// ============================================

export interface Job {
  id: string
  title: string
  description: string
  department?: string
  category?: string
  seniority?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  modality?: string
  location?: string
  country?: string
  status: string
  must_haves?: string[]
  nice_to_haves?: string[]
  responsibilities?: string[]
  benefits?: string[]
  custom_questions?: string[]
  interview_type?: string
  shortlist_count?: number
  created_at?: string
  updated_at?: string
}

export interface CandidateProfile {
  id: string
  headline?: string
  location?: string
  skills?: string[]
  experience?: Experience[]
  education?: Education[]
  languages?: Language[]
  ai_summary?: string
  resume_source?: string
  resume_updated_at?: string
  has_completed_interview?: boolean
  competency_scores?: Record<string, CompetencyScore>
}

export interface Experience {
  title: string
  company: string
  start_date?: string
  end_date?: string
  description?: string
}

export interface Education {
  degree: string
  institution: string
  year?: string
}

export interface Language {
  language: string
  level: string
}

export interface CompetencyScore {
  score: number
  notes?: string
}

export interface CandidateReport {
  id?: string
  summary?: string
  overall_score?: number
  confidence_score?: number
  competency_scores?: Record<string, CompetencyScore>
  strengths?: string[]
  weaknesses?: string[]
  risks?: string[]
  recommendations?: string[]
  flags?: string[]
  score_overridden?: boolean
  original_score?: number
}

// ============================================
// API Response Wrappers
// ============================================

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ShortlistResponse {
  items: ShortlistItem[]
}

export interface ShortlistItem {
  id: string
  candidate_id: string
  rank: number
  total_score: number
  final_score: number
  cv_score?: number
  interview_score?: number
  interview_status: string
  status: string
  flags_count?: number
  candidate?: {
    id: string
    headline?: string
    location?: string
    skills?: string[]
    ai_summary?: string
    competency_scores?: Record<string, CompetencyScore>
  }
  report?: {
    overall_score: number
    summary?: string
  }
  top_reasons?: string[]
  risks?: string[]
  top_competencies?: Array<{ name: string; score: number }>
}

// ============================================
// KPI / Dashboard
// ============================================

export interface DashboardKpis {
  total_candidates: number
  interviews_completed: number
  active_jobs: number
  candidates_hired: number
  interview_completion_rate: number | null
  shortlist_to_contact_rate: number | null
  contact_to_hire_rate: number | null
  avg_interview_score: number | null
  flagged_interviews_count: number
  score_overrides_count: number
  candidates_with_interviews: number
  candidates_shortlisted: number
  candidates_contacted: number
}

// ============================================
// Interview
// ============================================

export interface InterviewSessionMessage {
  role: string
  content: string
  sequence: number
}

// ============================================
// Placement Update
// ============================================

export interface PlacementUpdate {
  status?: string
  position_title?: string
  department?: string
  location?: string
  placement_type?: string
  start_date?: string
  end_date?: string
  salary_amount?: number
  salary_currency?: string
  salary_period?: string
  notes?: string
}

// ============================================
// Application
// ============================================

export interface ApplicationData {
  id: string
  status: string
  job_id: string
  match_score?: number | null
  interview_session_id?: string
  job?: {
    id: string
    title: string
  } | null
}

// ============================================
// Helpers
// ============================================

/** Extract error message from unknown catch value */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return 'An unexpected error occurred'
}
