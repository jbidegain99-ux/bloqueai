import { Page } from '@playwright/test'

/**
 * Wait for page to be fully loaded (no pending network requests)
 */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300) // Allow React to finish rendering
}

/**
 * Check if an element exists on the page (without failing)
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    return (await page.locator(selector).count()) > 0
  } catch {
    return false
  }
}

/**
 * Safely click an element if it exists
 */
export async function clickIfVisible(page: Page, selector: string): Promise<boolean> {
  const el = page.locator(selector)
  if (await el.isVisible().catch(() => false)) {
    await el.click()
    return true
  }
  return false
}
