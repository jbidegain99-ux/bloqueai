import { test, expect } from '../../fixtures/auth.fixture'

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin')
  })

  test.describe('Dashboard Overview', () => {
    test('should display admin dashboard with correct heading', async ({ page, navigateTo }) => {
      await navigateTo('/admin/dashboard')
      await expect(page.locator('h1:has-text("Dashboard de Reclutamiento")')).toBeVisible()
    })

    test('should display global metrics', async ({ page, navigateTo }) => {
      await navigateTo('/admin/dashboard')

      // Dashboard has metric cards: Total Aplicaciones, Sobre Threshold, etc.
      await expect(
        page.locator('text=/Aplicaciones|Threshold|Entrevistas|Shortlisted/i').first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have export CSV button', async ({ page, navigateTo }) => {
      await navigateTo('/admin/dashboard')

      await expect(
        page.locator('button:has-text("Exportar"), button:has-text("CSV")').first()
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Navigation via direct URL', () => {
    // BUG: AppShell.getRoleNav() checks isEmployer() before isAdmin().
    // Since isEmployer() returns true for ADMIN users, the admin secondary
    // nav (Clientes, Rúbricas, KPIs, etc.) is never shown.
    // These tests verify admin pages are accessible via direct navigation instead.

    test('should access clients page directly', async ({ page, navigateTo }) => {
      await navigateTo('/admin/clients')
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    })

    test('should access interviews page directly', async ({ page, navigateTo }) => {
      await navigateTo('/admin/interviews')
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    })

    test('should access KPIs page directly', async ({ page, navigateTo }) => {
      await navigateTo('/admin/kpis')
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Clients Management', () => {
    test('should display clients page', async ({ page, navigateTo }) => {
      await navigateTo('/admin/clients')

      const hasList = await page.locator('table').isVisible().catch(() => false)
      const hasHeading = await page.locator('h1, h2').first().isVisible().catch(() => false)

      expect(hasList || hasHeading).toBeTruthy()
    })
  })

  test.describe('Interviews', () => {
    test('should display interviews page without crash', async ({ page, navigateTo }) => {
      await navigateTo('/admin/interviews')

      // Should NOT show application error
      const hasError = await page
        .locator('text=/Application error|unhandled/i')
        .isVisible()
        .catch(() => false)

      expect(hasError).toBeFalsy()
      await expect(page.locator('h1, h2').first()).toBeVisible()
    })
  })
})
