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

// Payroll API
// --- Payroll TypeScript Interfaces ---

interface PayrollEmployee {
  id: string
  client_id: string
  client_name: string | null
  full_name: string
  email: string | null
  phone: string | null
  employee_code: string | null
  department: string | null
  position: string | null
  is_active: boolean
  hire_date: string | null
  termination_date: string | null
  active_contract: {
    contract_type: string | null
    base_salary: number | null
    currency: string | null
    pay_frequency: string | null
  } | null
  created_at: string | null
}

interface PayrollContract {
  id: string
  employee_id: string
  employee_name: string
  client_id: string
  contract_type: string
  start_date: string
  end_date: string | null
  base_salary: number
  currency: string
  pay_frequency: string
  is_active: boolean
  notes: string | null
  created_at: string | null
}

interface PayrollAttendanceRecord {
  id: string
  employee_id: string
  employee_name: string
  client_id: string
  date: string
  hours: number
  attendance_type: string
  notes: string | null
}

interface PayrollRunItem {
  id: string
  client_id: string
  client_name: string | null
  period_start: string
  period_end: string
  pay_frequency: string
  status: string
  total_gross: number
  total_deductions: number
  total_net: number
  employee_count: number
  currency: string
  approved_by_name: string | null
  approved_at: string | null
  notes: string | null
  created_at: string | null
}

interface PayrollLineItem {
  id: string
  employee_id: string
  employee_name: string
  employee_code: string | null
  department: string | null
  base_salary: number
  days_worked: number | null
  hours_regular: number
  hours_overtime: number
  gross_pay: number
  total_deductions: number
  net_pay: number
  deductions_detail: Array<{ name: string; type: string; amount: number }> | null
}

interface PayrollDeductionType {
  id: string
  client_id: string
  name: string
  description: string | null
  calc_type: string
  value: number
  is_active: boolean
  is_mandatory: boolean
  created_at: string | null
}

interface PayrollSummary {
  client_name: string | null
  period: string | null
  total_employees: number
  total_gross: number
  total_deductions: number
  total_net: number
  runs_count: number
  currency: string
}

interface PayrollDetailItem {
  employee_name: string
  employee_code: string | null
  department: string | null
  base_salary: number
  gross_pay: number
  total_deductions: number
  net_pay: number
}

interface PayrollPayslip {
  employee_id: string
  employee_name: string
  payslip_id: string | null
  html_content: string | null
  generated_at: string | null
}

interface AttendanceCsvPreviewResult {
  rows: Array<{
    employee_code: string | null
    employee_name: string | null
    date: string
    hours: number
    attendance_type: string
    notes: string | null
    is_duplicate: boolean
    employee_id: string | null
  }>
  total_rows: number
  valid_rows: number
  duplicate_rows: number
  unmapped_rows: number
}

export const payrollApi = {
  // Employees
  getEmployees: (token: string, params?: {
    client_id?: string
    is_active?: boolean
    search?: string
    skip?: number
    limit?: number
  }) => {
    const qp = new URLSearchParams()
    if (params?.client_id) qp.set('client_id', params.client_id)
    if (params?.is_active !== undefined) qp.set('is_active', String(params.is_active))
    if (params?.search) qp.set('search', params.search)
    if (params?.skip !== undefined) qp.set('skip', String(params.skip))
    if (params?.limit !== undefined) qp.set('limit', String(params.limit))
    const qs = qp.toString()
    return fetchApi<PayrollEmployee[]>(`/payroll/employees${qs ? `?${qs}` : ''}`, { token })
  },

  createEmployee: (token: string, data: {
    client_id: string
    full_name: string
    email?: string
    phone?: string
    employee_code?: string
    department?: string
    position?: string
    hire_date?: string
  }) =>
    fetchApi<PayrollEmployee>('/payroll/employees', { method: 'POST', body: data, token }),

  updateEmployee: (token: string, employeeId: string, data: {
    full_name?: string
    email?: string
    phone?: string
    employee_code?: string
    department?: string
    position?: string
    is_active?: boolean
    hire_date?: string
    termination_date?: string
  }) =>
    fetchApi<PayrollEmployee>(`/payroll/employees/${employeeId}`, { method: 'PATCH', body: data, token }),

  // Contracts
  getContracts: (token: string, params?: {
    client_id?: string
    employee_id?: string
    is_active?: boolean
  }) => {
    const qp = new URLSearchParams()
    if (params?.client_id) qp.set('client_id', params.client_id)
    if (params?.employee_id) qp.set('employee_id', params.employee_id)
    if (params?.is_active !== undefined) qp.set('is_active', String(params.is_active))
    const qs = qp.toString()
    return fetchApi<PayrollContract[]>(`/payroll/contracts${qs ? `?${qs}` : ''}`, { token })
  },

  createContract: (token: string, data: {
    employee_id: string
    client_id: string
    contract_type: string
    start_date: string
    base_salary: number
    currency?: string
    pay_frequency: string
    end_date?: string
    notes?: string
  }) =>
    fetchApi<{ id: string; message: string }>('/payroll/contracts', { method: 'POST', body: data, token }),

  updateContract: (token: string, contractId: string, data: {
    contract_type?: string
    start_date?: string
    end_date?: string
    base_salary?: number
    currency?: string
    pay_frequency?: string
    is_active?: boolean
    notes?: string
  }) =>
    fetchApi<{ id: string; message: string }>(`/payroll/contracts/${contractId}`, { method: 'PATCH', body: data, token }),

  // Attendance
  getAttendance: (token: string, params?: {
    client_id?: string
    employee_id?: string
    date_from?: string
    date_to?: string
    skip?: number
    limit?: number
  }) => {
    const qp = new URLSearchParams()
    if (params?.client_id) qp.set('client_id', params.client_id)
    if (params?.employee_id) qp.set('employee_id', params.employee_id)
    if (params?.date_from) qp.set('date_from', params.date_from)
    if (params?.date_to) qp.set('date_to', params.date_to)
    if (params?.skip !== undefined) qp.set('skip', String(params.skip))
    if (params?.limit !== undefined) qp.set('limit', String(params.limit))
    const qs = qp.toString()
    return fetchApi<PayrollAttendanceRecord[]>(`/payroll/attendance${qs ? `?${qs}` : ''}`, { token })
  },

  createAttendance: (token: string, data: {
    employee_id: string
    client_id: string
    date: string
    hours: number
    attendance_type?: string
    notes?: string
  }) =>
    fetchApi<{ id: string; message: string }>('/payroll/attendance', { method: 'POST', body: data, token }),

  importAttendanceCsv: async (token: string, clientId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${API_URL}/payroll/attendance/import-csv?client_id=${clientId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new ApiError(err?.detail || 'Error al importar CSV', response.status, err)
    }
    return response.json() as Promise<AttendanceCsvPreviewResult>
  },

  confirmAttendanceCsv: (token: string, clientId: string, rows: AttendanceCsvPreviewResult['rows']) =>
    fetchApi<{ created: number; message: string }>(`/payroll/attendance/import-csv/confirm?client_id=${clientId}`, {
      method: 'POST', body: rows, token,
    }),

  // Payroll Runs
  getRuns: (token: string, params?: {
    client_id?: string
    run_status?: string
  }) => {
    const qp = new URLSearchParams()
    if (params?.client_id) qp.set('client_id', params.client_id)
    if (params?.run_status) qp.set('run_status', params.run_status)
    const qs = qp.toString()
    return fetchApi<PayrollRunItem[]>(`/payroll/runs${qs ? `?${qs}` : ''}`, { token })
  },

  createRun: (token: string, data: {
    client_id: string
    period_start: string
    period_end: string
    pay_frequency: string
    notes?: string
  }) =>
    fetchApi<PayrollRunItem>('/payroll/runs', { method: 'POST', body: data, token }),

  validateRun: (token: string, runId: string) =>
    fetchApi<{ status: string; employee_count: number; warnings: string[] }>(`/payroll/runs/${runId}/validate`, {
      method: 'POST', token,
    }),

  calculateRun: (token: string, runId: string) =>
    fetchApi<{
      status: string
      employee_count: number
      total_gross: number
      total_deductions: number
      total_net: number
    }>(`/payroll/runs/${runId}/calculate`, { method: 'POST', token }),

  approveRun: (token: string, runId: string) =>
    fetchApi<{ status: string; approved_by: string }>(`/payroll/runs/${runId}/approve`, { method: 'POST', token }),

  getRunLines: (token: string, runId: string) =>
    fetchApi<PayrollLineItem[]>(`/payroll/runs/${runId}/lines`, { token }),

  getRunPayslips: (token: string, runId: string) =>
    fetchApi<PayrollPayslip[]>(`/payroll/runs/${runId}/payslips`, { token }),

  exportRunCsv: async (token: string, runId: string) => {
    const response = await fetch(`${API_URL}/payroll/runs/${runId}/export.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new ApiError(err?.detail || 'Error al exportar CSV', response.status, err)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nomina-${runId}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },

  // Deduction Types
  getDeductionTypes: (token: string, clientId: string) =>
    fetchApi<PayrollDeductionType[]>(`/payroll/deduction-types?client_id=${clientId}`, { token }),

  createDeductionType: (token: string, data: {
    client_id: string
    name: string
    description?: string
    calc_type: string
    value: number
    is_mandatory?: boolean
  }) =>
    fetchApi<PayrollDeductionType>('/payroll/deduction-types', { method: 'POST', body: data, token }),

  // Reports
  getSummaryReport: (token: string, params: {
    client_id: string
    period_start?: string
    period_end?: string
  }) => {
    const qp = new URLSearchParams()
    qp.set('client_id', params.client_id)
    if (params.period_start) qp.set('period_start', params.period_start)
    if (params.period_end) qp.set('period_end', params.period_end)
    return fetchApi<PayrollSummary>(`/payroll/reports/summary?${qp.toString()}`, { token })
  },

  getDetailReport: (token: string, runId: string) =>
    fetchApi<PayrollDetailItem[]>(`/payroll/reports/detail?run_id=${runId}`, { token }),
}

// ── EOR Types ─────────────────────────────────────────────────

interface EOREmployee {
  id: string
  client_company_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  dui: string | null
  nit: string | null
  birth_date: string | null
  address: string | null
  isss_number: string | null
  afp_provider: string | null
  afp_number: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_account_type: string | null
  position: string | null
  department: string | null
  base_salary: number
  payment_frequency: string
  start_date: string
  end_date: string | null
  contract_type: string
  contract_end_date: string | null
  status: string
  created_at: string | null
  updated_at: string | null
}

interface EOREmployeeDetail extends EOREmployee {
  monthly_cost: {
    gross_salary: number
    total_deductions: number
    net_salary: number
    employer_contributions: number
    fee_talentos: number
    grand_total: number
  } | null
  vacation_days_available: number | null
  vacation_days_used: number | null
}

interface EORPayrollRun {
  id: string
  client_company_id: string
  period_start: string
  period_end: string
  payment_date: string | null
  status: string
  total_employees: number
  total_gross: number
  total_deductions: number
  total_net: number
  total_employer_contributions: number
  total_fees: number
  grand_total: number
  created_at: string | null
  approved_at: string | null
  paid_at: string | null
  items?: EORPayrollItem[]
}

interface EORPayrollItem {
  id: string
  employee_id: string
  employee_name: string | null
  base_salary: number
  overtime_amount: number
  bonuses: number
  gross_salary: number
  isss_employee: number
  afp_employee: number
  isr: number
  other_deductions: number
  total_deductions: number
  net_salary: number
  isss_employer: number
  afp_employer: number
  fee_talentos: number
  total_employer_cost: number
}

interface EORVacationRequest {
  id: string
  employee_id: string
  employee_name: string | null
  start_date: string
  end_date: string
  days_requested: number
  reason: string | null
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string | null
}

interface EORPayslip {
  item_id: string
  period_start: string
  period_end: string
  gross_salary: number
  total_deductions: number
  net_salary: number
  payment_date: string | null
  status: string
}

interface EORCalculatorResult {
  salary_type: string
  salario_bruto: number
  isss_empleado: number
  afp_empleado: number
  isr: number
  total_deducciones: number
  salario_neto: number
  isss_patronal: number
  afp_patronal: number
  subtotal_empleador: number
  fee_talentos: number
  costo_total_mensual: number
}

// ── EOR API ───────────────────────────────────────────────────

export const eorApi = {
  // Employees
  createEmployee: (token: string, data: Record<string, unknown>) =>
    fetchApi<EOREmployee>('/eor/employees', { method: 'POST', body: data, token }),

  listEmployees: (token: string, params?: {
    status?: string
    client_company_id?: string
    search?: string
  }) => {
    const qp = new URLSearchParams()
    if (params?.status) qp.set('status', params.status)
    if (params?.client_company_id) qp.set('client_company_id', params.client_company_id)
    if (params?.search) qp.set('search', params.search)
    const qs = qp.toString()
    return fetchApi<EOREmployee[]>(`/eor/employees${qs ? `?${qs}` : ''}`, { token })
  },

  getEmployee: (token: string, id: string) =>
    fetchApi<EOREmployeeDetail>(`/eor/employees/${id}`, { token }),

  updateEmployee: (token: string, id: string, data: Record<string, unknown>) =>
    fetchApi<EOREmployee>(`/eor/employees/${id}`, { method: 'PUT', body: data, token }),

  terminateEmployee: (token: string, id: string, data: {
    termination_date: string
    reason: string
    with_cause: boolean
  }) =>
    fetchApi<{ employee_id: string; total_liquidacion: number; message: string }>(
      `/eor/employees/${id}/terminate`, { method: 'POST', body: data, token }
    ),

  // Payroll
  simulatePayroll: (token: string, data: {
    salario_base: number
    horas_extra?: number
    bonificaciones?: number
    otras_deducciones?: number
  }) =>
    fetchApi<EORPayrollItem>('/eor/payroll/simulate', { method: 'POST', body: data, token }),

  createPayrollRun: (token: string, data: {
    client_company_id: string
    period_start: string
    period_end: string
    payment_date?: string
    employee_ids?: string[]
  }) =>
    fetchApi<EORPayrollRun>('/eor/payroll/runs', { method: 'POST', body: data, token }),

  listPayrollRuns: (token: string, params?: { status?: string; client_company_id?: string }) => {
    const qp = new URLSearchParams()
    if (params?.status) qp.set('status', params.status)
    if (params?.client_company_id) qp.set('client_company_id', params.client_company_id)
    const qs = qp.toString()
    return fetchApi<EORPayrollRun[]>(`/eor/payroll/runs${qs ? `?${qs}` : ''}`, { token })
  },

  getPayrollRun: (token: string, runId: string) =>
    fetchApi<EORPayrollRun>(`/eor/payroll/runs/${runId}`, { token }),

  approvePayrollRun: (token: string, runId: string) =>
    fetchApi<{ success: boolean }>(`/eor/payroll/runs/${runId}/approve`, { method: 'POST', token }),

  markPayrollPaid: (token: string, runId: string, paymentDate: string) =>
    fetchApi<{ success: boolean }>(
      `/eor/payroll/runs/${runId}/mark-paid?payment_date=${paymentDate}`, { method: 'POST', token }
    ),

  // Documents
  getEmployeePayslips: (token: string, employeeId: string) =>
    fetchApi<EORPayslip[]>(`/eor/employees/${employeeId}/payslips`, { token }),

  // Vacations
  createVacationRequest: (token: string, data: {
    employee_id: string
    start_date: string
    end_date: string
    days_requested: number
    reason?: string
  }) =>
    fetchApi<EORVacationRequest>('/eor/vacation-requests', { method: 'POST', body: data, token }),

  listVacationRequests: (token: string, params?: { status?: string; employee_id?: string }) => {
    const qp = new URLSearchParams()
    if (params?.status) qp.set('status', params.status)
    if (params?.employee_id) qp.set('employee_id', params.employee_id)
    const qs = qp.toString()
    return fetchApi<EORVacationRequest[]>(`/eor/vacation-requests${qs ? `?${qs}` : ''}`, { token })
  },

  approveVacation: (token: string, requestId: string) =>
    fetchApi<{ success: boolean }>(`/eor/vacation-requests/${requestId}/approve`, { method: 'POST', token }),

  rejectVacation: (token: string, requestId: string, reason: string) =>
    fetchApi<{ success: boolean }>(
      `/eor/vacation-requests/${requestId}/reject?reason=${encodeURIComponent(reason)}`,
      { method: 'POST', token }
    ),

  // Public Calculator
  calculate: (salary: number, salaryType: string = 'gross') =>
    fetchApi<EORCalculatorResult>(`/eor/calculator?salary=${salary}&salary_type=${salaryType}`),
}

// ── Billing Types ─────────────────────────────────────────────

interface BillingPlan {
  id: string
  name: string
  tier: string
  description: string | null
  price_monthly: number
  price_annual: number
  currency: string
  is_active: boolean
  limits: Record<string, number>
  features: string[]
  created_at: string
}

interface BillingSubscription {
  id: string
  company_id: string
  plan_id: string
  plan: BillingPlan
  status: string
  is_annual: boolean
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  canceled_at: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

interface BillingInvoice {
  id: string
  subscription_id: string
  company_id: string
  amount: number
  currency: string
  status: string
  period_start: string | null
  period_end: string | null
  paid_at: string | null
  description: string | null
  created_at: string
}

interface UsageCheck {
  feature: string
  has_access: boolean
  plan_tier: string
  message: string | null
}

interface LimitCheck {
  limit_type: string
  current_usage: number
  max_allowed: number
  has_capacity: boolean
  plan_tier: string
}

// ── Billing API ───────────────────────────────────────────────

export const billingApi = {
  getPlans: () =>
    fetchApi<BillingPlan[]>('/billing/plans'),

  getSubscription: (token: string) =>
    fetchApi<BillingSubscription | null>('/billing/subscription', { token }),

  subscribe: (token: string, data: { plan_id: string; is_annual?: boolean }) =>
    fetchApi<BillingSubscription>('/billing/subscribe', {
      method: 'POST',
      body: data,
      token,
    }),

  upgrade: (token: string, data: { new_plan_id: string; is_annual?: boolean }) =>
    fetchApi<BillingSubscription>('/billing/upgrade', {
      method: 'POST',
      body: data,
      token,
    }),

  cancel: (token: string, data: { cancel_at_period_end?: boolean; reason?: string }) =>
    fetchApi<BillingSubscription>('/billing/cancel', {
      method: 'POST',
      body: data,
      token,
    }),

  getInvoices: (token: string, limit?: number) =>
    fetchApi<BillingInvoice[]>(`/billing/invoices${limit ? `?limit=${limit}` : ''}`, { token }),

  checkFeature: (token: string, feature: string) =>
    fetchApi<UsageCheck>(`/billing/check-feature?feature=${encodeURIComponent(feature)}`, { token }),

  checkLimit: (token: string, limitType: string, currentCount: number) =>
    fetchApi<LimitCheck>(
      `/billing/check-limit?limit_type=${encodeURIComponent(limitType)}&current_count=${currentCount}`,
      { token }
    ),
}

// Matching API
export interface MatchResult {
  candidate_id: string
  job_id: string
  overall_score: number
  semantic_score: number
  skills_score: number
  candidate_name: string | null
  job_title: string | null
  matched_skills: string[]
  missing_skills: string[]
  metadata: Record<string, unknown>
}

export interface SavedMatch {
  id: string
  candidate_id: string
  job_id: string
  overall_score: number
  semantic_score: number
  skills_score: number
  status: string
  match_metadata: Record<string, unknown> | null
  recruiter_notes: string | null
  reviewed_at: string | null
  created_at: string
}

export const matchingApi = {
  getCandidatesForJob: (token: string, jobId: string, params?: { min_score?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.min_score) qs.set('min_score', String(params.min_score))
    if (params?.limit) qs.set('limit', String(params.limit))
    const query = qs.toString()
    return fetchApi<MatchResult[]>(`/matching/candidates-for-job/${jobId}${query ? `?${query}` : ''}`, { token })
  },

  getJobsForCandidate: (token: string, candidateId: string, params?: { min_score?: number; limit?: number; modality?: string }) => {
    const qs = new URLSearchParams()
    if (params?.min_score) qs.set('min_score', String(params.min_score))
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.modality) qs.set('modality', params.modality)
    const query = qs.toString()
    return fetchApi<MatchResult[]>(`/matching/jobs-for-candidate/${candidateId}${query ? `?${query}` : ''}`, { token })
  },

  getMatchScore: (token: string, candidateId: string, jobId: string) =>
    fetchApi<MatchResult>(`/matching/score/${candidateId}/${jobId}`, { token }),

  saveMatch: (token: string, data: { candidate_id: string; job_id: string; overall_score: number; semantic_score?: number; skills_score?: number }) =>
    fetchApi<{ id: string; candidate_id: string; job_id: string; overall_score: number; status: string; created_at: string }>(
      '/matching/save', { method: 'POST', body: data, token }
    ),

  updateMatchStatus: (token: string, matchId: string, data: { status: string; recruiter_notes?: string }) =>
    fetchApi<{ id: string; status: string; recruiter_notes: string | null; reviewed_at: string }>(
      `/matching/status/${matchId}`, { method: 'PATCH', body: data, token }
    ),

  getMatchesForJob: (token: string, jobId: string, status?: string) => {
    const qs = status ? `?status=${status}` : ''
    return fetchApi<SavedMatch[]>(`/matching/job/${jobId}/matches${qs}`, { token })
  },

  getMatchesForCandidate: (token: string, candidateId: string, status?: string) => {
    const qs = status ? `?status=${status}` : ''
    return fetchApi<SavedMatch[]>(`/matching/candidate/${candidateId}/matches${qs}`, { token })
  },
}

export type {
  EOREmployee, EOREmployeeDetail, EORPayrollRun, EORPayrollItem,
  EORVacationRequest, EORPayslip, EORCalculatorResult,
  BillingPlan, BillingSubscription, BillingInvoice, UsageCheck, LimitCheck,
}

export { ApiError }
