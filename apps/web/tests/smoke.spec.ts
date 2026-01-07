import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('should show landing page without login', async ({ page }) => {
    await page.goto('/')

    // Check hero section
    await expect(page.getByRole('heading', { name: /reclutamiento inteligente/i })).toBeVisible()
    await expect(page.getByText(/TalentOS automatiza/i)).toBeVisible()

    // Check CTA buttons
    await expect(page.getByRole('link', { name: /solicitar demo/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /iniciar sesion/i }).first()).toBeVisible()
  })

  test('should show how it works section', async ({ page }) => {
    await page.goto('/')

    // Check sections exist
    await expect(page.getByText(/como funciona/i).first()).toBeVisible()
    await expect(page.getByText(/CV Parsing con IA/i)).toBeVisible()
    await expect(page.getByText(/Entrevista con IA/i)).toBeVisible()
    await expect(page.getByText(/Ranking/i)).toBeVisible()
  })

  test('should show pricing plans', async ({ page }) => {
    await page.goto('/')

    // Check pricing section
    await expect(page.getByText(/Planes y servicios/i)).toBeVisible()
    await expect(page.getByText(/Piloto/i)).toBeVisible()
    await expect(page.getByText(/Empresa/i).first()).toBeVisible()
    await expect(page.getByText(/Enterprise/i)).toBeVisible()
  })

  test('should show contact form', async ({ page }) => {
    await page.goto('/')

    // Check contact form
    await expect(page.getByText(/Solicita una demo/i)).toBeVisible()
    await expect(page.getByLabel(/Nombre/i)).toBeVisible()
    await expect(page.getByLabel(/Email/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Enviar solicitud/i })).toBeVisible()
  })

  test('should navigate to login from landing', async ({ page }) => {
    await page.goto('/')

    // Click login link
    await page.getByRole('link', { name: /iniciar sesion/i }).first().click()

    // Should be on login page
    await expect(page).toHaveURL('/login')
  })
})

test.describe('Login Page', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login')

    // Check page title
    await expect(page).toHaveTitle(/TalentOS/)

    // Check login form elements
    await expect(page.getByLabel(/correo/i)).toBeVisible()
    await expect(page.getByLabel(/contraseña/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible()
  })

  test('should show register link on login page', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('link', { name: /regístrate/i })).toBeVisible()
  })

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('link', { name: /regístrate/i }).click()

    await expect(page).toHaveURL('/register')
    await expect(page.getByRole('heading', { name: /crear cuenta/i })).toBeVisible()
  })

  test('should show validation errors on empty login', async ({ page }) => {
    await page.goto('/login')

    // Try to submit empty form
    await page.getByRole('button', { name: /ingresar/i }).click()

    // Browser should show validation (required fields)
    const emailInput = page.getByLabel(/correo/i)
    await expect(emailInput).toHaveAttribute('required', '')
  })

  test('should show test credentials info', async ({ page }) => {
    await page.goto('/login')

    // Check that test credentials are shown
    await expect(page.getByText(/admin@example.com/i)).toBeVisible()
    await expect(page.getByText(/candidate1@example.com/i)).toBeVisible()
  })
})

test.describe('Navigation Tests', () => {
  test('should redirect to login when accessing protected routes without auth', async ({ page }) => {
    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })

  test('should redirect to login for candidate routes', async ({ page }) => {
    await page.goto('/candidate/profile')

    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })

  test('should redirect to login for employer routes', async ({ page }) => {
    await page.goto('/employer/jobs')

    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })

  test('should redirect to login for admin routes', async ({ page }) => {
    await page.goto('/admin/rubrics')

    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })
})

test.describe('Register Page', () => {
  test('should show role selection', async ({ page }) => {
    await page.goto('/register')

    await expect(page.getByLabel(/tipo de cuenta/i)).toBeVisible()
  })

  test('should show company field for employer role', async ({ page }) => {
    await page.goto('/register')

    // Select employer role
    await page.getByLabel(/tipo de cuenta/i).click()
    await page.getByRole('option', { name: /empresa/i }).click()

    // Company field should appear
    await expect(page.getByLabel(/nombre de la empresa/i)).toBeVisible()
  })
})

// Login tests for each role (requires backend to be running with seeded data)
test.describe('Authentication - All Roles', () => {
  const testUsers = [
    { email: 'admin@example.com', password: 'Admin123!', role: 'ADMIN' },
    { email: 'recruiter@example.com', password: 'Recruiter123!', role: 'RECRUITER' },
    { email: 'employer@example.com', password: 'Employer123!', role: 'EMPLOYER' },
    { email: 'candidate1@example.com', password: 'Candidate123!', role: 'CANDIDATE' },
    { email: 'candidate2@example.com', password: 'Candidate123!', role: 'CANDIDATE' },
    { email: 'candidate3@example.com', password: 'Candidate123!', role: 'CANDIDATE' },
  ]

  for (const user of testUsers) {
    test(`should login with ${user.email}`, async ({ page }) => {
      await page.goto('/login')

      // Fill in credentials
      await page.getByLabel(/correo/i).fill(user.email)
      await page.getByLabel(/contraseña/i).fill(user.password)

      // Submit form
      await page.getByRole('button', { name: /ingresar/i }).click()

      // Should redirect to dashboard or role-specific page
      await page.waitForURL(/\/(dashboard|candidate|employer|admin)/)

      // Should not be on login page anymore
      expect(page.url()).not.toContain('/login')
    })
  }
})

// Candidate flow tests
test.describe('Candidate Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as candidate
    await page.goto('/login')
    await page.getByLabel(/correo/i).fill('candidate1@example.com')
    await page.getByLabel(/contraseña/i).fill('Candidate123!')
    await page.getByRole('button', { name: /ingresar/i }).click()
    await page.waitForURL(/\/(dashboard|candidate)/)
  })

  test('should access candidate profile', async ({ page }) => {
    await page.goto('/candidate/profile')

    // Should see profile page
    await expect(page.getByText(/perfil/i)).toBeVisible()
  })

  test('should access resume upload page', async ({ page }) => {
    await page.goto('/candidate/resume')

    // Should see upload page
    await expect(page.getByText(/subir cv/i)).toBeVisible()
    await expect(page.getByText(/arrastra/i)).toBeVisible()
  })

  test('should access interview page', async ({ page }) => {
    await page.goto('/candidate/interview')

    // Should see interview page
    await expect(page.getByText(/entrevista/i).first()).toBeVisible()
  })
})

// Employer flow tests
test.describe('Employer Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as employer
    await page.goto('/login')
    await page.getByLabel(/correo/i).fill('employer@example.com')
    await page.getByLabel(/contraseña/i).fill('Employer123!')
    await page.getByRole('button', { name: /ingresar/i }).click()
    await page.waitForURL(/\/(dashboard|employer)/)
  })

  test('should access jobs list', async ({ page }) => {
    await page.goto('/employer/jobs')

    // Should see jobs page
    await expect(page.getByText(/vacantes|jobs|posiciones/i)).toBeVisible()
  })

  test('should access create job page', async ({ page }) => {
    await page.goto('/employer/jobs/new')

    // Should see create job form
    await expect(page.getByText(/nueva|crear/i).first()).toBeVisible()
  })
})

// Admin flow tests
test.describe('Admin Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.getByLabel(/correo/i).fill('admin@example.com')
    await page.getByLabel(/contraseña/i).fill('Admin123!')
    await page.getByRole('button', { name: /ingresar/i }).click()
    await page.waitForURL(/\/(dashboard|admin)/)
  })

  test('should access rubrics page', async ({ page }) => {
    await page.goto('/admin/rubrics')

    // Should see rubrics page
    await expect(page.getByText(/rúbricas|rubricas/i)).toBeVisible()
  })

  test('should access KPIs dashboard', async ({ page }) => {
    await page.goto('/admin/kpis')

    // Should see KPIs page
    await expect(page.getByText(/kpi|dashboard|metricas/i)).toBeVisible()
  })
})
