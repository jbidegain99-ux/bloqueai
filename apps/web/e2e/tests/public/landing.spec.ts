import { test, expect } from '@playwright/test'

test.describe('Public Pages', () => {
  test.describe('Landing Page', () => {
    test('should display landing page', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await expect(page.locator('h1').first()).toBeVisible()
    })

    test('should have navigation to login', async ({ page }) => {
      await page.goto('/')
      await expect(
        page.locator('a[href="/login"], a:has-text("Iniciar"), a:has-text("Login")').first()
      ).toBeVisible()
    })

    test('should have CTA or demo request', async ({ page }) => {
      await page.goto('/')
      await expect(
        page.locator('a:has-text("Solicitar demo"), button:has-text("Solicitar demo"), a:has-text("Solicitar")').first()
      ).toBeVisible()
    })

    test('should load without errors', async ({ page }) => {
      const response = await page.goto('/')
      expect(response?.status()).toBeLessThan(400)
    })
  })

  test.describe('Calculator Page', () => {
    test('should display calculator independently', async ({ page }) => {
      await page.goto('/calculator')
      await page.waitForLoadState('networkidle')
      await expect(page.locator('h1, h2').first()).toBeVisible()
    })

    test('should have salary input', async ({ page }) => {
      await page.goto('/calculator')
      await page.waitForLoadState('networkidle')
      await expect(
        page.locator('input[type="number"], input[name="salary"]').first()
      ).toBeVisible()
    })
  })
})
