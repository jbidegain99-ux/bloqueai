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
    fetchApi<{
      id: string
      status: string
      current_question_index: number
      total_questions: number
      messages: Array<{ role: string; content: string; sequence: number }>
      job_id?: string
      started_at?: string
    }>('/candidate/interview/start', {
      method: 'POST',
      body: { job_id: jobId },
      token,
    }),

  sendMessage: (token: string, sessionId: string, content: string) =>
    fetchApi<{
      id: string
      status: string
      current_question_index: number
      total_questions: number
      messages: Array<{ role: string; content: string; sequence: number }>
    }>(`/candidate/interview/${sessionId}/message`, {
      method: 'POST',
      body: { content },
      token,
    }),

  completeInterview: (token: string, sessionId: string) =>
    fetchApi<{
      session_id: string
      status: string
      message: string
      report_status: string
    }>(`/candidate/interview/${sessionId}/complete`, {
      method: 'POST',
      token,
    }),

  getInterviewSession: (token: string, sessionId: string) =>
    fetchApi<{
      id: string
      status: string
      current_question_index: number
      total_questions: number
      messages: Array<{ role: string; content: string; sequence: number }>
      job_id?: string
      started_at?: string
    }>(`/candidate/interview/${sessionId}`, { token }),

  getInterviews: (token: string) =>
    fetchApi('/candidate/interviews', { token }),

  getReport: (token: string) =>
    fetchApi('/candidate/report', { token }),

  generateCV: (token: string, data: {
    personal_info: {
      name: string
      email: string
      phone?: string
      location?: string
      headline?: string
    }
    work_history?: Array<{
      company: string
      title: string
      start_date: string
      end_date?: string
      description?: string
      achievements?: string[]
    }>
    education?: Array<{
      institution: string
      degree: string
      field?: string
      year?: string
    }>
    skills?: {
      technical?: string[]
      soft?: string[]
    }
    languages?: Array<{
      language: string
      level: string
    }>
  }) =>
    fetchApi<{
      success: boolean
      message: string
      resume_id: string
      file_url: string | null
      summary: string
      html_preview: string
    }>('/candidate/cv/generate', {
      method: 'POST',
      body: data,
      token,
    }),
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

  exportShortlist: async (token: string, jobId: string) => {
    // Use fetch with proper Authorization header instead of window.open with query token
    const response = await fetch(`${API_URL}/employer/jobs/${jobId}/shortlist/export.csv`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new ApiError(
        errorData?.detail || 'Error al exportar shortlist',
        response.status,
        errorData
      )
    }

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = `shortlist-${jobId}.csv`
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '')
      }
    }

    // Create blob and trigger download
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },

  getCandidateDetail: (token: string, jobId: string, candidateId: string) =>
    fetchApi(`/employer/jobs/${jobId}/candidates/${candidateId}`, { token }),

  updateShortlistItem: (token: string, jobId: string, itemId: string, data: { status?: string; recruiter_notes?: string }) =>
    fetchApi(`/employer/jobs/${jobId}/shortlist/${itemId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  // Job Copilot AI
  copilotSuggestDescription: (token: string, data: {
    title: string
    category: string
    seniority: string
    company_context?: string
    partial_description?: string
  }) =>
    fetchApi<{
      description?: string
      suggestions?: string[]
      error?: string
    }>('/employer/copilot/suggest-description', {
      method: 'POST',
      body: data,
      token,
    }),

  copilotSuggestRequirements: (token: string, data: {
    title: string
    category: string
    seniority: string
    description?: string
  }) =>
    fetchApi<{
      must_haves?: string[]
      nice_to_haves?: string[]
      reasoning?: string
      error?: string
    }>('/employer/copilot/suggest-requirements', {
      method: 'POST',
      body: data,
      token,
    }),

  copilotSuggestQuestions: (token: string, data: {
    title: string
    category: string
    seniority: string
    must_haves?: string[]
    description?: string
  }) =>
    fetchApi<{
      questions?: Array<{ question: string; type: string; evaluates: string }>
      notes?: string
      error?: string
    }>('/employer/copilot/suggest-questions', {
      method: 'POST',
      body: data,
      token,
    }),

  getCategoryFields: (token: string, category: string) =>
    fetchApi<{
      fields: Array<{
        key: string
        label: string
        type: string
        required?: boolean
        options?: string[]
      }>
    }>(`/employer/copilot/category-fields/${category}`, { token }),
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

  // System Settings
  getSettings: (token: string) =>
    fetchApi<Array<{
      id: string
      key: string
      value: string | null
      value_int: number | null
      value_bool: boolean | null
      value_json: Record<string, unknown> | null
      description: string | null
      category: string
      is_editable: boolean
      created_at: string
      updated_at: string
    }>>('/admin/settings', { token }),

  updateSetting: (token: string, key: string, data: {
    value?: string | null
    value_int?: number | null
    value_bool?: boolean | null
    value_json?: Record<string, unknown> | null
  }) =>
    fetchApi(`/admin/settings/${key}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  // Dashboard with filters
  getDashboardMetrics: (token: string, params?: {
    client_id?: string
    job_id?: string
    category?: string
    location?: string
    date_from?: string
    date_to?: string
    status?: string
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.client_id) queryParams.set('client_id', params.client_id)
    if (params?.job_id) queryParams.set('job_id', params.job_id)
    if (params?.category) queryParams.set('category', params.category)
    if (params?.location) queryParams.set('location', params.location)
    if (params?.date_from) queryParams.set('date_from', params.date_from)
    if (params?.date_to) queryParams.set('date_to', params.date_to)
    if (params?.status) queryParams.set('status', params.status)
    const queryString = queryParams.toString()
    return fetchApi<{
      metrics: {
        total_applications: number
        above_threshold: number
        interviews_started: number
        interviews_completed: number
        shortlisted: number
        avg_match_score: number | null
        avg_interview_score: number | null
      }
      filter_options: {
        clients: Array<{ id: string; name: string }>
        jobs: Array<{ id: string; title: string }>
        categories: string[]
        locations: string[]
      }
    }>(`/admin/dashboard/metrics${queryString ? `?${queryString}` : ''}`, { token })
  },

  exportDashboard: async (token: string, params?: {
    client_id?: string
    job_id?: string
    category?: string
    location?: string
    date_from?: string
    date_to?: string
    status?: string
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.client_id) queryParams.set('client_id', params.client_id)
    if (params?.job_id) queryParams.set('job_id', params.job_id)
    if (params?.category) queryParams.set('category', params.category)
    if (params?.location) queryParams.set('location', params.location)
    if (params?.date_from) queryParams.set('date_from', params.date_from)
    if (params?.date_to) queryParams.set('date_to', params.date_to)
    if (params?.status) queryParams.set('status', params.status)
    const queryString = queryParams.toString()

    const API_URL = typeof window === 'undefined'
      ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      : '/api'

    const response = await fetch(`${API_URL}/admin/dashboard/export.csv${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new ApiError(errorData?.detail || 'Error al exportar dashboard', response.status, errorData)
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },

  // Clients Management
  getClients: (token: string, params?: {
    include_non_clients?: boolean
    is_active?: boolean
    search?: string
    page?: number
    page_size?: number
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.include_non_clients) queryParams.set('include_non_clients', 'true')
    if (params?.is_active !== undefined) queryParams.set('is_active', String(params.is_active))
    if (params?.search) queryParams.set('search', params.search)
    if (params?.page) queryParams.set('page', String(params.page))
    if (params?.page_size) queryParams.set('page_size', String(params.page_size))
    const queryString = queryParams.toString()
    return fetchApi<{
      items: Array<{
        id: string
        name: string
        slug: string
        description: string | null
        website: string | null
        industry: string | null
        size: string | null
        logo_url: string | null
        is_active: boolean
        is_client: boolean
        client_code: string | null
        match_threshold: number | null
        created_at: string
        updated_at: string
        job_count: number
      }>
      total: number
      page: number
      page_size: number
      total_pages: number
    }>(`/admin/clients${queryString ? `?${queryString}` : ''}`, { token })
  },

  getClient: (token: string, clientId: string) =>
    fetchApi<{
      id: string
      name: string
      slug: string
      description: string | null
      website: string | null
      industry: string | null
      size: string | null
      logo_url: string | null
      is_active: boolean
      is_client: boolean
      client_code: string | null
      match_threshold: number | null
      created_at: string
      updated_at: string
      job_count: number
    }>(`/admin/clients/${clientId}`, { token }),

  createClient: (token: string, data: {
    name: string
    description?: string
    website?: string
    industry?: string
    size?: string
    client_code?: string
    match_threshold?: number
  }) => {
    const queryParams = new URLSearchParams()
    queryParams.set('name', data.name)
    if (data.description) queryParams.set('description', data.description)
    if (data.website) queryParams.set('website', data.website)
    if (data.industry) queryParams.set('industry', data.industry)
    if (data.size) queryParams.set('size', data.size)
    if (data.client_code) queryParams.set('client_code', data.client_code)
    if (data.match_threshold !== undefined) queryParams.set('match_threshold', String(data.match_threshold))
    return fetchApi<{
      id: string
      name: string
      slug: string
      description: string | null
      website: string | null
      industry: string | null
      size: string | null
      logo_url: string | null
      is_active: boolean
      is_client: boolean
      client_code: string | null
      match_threshold: number | null
      created_at: string
      updated_at: string
      job_count: number
    }>(`/admin/clients?${queryParams.toString()}`, {
      method: 'POST',
      token,
    })
  },

  updateClient: (token: string, clientId: string, data: {
    name?: string
    description?: string
    website?: string
    industry?: string
    size?: string
    client_code?: string
    match_threshold?: number
    is_client?: boolean
    is_active?: boolean
  }) => {
    const queryParams = new URLSearchParams()
    if (data.name) queryParams.set('name', data.name)
    if (data.description !== undefined) queryParams.set('description', data.description)
    if (data.website !== undefined) queryParams.set('website', data.website)
    if (data.industry !== undefined) queryParams.set('industry', data.industry)
    if (data.size !== undefined) queryParams.set('size', data.size)
    if (data.client_code !== undefined) queryParams.set('client_code', data.client_code)
    if (data.match_threshold !== undefined) queryParams.set('match_threshold', String(data.match_threshold))
    if (data.is_client !== undefined) queryParams.set('is_client', String(data.is_client))
    if (data.is_active !== undefined) queryParams.set('is_active', String(data.is_active))
    return fetchApi<{
      id: string
      name: string
      slug: string
      description: string | null
      website: string | null
      industry: string | null
      size: string | null
      logo_url: string | null
      is_active: boolean
      is_client: boolean
      client_code: string | null
      match_threshold: number | null
      created_at: string
      updated_at: string
      job_count: number
    }>(`/admin/clients/${clientId}?${queryParams.toString()}`, {
      method: 'PATCH',
      token,
    })
  },

  getClientJobs: (token: string, clientId: string, params?: {
    status_filter?: string
    page?: number
    page_size?: number
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.status_filter) queryParams.set('status_filter', params.status_filter)
    if (params?.page) queryParams.set('page', String(params.page))
    if (params?.page_size) queryParams.set('page_size', String(params.page_size))
    const queryString = queryParams.toString()
    return fetchApi<{
      items: Array<{
        id: string
        title: string
        status: string
        category: string | null
        seniority: string | null
        location: string | null
        modality: string | null
        created_at: string
      }>
      total: number
      page: number
      page_size: number
      total_pages: number
    }>(`/admin/clients/${clientId}/jobs${queryString ? `?${queryString}` : ''}`, { token })
  },

  // Placements Management
  getPlacements: (token: string, params?: {
    client_id?: string
    status_filter?: string
    type_filter?: string
    date_from?: string
    date_to?: string
    page?: number
    page_size?: number
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.client_id) queryParams.set('client_id', params.client_id)
    if (params?.status_filter) queryParams.set('status_filter', params.status_filter)
    if (params?.type_filter) queryParams.set('type_filter', params.type_filter)
    if (params?.date_from) queryParams.set('date_from', params.date_from)
    if (params?.date_to) queryParams.set('date_to', params.date_to)
    if (params?.page) queryParams.set('page', String(params.page))
    if (params?.page_size) queryParams.set('page_size', String(params.page_size))
    const queryString = queryParams.toString()
    return fetchApi<{
      items: Array<{
        id: string
        candidate_id: string
        candidate_name: string | null
        client_id: string
        client_name: string | null
        job_id: string | null
        job_title: string | null
        position_title: string
        department: string | null
        location: string | null
        placement_type: string
        status: string
        start_date: string | null
        end_date: string | null
        salary_amount: number | null
        salary_currency: string | null
        salary_period: string | null
        notes: string | null
        created_at: string
      }>
      total: number
      page: number
      page_size: number
      total_pages: number
      filter_options: {
        clients: Array<{ id: string; name: string }>
        statuses: string[]
        types: string[]
      }
    }>(`/admin/placements${queryString ? `?${queryString}` : ''}`, { token })
  },

  getPlacement: (token: string, placementId: string) =>
    fetchApi<{
      id: string
      candidate_id: string
      candidate_name: string | null
      client_id: string
      client_name: string | null
      job_id: string | null
      job_title: string | null
      position_title: string
      department: string | null
      location: string | null
      placement_type: string
      status: string
      offer_date: string | null
      start_date: string | null
      end_date: string | null
      salary_amount: number | null
      salary_currency: string | null
      salary_period: string | null
      placement_fee: number | null
      fee_percentage: number | null
      fee_paid: boolean
      notes: string | null
      created_at: string
      updated_at: string
    }>(`/admin/placements/${placementId}`, { token }),

  createPlacement: (token: string, data: {
    candidate_id: string
    client_id: string
    position_title: string
    placement_type: string
    job_id?: string
    department?: string
    location?: string
    start_date?: string
    end_date?: string
    salary_amount?: number
    salary_currency?: string
    salary_period?: string
    notes?: string
  }) => {
    const queryParams = new URLSearchParams()
    queryParams.set('candidate_id', data.candidate_id)
    queryParams.set('client_id', data.client_id)
    queryParams.set('position_title', data.position_title)
    queryParams.set('placement_type', data.placement_type)
    if (data.job_id) queryParams.set('job_id', data.job_id)
    if (data.department) queryParams.set('department', data.department)
    if (data.location) queryParams.set('location', data.location)
    if (data.start_date) queryParams.set('start_date', data.start_date)
    if (data.end_date) queryParams.set('end_date', data.end_date)
    if (data.salary_amount !== undefined) queryParams.set('salary_amount', String(data.salary_amount))
    if (data.salary_currency) queryParams.set('salary_currency', data.salary_currency)
    if (data.salary_period) queryParams.set('salary_period', data.salary_period)
    if (data.notes) queryParams.set('notes', data.notes)
    return fetchApi<{
      id: string
      candidate_id: string
      candidate_name: string | null
      client_id: string
      client_name: string | null
      job_id: string | null
      position_title: string
      placement_type: string
      status: string
      start_date: string | null
      end_date: string | null
      created_at: string
    }>(`/admin/placements?${queryParams.toString()}`, {
      method: 'POST',
      token,
    })
  },

  updatePlacement: (token: string, placementId: string, data: {
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
  }) => {
    const queryParams = new URLSearchParams()
    if (data.status) queryParams.set('status_update', data.status)
    if (data.position_title) queryParams.set('position_title', data.position_title)
    if (data.department !== undefined) queryParams.set('department', data.department)
    if (data.location !== undefined) queryParams.set('location', data.location)
    if (data.placement_type) queryParams.set('placement_type', data.placement_type)
    if (data.start_date !== undefined) queryParams.set('start_date', data.start_date)
    if (data.end_date !== undefined) queryParams.set('end_date', data.end_date)
    if (data.salary_amount !== undefined) queryParams.set('salary_amount', String(data.salary_amount))
    if (data.salary_currency !== undefined) queryParams.set('salary_currency', data.salary_currency)
    if (data.salary_period !== undefined) queryParams.set('salary_period', data.salary_period)
    if (data.notes !== undefined) queryParams.set('notes', data.notes)
    return fetchApi<{
      id: string
      candidate_id: string
      candidate_name: string | null
      client_id: string
      client_name: string | null
      job_id: string | null
      job_title: string | null
      position_title: string
      department: string | null
      location: string | null
      placement_type: string
      status: string
      start_date: string | null
      end_date: string | null
      salary_amount: number | null
      salary_currency: string | null
      salary_period: string | null
      notes: string | null
      created_at: string
      updated_at: string
    }>(`/admin/placements/${placementId}?${queryParams.toString()}`, {
      method: 'PATCH',
      token,
    })
  },

  getPlacementsReport: (token: string, params?: {
    client_id?: string
    date_from?: string
    date_to?: string
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.client_id) queryParams.set('client_id', params.client_id)
    if (params?.date_from) queryParams.set('date_from', params.date_from)
    if (params?.date_to) queryParams.set('date_to', params.date_to)
    const queryString = queryParams.toString()
    return fetchApi<{
      summary: {
        active_placements: number
        completed_in_period: number
      }
      by_client: Array<{ client: string; active_count: number }>
      filters: {
        client_id: string | null
        date_from: string | null
        date_to: string | null
      }
    }>(`/admin/placements/report${queryString ? `?${queryString}` : ''}`, { token })
  },
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
    country?: string
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
    if (params?.country) queryParams.set('country', params.country)
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

  getLocations: () =>
    fetchApi<{
      countries: { value: string; label: string }[]
      locations: { value: string; label: string }[]
    }>('/public/jobs/locations/list'),
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
