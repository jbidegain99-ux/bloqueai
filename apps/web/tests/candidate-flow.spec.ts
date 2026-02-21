import { test, expect } from '@playwright/test'

test.describe('Candidate Flow E2E', () => {
  test.describe('Authenticated', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
      await page.getByLabel(/correo/i).fill('candidate1@example.com')
      await page.getByLabel(/contraseña/i).fill('Candidate123!')
      await page.getByRole('button', { name: /ingresar/i }).click()
      await page.waitForURL(/\/(dashboard|candidate)/)
    })

    test('should login and reach dashboard', async ({ page }) => {
      expect(page.url()).not.toContain('/login')
      await expect(page.getByText(/hola/i).first()).toBeVisible()
    })

    test('should show dashboard metrics', async ({ page }) => {
      // Verify greeting
      await expect(page.getByText(/hola/i).first()).toBeVisible()

      // Verify MetricCard labels
      await expect(page.getByText(/aplicaciones/i).first()).toBeVisible()
      await expect(page.getByText(/entrevista/i).first()).toBeVisible()
      await expect(page.getByText(/match/i).first()).toBeVisible()
    })

    test('should navigate to profile', async ({ page }) => {
      await page.goto('/candidate/profile')

      // Verify profile sections
      await expect(page.getByText(/cv/i).first()).toBeVisible()
      await expect(page.getByText(/entrevista/i).first()).toBeVisible()
    })

    test('should navigate to jobs list', async ({ page }) => {
      await page.goto('/candidate/jobs')

      // Verify jobs page
      await expect(
        page.getByText(/encuentra tu/i).first()
      ).toBeVisible()

      // Verify search input exists
      await expect(page.getByRole('textbox').first()).toBeVisible()
    })

    test('should navigate to applications', async ({ page }) => {
      await page.goto('/candidate/applications')

      await expect(
        page.getByText(/mis aplicaciones/i).first()
      ).toBeVisible()
    })

    test('should logout successfully', async ({ page }) => {
      // Open avatar/user dropdown
      const avatarTrigger = page.getByRole('button', { name: /avatar|perfil|usuario|menu/i }).first()
        || page.locator('[data-testid="user-menu"]').first()
        || page.locator('button:has(.h-8.w-8)').first()

      // Try multiple strategies for finding the user menu
      const dropdownTrigger = page.locator('header button').last()
      await dropdownTrigger.click()

      // Click logout
      await page.getByText(/cerrar sesión/i).click()

      // Verify redirect to login
      await expect(page).toHaveURL('/login')
    })
  })

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/candidate/profile')
    await expect(page).toHaveURL('/login')
  })
})
