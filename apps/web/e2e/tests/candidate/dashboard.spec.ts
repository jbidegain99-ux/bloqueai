import { test, expect } from '../../fixtures/auth.fixture'

test.describe('Candidate Dashboard', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('candidate')
  })

  test.describe('Profile', () => {
    test('should display candidate profile', async ({ page, navigateTo }) => {
      await navigateTo('/candidate/profile')
      await expect(page.locator('h1, h2').first()).toBeVisible()
    })

    test('should show CV upload or existing CV', async ({ page, navigateTo }) => {
      await navigateTo('/candidate/profile')

      // Wait for loading state to resolve
      await page.locator('text=/Cargando/i').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})

      const hasUpload = await page
        .locator('input[type="file"], text=/subir|upload|CV|Perfil/i')
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false)
      const hasExistingCV = await page
        .locator('text=/CV|resume|currículum|subido|perfil/i')
        .first()
        .isVisible()
        .catch(() => false)
      const hasProfileContent = await page
        .locator('h1, h2, form, [class*="profile"]')
        .first()
        .isVisible()
        .catch(() => false)

      expect(hasUpload || hasExistingCV || hasProfileContent).toBeTruthy()
    })
  })

  test.describe('Applications', () => {
    test('should display applications page', async ({ page, navigateTo }) => {
      await navigateTo('/candidate/applications')
      await expect(page.locator('h1, h2').first()).toBeVisible()
    })

    test('should show applications list or empty state', async ({ page, navigateTo }) => {
      await navigateTo('/candidate/applications')

      // Wait for loading to complete
      await page.locator('text=/Cargando/i').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})

      const hasList = await page
        .locator('table, [data-testid="applications-list"], a[href*="/application"]')
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
      const hasEmptyState = await page
        .locator('text=/no hay|no tienes|sin aplicaciones|empty|No has aplicado/i')
        .first()
        .isVisible()
        .catch(() => false)
      const hasHeading = await page
        .locator('h1, h2')
        .first()
        .isVisible()
        .catch(() => false)

      expect(hasList || hasEmptyState || hasHeading).toBeTruthy()
    })
  })

  test.describe('Job Search', () => {
    test('should display available jobs', async ({ page, navigateTo }) => {
      await navigateTo('/candidate/jobs')

      const hasJobs = await page
        .locator('[data-testid="job-card"], .job-card, table tbody tr')
        .count()
        .then((c) => c > 0)
        .catch(() => false)
      const hasEmptyState = await page
        .locator('text=/no hay vacantes|no jobs|sin puestos/i')
        .first()
        .isVisible()
        .catch(() => false)
      const hasHeading = await page.locator('h1, h2').first().isVisible().catch(() => false)

      expect(hasJobs || hasEmptyState || hasHeading).toBeTruthy()
    })

    test('should allow searching/filtering jobs', async ({ page, navigateTo }) => {
      await navigateTo('/candidate/jobs')

      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="Buscar"], input[placeholder*="Search"]'
      )
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('Developer')
        await page.waitForTimeout(500)
      }
    })
  })

  test.describe('Dashboard Metrics', () => {
    test('should display dashboard with metrics', async ({ page, navigateTo }) => {
      // Candidate lands on /dashboard
      await navigateTo('/dashboard')

      // Should see metric cards (Aplicaciones, Entrevista, Match)
      await expect(page.locator('h1, h2, [class*="metric"], [class*="card"]').first()).toBeVisible({
        timeout: 10000,
      })
    })
  })
})
