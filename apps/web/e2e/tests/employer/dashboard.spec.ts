import { test, expect } from '../../fixtures/auth.fixture'

test.describe('Employer Dashboard', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('employer')
  })

  test.describe('Navigation', () => {
    test('should display navbar with all menu items', async ({ page }) => {
      // Employer secondary nav items from AppShell
      const menuItems = ['Dashboard', 'Trabajos', 'Shortlists', 'EOR', 'Facturación']

      for (const item of menuItems) {
        await expect(
          page.locator(`nav >> text=${item}`).first()
        ).toBeVisible()
      }
    })

    test('should navigate to jobs page', async ({ page }) => {
      await page.click('nav >> text=Trabajos')
      await expect(page).toHaveURL(/\/employer\/jobs/)
    })

    test('should navigate to shortlists page', async ({ page }) => {
      await page.click('nav >> text=Shortlists')
      await expect(page).toHaveURL(/\/employer\/shortlists/)
    })

    test('should navigate to EOR page', async ({ page }) => {
      await page.click('nav >> text=EOR')
      await expect(page).toHaveURL(/\/employer\/eor/)
    })

    test('should navigate to billing page', async ({ page }) => {
      await page.click('nav >> text=Facturación')
      await expect(page).toHaveURL(/\/employer\/settings\/billing/)
    })
  })

  test.describe('Dashboard Metrics', () => {
    test('should display metric cards', async ({ page, navigateTo }) => {
      await navigateTo('/employer/dashboard')

      // MetricCard components from the premium dashboard
      const metricCards = page.locator('[class*="metric"], [class*="card"]')
      await expect(metricCards.first()).toBeVisible({ timeout: 10000 })
    })

    test('should display recent vacancies or empty state', async ({ page, navigateTo }) => {
      await navigateTo('/employer/dashboard')

      const hasTable = await page.locator('table').isVisible().catch(() => false)
      const hasEmptyState = await page
        .locator('text=/no hay|no tienes|vacante|empty/i')
        .first()
        .isVisible()
        .catch(() => false)

      expect(hasTable || hasEmptyState).toBeTruthy()
    })
  })
})
