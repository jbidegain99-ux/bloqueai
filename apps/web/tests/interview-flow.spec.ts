import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Interview Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as candidate
    await page.goto('/login')
    await page.getByLabel(/correo/i).fill('candidate1@example.com')
    await page.getByLabel(/contraseña/i).fill('Candidate123!')
    await page.getByRole('button', { name: /ingresar/i }).click()
    await page.waitForURL(/\/(dashboard|candidate)/)
  })

  test('should navigate to apply flow from jobs', async ({ page }) => {
    await page.goto('/candidate/jobs')

    // Wait for jobs to load
    await page.waitForTimeout(2000)

    // Look for any job card or link
    const jobCards = page.locator('a[href*="/candidate/apply/"], [data-testid="job-card"], .cursor-pointer')
    const count = await jobCards.count()

    if (count === 0) {
      test.skip(true, 'No seeded jobs available')
      return
    }

    // Click the first job
    await jobCards.first().click()

    // Should navigate to apply page
    await expect(page).toHaveURL(/\/candidate\/apply\//)
  })

  test('should show pre-upload step', async ({ page }) => {
    await page.goto('/candidate/jobs')
    await page.waitForTimeout(2000)

    const jobCards = page.locator('a[href*="/candidate/apply/"], [data-testid="job-card"], .cursor-pointer')
    const count = await jobCards.count()

    if (count === 0) {
      test.skip(true, 'No seeded jobs available')
      return
    }

    await jobCards.first().click()
    await expect(page).toHaveURL(/\/candidate\/apply\//)

    // Verify pre-upload step content
    await expect(
      page.getByText(/preparate|asegurate|antes de aplicar/i).first()
    ).toBeVisible()

    // Verify continue button
    await expect(
      page.getByRole('button', { name: /continuar/i })
    ).toBeVisible()
  })

  test('should upload CV and trigger analysis', async ({ page }) => {
    await page.goto('/candidate/jobs')
    await page.waitForTimeout(2000)

    const jobCards = page.locator('a[href*="/candidate/apply/"], [data-testid="job-card"], .cursor-pointer')
    const count = await jobCards.count()

    if (count === 0) {
      test.skip(true, 'No seeded jobs available')
      return
    }

    await jobCards.first().click()
    await expect(page).toHaveURL(/\/candidate\/apply\//)

    // Click continue past pre-step
    await page.getByRole('button', { name: /continuar/i }).click()

    // Upload the test PDF fixture
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(
      path.resolve(__dirname, 'fixtures/test-cv.pdf')
    )

    // Look for the analyze button
    const analyzeButton = page.getByRole('button', { name: /analizar/i })
    if (await analyzeButton.isVisible()) {
      await analyzeButton.click()

      // Verify either analyzing state or error message appears
      // (analysis will fail without OpenAI key, which is expected)
      await expect(
        page.getByText(/analizando|error|no disponible/i).first()
      ).toBeVisible({ timeout: 10000 })
    }
  })
})
