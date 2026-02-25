import { test, expect, devices } from '@playwright/test'

const mobileDevice = devices['Pixel 5']

test.use({ ...mobileDevice })

test.describe('Mobile Responsiveness', () => {
  test('landing page should be responsive', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Verify no horizontal overflow
    const body = await page.locator('body').boundingBox()
    expect(body?.width).toBeLessThanOrEqual(mobileDevice.viewport.width + 1)
  })

  test('login page should be usable on mobile', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()

    // Verify inputs are touchable (min 36px touch target)
    const emailInput = await page.locator('input[type="email"]').boundingBox()
    expect(emailInput?.height).toBeGreaterThanOrEqual(36)
  })

  test('pricing page should render on mobile', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('calculator page should work on mobile', async ({ page }) => {
    await page.goto('/calculator')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1, h2').first()).toBeVisible()

    const salaryInput = page.locator('input[type="number"], input[name="salary"]').first()
    if (await salaryInput.isVisible().catch(() => false)) {
      await salaryInput.fill('1000')
    }
  })
})
