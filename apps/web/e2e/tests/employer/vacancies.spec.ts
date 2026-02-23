import { test, expect } from '../../fixtures/auth.fixture'

test.describe('Employer Vacancies (Jobs)', () => {
  test.beforeEach(async ({ page, loginAs, navigateTo }) => {
    await loginAs('employer')
    await navigateTo('/employer/jobs')
  })

  test.describe('Jobs List', () => {
    test('should display jobs list or empty state', async ({ page }) => {
      // Jobs are displayed as link cards (not a table)
      const hasJobCards = await page
        .locator('a[href*="/employer/jobs/"], [data-testid="jobs-list"]')
        .count()
        .then((c) => c > 0)
        .catch(() => false)
      const hasHeading = await page
        .locator('h1:has-text("Mis Vacantes"), h1:has-text("Vacantes")')
        .isVisible()
        .catch(() => false)
      const hasEmptyState = await page
        .locator('text=/no hay|no tienes|empty|primera vacante/i')
        .first()
        .isVisible()
        .catch(() => false)

      expect(hasJobCards || hasHeading || hasEmptyState).toBeTruthy()
    })

    test('should have create job button or link', async ({ page }) => {
      // Button text is "Nueva vacante" or "Nueva Vacante"
      await expect(
        page.locator('a:has-text("Nueva vacante"), a:has-text("Nueva Vacante"), button:has-text("Nueva vacante"), a[href="/employer/jobs/new"]').first()
      ).toBeVisible()
    })
  })

  test.describe('Create Job', () => {
    test('should navigate to create job form', async ({ page }) => {
      await page.click(
        'a:has-text("Nueva vacante"), a:has-text("Nueva Vacante"), a[href="/employer/jobs/new"]'
      )

      await expect(page).toHaveURL(/\/employer\/jobs\/new/)
    })

    test('should display job creation form fields', async ({ page, navigateTo }) => {
      await navigateTo('/employer/jobs/new')

      // Should have title field
      await expect(
        page.locator('input[name="title"], input[name="name"], #title').first()
      ).toBeVisible()
    })
  })
})
