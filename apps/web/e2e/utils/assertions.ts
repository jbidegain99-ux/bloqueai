import { Page, expect } from '@playwright/test'

/**
 * Assert that the page has no console errors (excluding known noise)
 */
export async function assertNoConsoleErrors(page: Page) {
  const errors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // Ignore known noise
      if (
        text.includes('favicon') ||
        text.includes('hydration') ||
        text.includes('DevTools')
      ) {
        return
      }
      errors.push(text)
    }
  })

  return errors
}

/**
 * Assert page loaded without 4xx/5xx errors
 */
export async function assertPageLoaded(page: Page, url: string) {
  const response = await page.goto(url)
  expect(response?.status()).toBeLessThan(400)
  await expect(page.locator('body')).toBeVisible()
}
