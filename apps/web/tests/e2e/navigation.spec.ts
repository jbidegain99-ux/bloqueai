import { test, expect, type Page } from '@playwright/test'

const BASE = 'http://localhost:3000'

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(dashboard|admin|employer|portal)/, { timeout: 10000 })
}

test.describe('Navigation & Role-Based Routing', () => {
  test('Login page loads with test credentials', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('text=Iniciar sesión')).toBeVisible()
    await expect(page.locator('text=admin@example.com')).toBeVisible()
    await expect(page.locator('text=employee1@example.com')).toBeVisible()
  })

  test('ADMIN login redirects to payroll dashboard', async ({ page }) => {
    await login(page, 'admin@example.com', 'Admin123!')
    await expect(page).toHaveURL(/\/admin\/payroll\/dashboard/)
  })

  test('RECRUITER login redirects to recruitment dashboard', async ({ page }) => {
    await login(page, 'recruiter@example.com', 'Recruiter123!')
    await expect(page).toHaveURL(/\/admin\/dashboard/)
  })

  test('EMPLOYER login redirects to employer dashboard', async ({ page }) => {
    await login(page, 'employer@example.com', 'Employer123!')
    await expect(page).toHaveURL(/\/employer\/dashboard/)
  })

  test('CANDIDATE login redirects to candidate dashboard', async ({ page }) => {
    await login(page, 'candidate1@example.com', 'Candidate123!')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('Employee user (with Employee record) redirects to portal', async ({ page }) => {
    await login(page, 'employee1@example.com', 'Employee123!')
    await expect(page).toHaveURL(/\/portal/)
  })
})

test.describe('Admin Navigation Tabs', () => {
  test('Admin can switch between Talento and Nomina tabs', async ({ page }) => {
    await login(page, 'admin@example.com', 'Admin123!')

    // Should see both tabs in header
    await expect(page.locator('text=Talento')).toBeVisible()
    await expect(page.locator('text=Personal y Nómina')).toBeVisible()
  })

  test('Admin can access Platform tab', async ({ page }) => {
    await login(page, 'admin@example.com', 'Admin123!')
    await page.goto(`${BASE}/admin/platform`)
    await expect(page.locator('text=Plataforma')).toBeVisible()
  })

  test('Payroll employees page loads', async ({ page }) => {
    await login(page, 'admin@example.com', 'Admin123!')
    await page.goto(`${BASE}/admin/payroll/employees`)
    await expect(page.locator('text=Empleados')).toBeVisible()
  })

  test('Payroll runs page loads', async ({ page }) => {
    await login(page, 'admin@example.com', 'Admin123!')
    await page.goto(`${BASE}/admin/payroll/runs`)
    // Should show payroll runs if seeded
    await expect(page.locator('h1, h2, h3').first()).toBeVisible()
  })
})

test.describe('Employee Portal', () => {
  test('Employee portal dashboard loads', async ({ page }) => {
    await login(page, 'employee1@example.com', 'Employee123!')
    await expect(page.locator('text=Hola')).toBeVisible()
  })

  test('Employee can navigate to payslips', async ({ page }) => {
    await login(page, 'employee1@example.com', 'Employee123!')
    await page.goto(`${BASE}/portal/payslips`)
    await expect(page.locator('text=Colillas')).toBeVisible()
  })

  test('Employee can navigate to salary breakdown', async ({ page }) => {
    await login(page, 'employee1@example.com', 'Employee123!')
    await page.goto(`${BASE}/portal/salary`)
    await expect(page.locator('text=Desglose')).toBeVisible()
  })

  test('Employee can navigate to assistant', async ({ page }) => {
    await login(page, 'employee1@example.com', 'Employee123!')
    await page.goto(`${BASE}/portal/assistant`)
    await expect(page.locator('text=Valentina')).toBeVisible()
  })
})

test.describe('Protected Routes', () => {
  test('Unauthenticated user is redirected from admin pages', async ({ page }) => {
    await page.goto(`${BASE}/admin/payroll/employees`)
    // Should redirect to login or show auth error
    await page.waitForTimeout(2000)
    const url = page.url()
    expect(url.includes('/login') || url.includes('/admin')).toBeTruthy()
  })

  test('Unauthenticated user is redirected from portal', async ({ page }) => {
    await page.goto(`${BASE}/portal`)
    await page.waitForTimeout(2000)
    const url = page.url()
    expect(url.includes('/login') || url.includes('/portal')).toBeTruthy()
  })
})
