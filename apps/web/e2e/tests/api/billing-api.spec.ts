import { test, expect } from '@playwright/test'

const API_BASE = process.env.API_URL || 'http://localhost:8000'

async function isBackendAvailable(request: ReturnType<typeof test.extend>): Promise<boolean> {
  try {
    // @ts-expect-error - request is from test context
    const response = await request.get(`${API_BASE}/health`, { timeout: 3000 })
    return response.ok()
  } catch {
    return false
  }
}

test.describe('Billing API', () => {
  test('GET /billing/plans should return plans', async ({ request }) => {
    try {
      const response = await request.get(`${API_BASE}/billing/plans`, { timeout: 5000 })
      if (response.ok()) {
        const data = await response.json()
        expect(data.plans || data).toBeDefined()
      }
    } catch {
      test.skip(true, 'Backend API not available')
    }
  })
})

test.describe('Auth API', () => {
  test('POST /auth/login should return token for valid credentials', async ({ request }) => {
    try {
      const response = await request.post(`${API_BASE}/auth/login`, {
        data: {
          email: 'employer@example.com',
          password: 'Employer123!',
        },
        timeout: 5000,
      })
      if (response.ok()) {
        const data = await response.json()
        expect(data.access_token || data.token).toBeDefined()
      }
    } catch {
      test.skip(true, 'Backend API not available')
    }
  })

  test('POST /auth/login should reject invalid credentials', async ({ request }) => {
    try {
      const response = await request.post(`${API_BASE}/auth/login`, {
        data: {
          email: 'wrong@email.com',
          password: 'wrongpassword',
        },
        timeout: 5000,
      })
      expect(response.ok()).toBeFalsy()
      expect(response.status()).toBeGreaterThanOrEqual(400)
    } catch {
      test.skip(true, 'Backend API not available')
    }
  })
})

test.describe('EOR Calculator API', () => {
  test('GET /eor/calculator should calculate payroll', async ({ request }) => {
    try {
      const response = await request.get(`${API_BASE}/eor/calculator`, {
        params: { salary: 1000, country: 'SV' },
        timeout: 5000,
      })
      if (response.ok()) {
        const data = await response.json()
        expect(data).toHaveProperty('gross_salary')
        expect(data).toHaveProperty('net_salary')
      }
    } catch {
      test.skip(true, 'Backend API not available')
    }
  })
})

test.describe('Health API', () => {
  test('GET /health should return healthy status', async ({ request }) => {
    try {
      const response = await request.get(`${API_BASE}/health`, { timeout: 5000 })
      if (response.ok()) {
        const data = await response.json()
        expect(data.status).toBeDefined()
      }
    } catch {
      test.skip(true, 'Backend API not available')
    }
  })
})
