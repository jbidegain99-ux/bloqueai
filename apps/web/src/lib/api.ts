// Use relative path for browser requests (goes through Next.js API proxy)
// This avoids CORS issues by having Next.js server make the request
const getApiUrl = () => {
  // Server-side: use direct URL
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  }
  // Client-side: use local proxy to avoid CORS
  return '/api'
}

const API_URL = getApiUrl()

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface FetchOptions {
  method?: RequestMethod
  body?: unknown
  headers?: Record<string, string>
  token?: string
}

class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, token } = options

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    // Handle FastAPI validation errors (422) which return detail as array
    let errorMessage = 'An error occurred'
    if (data?.detail) {
      if (typeof data.detail === 'string') {
        errorMessage = data.detail
      } else if (Array.isArray(data.detail) && data.detail.length > 0) {
        // Extract message from validation error
        errorMessage = data.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ')
      } else if (typeof data.detail === 'object') {
        errorMessage = JSON.stringify(data.detail)
      }
    }
    throw new ApiError(errorMessage, response.status, data)
  }

  return data as T
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<{ access_token: string; refresh_token: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  register: (data: { email: string; password: string; full_name: string; role: string; company_name?: string }) =>
    fetchApi('/auth/register', {
      method: 'POST',
      body: data,
    }),

  refresh: (refreshToken: string) =>
    fetchApi<{ access_token: string; refresh_token: string }>('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
    }),

  me: (token: string) =>
    fetchApi('/auth/me', { token }),
}

// Candidate API
export const candidateApi = {
  getProfile: (token: string) =>
    fetchApi('/candidate/profile', { token }),

  updateProfile: (token: string, data: Record<string, unknown>) =>
    fetchApi('/candidate/profile', {
      method: 'PATCH',
      body: data,
      token,
    }),

  uploadResume: async (token: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_URL}/candidate/resume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new ApiError(error.detail || 'Upload failed', response.status, error)
    }

    return response.json()
  },

  getResumes: (token: string) =>
    fetchApi('/candidate/resumes', { token }),

  startInterview: (token: string, jobId?: string) =>
    fetchApi('/candidate/interview/start', {
      method: 'POST',
      body: { job_id: jobId },
      token,
    }),

  sendMessage: (token: string, sessionId: string, content: string) =>
    fetchApi(`/candidate/interview/${sessionId}/message`, {
      method: 'POST',
      body: { content },
      token,
    }),

  completeInterview: (token: string, sessionId: string) =>
    fetchApi(`/candidate/interview/${sessionId}/complete`, {
      method: 'POST',
      token,
    }),

  getInterviews: (token: string) =>
    fetchApi('/candidate/interviews', { token }),

  getReport: (token: string) =>
    fetchApi('/candidate/report', { token }),
}

// Employer API
export const employerApi = {
  getJobs: (token: string, page = 1) =>
    fetchApi(`/employer/jobs?page=${page}`, { token }),

  getJob: (token: string, jobId: string) =>
    fetchApi(`/employer/jobs/${jobId}`, { token }),

  createJob: (token: string, data: Record<string, unknown>) =>
    fetchApi('/employer/jobs', {
      method: 'POST',
      body: data,
      token,
    }),

  updateJob: (token: string, jobId: string, data: Record<string, unknown>) =>
    fetchApi(`/employer/jobs/${jobId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  publishJob: (token: string, jobId: string) =>
    fetchApi(`/employer/jobs/${jobId}/publish`, {
      method: 'POST',
      token,
    }),

  generateShortlist: (token: string, jobId: string, maxCandidates = 10) =>
    fetchApi(`/employer/jobs/${jobId}/shortlist/generate`, {
      method: 'POST',
      body: { max_candidates: maxCandidates },
      token,
    }),

  getShortlist: (token: string, jobId: string) =>
    fetchApi(`/employer/jobs/${jobId}/shortlist`, { token }),

  compareCandidates: (token: string, jobId: string, candidateIds: string[]) =>
    fetchApi(`/employer/jobs/${jobId}/shortlist/compare`, {
      method: 'POST',
      body: { candidate_ids: candidateIds },
      token,
    }),

  exportShortlist: (token: string, jobId: string) => {
    window.open(`${API_URL}/employer/jobs/${jobId}/shortlist/export.csv?token=${token}`, '_blank')
  },

  getCandidateDetail: (token: string, jobId: string, candidateId: string) =>
    fetchApi(`/employer/jobs/${jobId}/candidates/${candidateId}`, { token }),

  updateShortlistItem: (token: string, jobId: string, itemId: string, data: { status?: string; recruiter_notes?: string }) =>
    fetchApi(`/employer/jobs/${jobId}/shortlist/${itemId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),
}

// Admin API
export const adminApi = {
  getRubrics: (token: string) =>
    fetchApi('/admin/rubrics', { token }),

  getRubric: (token: string, rubricId: string) =>
    fetchApi(`/admin/rubrics/${rubricId}`, { token }),

  createRubric: (token: string, data: Record<string, unknown>) =>
    fetchApi('/admin/rubrics', {
      method: 'POST',
      body: data,
      token,
    }),

  updateRubric: (token: string, rubricId: string, data: Record<string, unknown>) =>
    fetchApi(`/admin/rubrics/${rubricId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  simulateRubric: (token: string, rubricId: string, jobId: string, weights: Record<string, number>) =>
    fetchApi(`/admin/rubrics/${rubricId}/simulate`, {
      method: 'POST',
      body: { job_id: jobId, criteria_weights: weights },
      token,
    }),

  getDashboardKpis: (token: string) =>
    fetchApi('/admin/dashboard/kpis', { token }),

  getFlaggedInterviews: (token: string) =>
    fetchApi('/admin/interviews/flagged', { token }),

  getInterviews: (token: string, statusFilter?: 'COMPLETED' | 'IN_PROGRESS' | 'ALL', flaggedOnly = false) =>
    fetchApi(`/admin/interviews?status_filter=${statusFilter || 'ALL'}&flagged_only=${flaggedOnly}`, { token }),

  getInterview: (token: string, sessionId: string) =>
    fetchApi(`/admin/interviews/${sessionId}`, { token }),

  overrideScore: (token: string, reportId: string, newScore: number, reason: string) =>
    fetchApi(`/admin/reports/${reportId}/override`, {
      method: 'POST',
      body: { new_score: newScore, reason },
      token,
    }),

  getAuditLogs: (token: string, entityType?: string) =>
    fetchApi(`/admin/audit-logs${entityType ? `?entity_type=${entityType}` : ''}`, { token }),
}

// Public API (no auth required)
export const publicApi = {
  submitLead: (data: {
    name: string
    email: string
    company?: string
    country?: string
    roles_needed?: string
    message?: string
  }) =>
    fetchApi('/public/leads', {
      method: 'POST',
      body: data,
    }),

  getJobs: (params?: {
    page?: number
    page_size?: number
    search?: string
    category?: string
    seniority?: string
    modality?: string
    location?: string
    salary_min?: number
    salary_max?: number
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set('page', params.page.toString())
    if (params?.page_size) queryParams.set('page_size', params.page_size.toString())
    if (params?.search) queryParams.set('search', params.search)
    if (params?.category) queryParams.set('category', params.category)
    if (params?.seniority) queryParams.set('seniority', params.seniority)
    if (params?.modality) queryParams.set('modality', params.modality)
    if (params?.location) queryParams.set('location', params.location)
    if (params?.salary_min) queryParams.set('salary_min', params.salary_min.toString())
    if (params?.salary_max) queryParams.set('salary_max', params.salary_max.toString())

    const queryString = queryParams.toString()
    return fetchApi<{
      items: any[]
      total: number
      page: number
      page_size: number
      total_pages: number
    }>(`/public/jobs${queryString ? `?${queryString}` : ''}`)
  },

  getJob: (jobId: string) =>
    fetchApi<any>(`/public/jobs/${jobId}`),

  getJobCategories: () =>
    fetchApi<{ categories: { value: string; label: string }[] }>('/public/jobs/categories/list'),

  getSeniorityLevels: () =>
    fetchApi<{ seniority_levels: { value: string; label: string }[] }>('/public/jobs/seniority/list'),

  getModalities: () =>
    fetchApi<{ modalities: { value: string; label: string }[] }>('/public/jobs/modality/list'),
}

// Applications API (new wizard flow)
export const applicationsApi = {
  create: (token: string, jobId: string) =>
    fetchApi<{
      id: string
      candidate_id: string
      job_id: string
      status: string
      created_at: string
    }>('/applications', {
      method: 'POST',
      body: { job_id: jobId },
      token,
    }),

  list: (token: string, statusFilter?: string) =>
    fetchApi<Array<{
      id: string
      candidate_id: string
      job_id: string
      status: string
      match_score: number | null
      resume_filename: string | null
      job: {
        id: string
        title: string
        company: { id: string; name: string }
        location: string | null
        modality: string | null
      } | null
      created_at: string
    }>>(`/applications${statusFilter ? `?status_filter=${statusFilter}` : ''}`, { token }),

  get: (token: string, applicationId: string) =>
    fetchApi<{
      id: string
      candidate_id: string
      job_id: string
      status: string
      resume_filename: string | null
      resume_file_type: string | null
      resume_file_size: number | null
      match_score: number | null
      candidate_profile: Record<string, unknown> | null
      match_reasons: string[] | null
      match_gaps: string[] | null
      recommended_job_ids: Array<{
        id: string
        title: string
        company_name: string
        match_score: number
        location: string | null
        modality: string | null
      }> | null
      interview_session_id: string | null
      job: {
        id: string
        title: string
        description: string
        company: { id: string; name: string; industry: string | null }
        location: string | null
        modality: string | null
        seniority: string | null
        must_haves: string[]
        nice_to_haves: string[]
        salary_min: number | null
        salary_max: number | null
        salary_currency: string | null
      } | null
      created_at: string
      updated_at: string
    }>(`/applications/${applicationId}`, { token }),

  uploadResume: async (token: string, applicationId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    // DO NOT set Content-Type header - browser will set it automatically with correct boundary
    const response = await fetch(`${API_URL}/applications/${applicationId}/resume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Note: Do NOT set 'Content-Type' for FormData - it breaks multipart boundary
      },
      body: formData,
    })

    if (!response.ok) {
      // Robust error parsing - handle JSON, text, or empty responses
      let errorMessage = 'No pudimos subir tu CV. Intenta de nuevo o usa PDF/DOCX menor a 10MB.'
      let errorData: unknown = null

      try {
        const text = await response.text()
        if (text) {
          try {
            errorData = JSON.parse(text)
            if (typeof errorData === 'object' && errorData !== null && 'detail' in errorData) {
              const detail = (errorData as { detail: unknown }).detail
              if (typeof detail === 'string') {
                errorMessage = detail
              }
            }
          } catch {
            // Response was not JSON, use text as debug info
            console.debug('Upload error (non-JSON):', text.substring(0, 200))
          }
        }
      } catch {
        console.debug('Could not read error response body')
      }

      throw new ApiError(errorMessage, response.status, errorData)
    }

    // Parse success response
    try {
      return await response.json() as {
        success: boolean
        application_id: string
        filename: string
        file_type: string
        file_size: number
        status: string
      }
    } catch {
      throw new ApiError('Error procesando la respuesta del servidor', response.status, null)
    }
  },

  analyze: (token: string, applicationId: string) =>
    fetchApi<{
      success: boolean
      application_id: string
      match_score: number
      status: string
      candidate_profile: Record<string, unknown>
      match_reasons: string[]
      match_gaps: string[]
      recommended_jobs: Array<{
        id: string
        title: string
        company_name: string
        match_score: number
        location: string | null
        modality: string | null
      }> | null
    }>(`/applications/${applicationId}/analyze`, {
      method: 'POST',
      token,
    }),

  withdraw: (token: string, applicationId: string) =>
    fetchApi<{ success: boolean; message: string }>(`/applications/${applicationId}/withdraw`, {
      method: 'POST',
      token,
    }),
}

export { ApiError }
