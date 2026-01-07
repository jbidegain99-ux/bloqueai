const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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
}

export { ApiError }
