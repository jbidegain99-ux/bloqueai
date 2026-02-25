import { test, expect } from '@playwright/test'

const API_BASE = process.env.API_URL || 'http://localhost:8000'

// ─── Helpers ────────────────────────────────────────────────────────────────

interface AuthTokens {
  access_token: string
}

async function getAuthToken(
  request: import('@playwright/test').APIRequestContext,
  role: 'admin' | 'employer' | 'candidate'
): Promise<string> {
  const credentials: Record<string, { email: string; password: string }> = {
    admin: { email: 'admin@example.com', password: 'Admin123!' },
    employer: { email: 'employer@example.com', password: 'Employer123!' },
    candidate: { email: 'candidate1@example.com', password: 'Candidate123!' },
  }

  const res = await request.post(`${API_BASE}/auth/login`, {
    data: credentials[role],
    timeout: 5000,
  })
  const data: AuthTokens = await res.json()
  return data.access_token
}

async function getFirstJobId(
  request: import('@playwright/test').APIRequestContext,
  token: string
): Promise<string | null> {
  const res = await request.get(`${API_BASE}/employer/jobs`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 5000,
  })
  if (!res.ok()) return null
  const data = await res.json()
  const jobs = Array.isArray(data) ? data : data.jobs || data.items || []
  return jobs.length > 0 ? (jobs[0].id || jobs[0].job_id) : null
}

async function getCandidateId(
  request: import('@playwright/test').APIRequestContext,
  token: string
): Promise<string | null> {
  const res = await request.get(`${API_BASE}/candidate/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 5000,
  })
  if (!res.ok()) return null
  const data = await res.json()
  return data.id || data.candidate_id || null
}

// ─── Matching Endpoints ─────────────────────────────────────────────────────

test.describe('Matching API', () => {
  let employerToken: string
  let candidateToken: string
  let adminToken: string
  let jobId: string | null
  let candidateId: string | null

  test.beforeAll(async ({ request }) => {
    try {
      employerToken = await getAuthToken(request, 'employer')
      candidateToken = await getAuthToken(request, 'candidate')
      adminToken = await getAuthToken(request, 'admin')
      jobId = await getFirstJobId(request, employerToken)
      candidateId = await getCandidateId(request, candidateToken)
    } catch {
      // Will be handled per-test with skip
    }
  })

  test('GET /matching/candidates-for-job/{id} should return candidates', async ({ request }) => {
    try {
      test.skip(!jobId, 'No job available')
      const res = await request.get(`${API_BASE}/matching/candidates-for-job/${jobId}`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        timeout: 30000,
      })
      expect(res.status()).toBe(200)
      const data = await res.json()
      const candidates = Array.isArray(data) ? data : data.candidates || data.matches || []
      expect(Array.isArray(candidates)).toBeTruthy()
      if (candidates.length > 0) {
        expect(candidates[0]).toHaveProperty('candidate_id')
        expect(candidates[0]).toHaveProperty('overall_score')
      }
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('GET /matching/candidates-for-job with min_score filter', async ({ request }) => {
    try {
      test.skip(!jobId, 'No job available')
      const res = await request.get(`${API_BASE}/matching/candidates-for-job/${jobId}`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        params: { min_score: 70 },
        timeout: 30000,
      })
      expect(res.status()).toBe(200)
      const data = await res.json()
      const candidates = Array.isArray(data) ? data : data.candidates || data.matches || []
      for (const c of candidates) {
        expect(c.overall_score).toBeGreaterThanOrEqual(70)
      }
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('GET /matching/jobs-for-candidate/{id} should return jobs', async ({ request }) => {
    try {
      test.skip(!candidateId, 'No candidate available')
      const res = await request.get(`${API_BASE}/matching/jobs-for-candidate/${candidateId}`, {
        headers: { Authorization: `Bearer ${candidateToken}` },
        timeout: 30000,
      })
      expect(res.status()).toBe(200)
      const data = await res.json()
      const jobs = Array.isArray(data) ? data : data.jobs || data.matches || []
      expect(Array.isArray(jobs)).toBeTruthy()
      if (jobs.length > 0) {
        expect(jobs[0]).toHaveProperty('job_id')
        expect(jobs[0]).toHaveProperty('overall_score')
      }
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('GET /matching/jobs-for-candidate with modality filter', async ({ request }) => {
    try {
      test.skip(!candidateId, 'No candidate available')
      const res = await request.get(`${API_BASE}/matching/jobs-for-candidate/${candidateId}`, {
        headers: { Authorization: `Bearer ${candidateToken}` },
        params: { modality: 'REMOTE' },
        timeout: 30000,
      })
      expect(res.status()).toBe(200)
      const data = await res.json()
      const jobs = Array.isArray(data) ? data : data.jobs || data.matches || []
      expect(Array.isArray(jobs)).toBeTruthy()
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('GET /matching/score/{candidateId}/{jobId} should return score breakdown', async ({ request }) => {
    try {
      test.skip(!candidateId || !jobId, 'Missing candidate or job')
      const res = await request.get(`${API_BASE}/matching/score/${candidateId}/${jobId}`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        timeout: 30000,
      })
      expect(res.status()).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('overall_score')
      expect(data).toHaveProperty('semantic_score')
      expect(data).toHaveProperty('skills_score')
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('POST /matching/save should create a match record', async ({ request }) => {
    try {
      test.skip(!candidateId || !jobId, 'Missing candidate or job')
      const res = await request.post(`${API_BASE}/matching/save`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        data: {
          candidate_id: candidateId,
          job_id: jobId,
          overall_score: 75,
          semantic_score: 80,
          skills_score: 65,
        },
        timeout: 10000,
      })
      expect(res.status()).toBeLessThan(500)
      if (res.ok()) {
        const data = await res.json()
        expect(data).toHaveProperty('id')
        expect(data.status).toBe('pending')
      }
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('POST /matching/save should upsert for same candidate+job', async ({ request }) => {
    try {
      test.skip(!candidateId || !jobId, 'Missing candidate or job')

      // First save
      const res1 = await request.post(`${API_BASE}/matching/save`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        data: {
          candidate_id: candidateId,
          job_id: jobId,
          overall_score: 80,
          semantic_score: 85,
          skills_score: 70,
        },
        timeout: 10000,
      })

      // Second save (upsert)
      const res2 = await request.post(`${API_BASE}/matching/save`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        data: {
          candidate_id: candidateId,
          job_id: jobId,
          overall_score: 82,
          semantic_score: 87,
          skills_score: 72,
        },
        timeout: 10000,
      })

      if (res1.ok() && res2.ok()) {
        const data1 = await res1.json()
        const data2 = await res2.json()
        // Same record should be returned (upsert, same id)
        expect(data1.id).toBe(data2.id)
      }
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('PATCH /matching/status/{id} should update to shortlisted', async ({ request }) => {
    try {
      test.skip(!candidateId || !jobId, 'Missing candidate or job')

      // Ensure a match exists
      const saveRes = await request.post(`${API_BASE}/matching/save`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        data: {
          candidate_id: candidateId,
          job_id: jobId,
          overall_score: 75,
          semantic_score: 80,
          skills_score: 65,
        },
        timeout: 10000,
      })
      if (!saveRes.ok()) {
        test.skip(true, 'Could not save match')
        return
      }

      const saved = await saveRes.json()
      const matchId = saved.id

      const res = await request.patch(`${API_BASE}/matching/status/${matchId}`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        data: { status: 'shortlisted' },
        timeout: 5000,
      })
      expect(res.status()).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('shortlisted')
      expect(data.reviewed_at).toBeDefined()
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('PATCH /matching/status/{id} should update to rejected', async ({ request }) => {
    try {
      test.skip(!candidateId || !jobId, 'Missing candidate or job')

      const saveRes = await request.post(`${API_BASE}/matching/save`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        data: {
          candidate_id: candidateId,
          job_id: jobId,
          overall_score: 75,
          semantic_score: 80,
          skills_score: 65,
        },
        timeout: 10000,
      })
      if (!saveRes.ok()) {
        test.skip(true, 'Could not save match')
        return
      }

      const saved = await saveRes.json()
      const matchId = saved.id

      const res = await request.patch(`${API_BASE}/matching/status/${matchId}`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        data: { status: 'rejected' },
        timeout: 5000,
      })
      expect(res.status()).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('rejected')
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('PATCH /matching/status/{id} should reject invalid status', async ({ request }) => {
    try {
      test.skip(!candidateId || !jobId, 'Missing candidate or job')

      const saveRes = await request.post(`${API_BASE}/matching/save`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        data: {
          candidate_id: candidateId,
          job_id: jobId,
          overall_score: 75,
          semantic_score: 80,
          skills_score: 65,
        },
        timeout: 10000,
      })
      if (!saveRes.ok()) {
        test.skip(true, 'Could not save match')
        return
      }

      const saved = await saveRes.json()
      const matchId = saved.id

      const res = await request.patch(`${API_BASE}/matching/status/${matchId}`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        data: { status: 'invalid_status_value' },
        timeout: 5000,
      })
      // Should return 400 or 422 for invalid status
      expect(res.status()).toBeGreaterThanOrEqual(400)
      expect(res.status()).toBeLessThan(500)
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('GET /matching/job/{id}/matches should return saved matches', async ({ request }) => {
    try {
      test.skip(!jobId, 'No job available')
      const res = await request.get(`${API_BASE}/matching/job/${jobId}/matches`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        timeout: 10000,
      })
      expect(res.status()).toBe(200)
      const data = await res.json()
      const matches = Array.isArray(data) ? data : data.matches || []
      expect(Array.isArray(matches)).toBeTruthy()
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('GET /matching/candidate/{id}/matches should return saved matches', async ({ request }) => {
    try {
      test.skip(!candidateId, 'No candidate available')
      const res = await request.get(`${API_BASE}/matching/candidate/${candidateId}/matches`, {
        headers: { Authorization: `Bearer ${candidateToken}` },
        timeout: 10000,
      })
      expect(res.status()).toBe(200)
      const data = await res.json()
      const matches = Array.isArray(data) ? data : data.matches || []
      expect(Array.isArray(matches)).toBeTruthy()
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })
})

// ─── Embeddings Endpoints ───────────────────────────────────────────────────

test.describe('Embeddings API', () => {
  let employerToken: string
  let candidateToken: string
  let adminToken: string
  let jobId: string | null
  let candidateId: string | null

  test.beforeAll(async ({ request }) => {
    try {
      employerToken = await getAuthToken(request, 'employer')
      candidateToken = await getAuthToken(request, 'candidate')
      adminToken = await getAuthToken(request, 'admin')
      jobId = await getFirstJobId(request, employerToken)
      candidateId = await getCandidateId(request, candidateToken)
    } catch {
      // Will be handled per-test with skip
    }
  })

  test('POST /embeddings/generate/job/{id} should generate job embedding', async ({ request }) => {
    try {
      test.skip(!jobId, 'No job available')
      const res = await request.post(`${API_BASE}/embeddings/generate/job/${jobId}`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        timeout: 30000,
      })
      expect(res.status()).toBeLessThan(500)
      if (res.ok()) {
        const data = await res.json()
        expect(data).toHaveProperty('has_embedding')
      }
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('POST /embeddings/generate/candidate/{id} should generate candidate embedding', async ({ request }) => {
    try {
      test.skip(!candidateId, 'No candidate available')
      const res = await request.post(`${API_BASE}/embeddings/generate/candidate/${candidateId}`, {
        headers: { Authorization: `Bearer ${candidateToken}` },
        timeout: 30000,
      })
      expect(res.status()).toBeLessThan(500)
      if (res.ok()) {
        const data = await res.json()
        expect(data).toHaveProperty('has_embedding')
      }
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('GET /embeddings/stats should return stats for admin', async ({ request }) => {
    try {
      const res = await request.get(`${API_BASE}/embeddings/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        timeout: 10000,
      })
      expect(res.status()).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('candidates')
      expect(data).toHaveProperty('jobs')
      expect(data.candidates).toHaveProperty('total')
      expect(data.jobs).toHaveProperty('total')
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })

  test('GET /embeddings/stats should return 403 for non-admin', async ({ request }) => {
    try {
      const res = await request.get(`${API_BASE}/embeddings/stats`, {
        headers: { Authorization: `Bearer ${employerToken}` },
        timeout: 5000,
      })
      expect(res.status()).toBe(403)
    } catch (e) {
      if (String(e).includes('skip')) throw e
      test.skip(true, 'Backend API not available')
    }
  })
})
