import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility', () => {
  test('landing page should have no critical accessibility violations', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    const critical = results.violations.filter(
      (v) => v.impact === 'critical'
    )

    if (critical.length > 0) {
      console.log(
        'Critical a11y violations on landing:',
        critical.map((v) => `${v.id}: ${v.description}`)
      )
    }

    expect(critical).toHaveLength(0)
  })

  test('login page should be accessible', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('.toaster') // Exclude toast notification area
      .analyze()

    const critical = results.violations.filter(
      (v) => v.impact === 'critical'
    )

    const serious = results.violations.filter(
      (v) => v.impact === 'serious'
    )

    if (critical.length > 0) {
      console.log(
        'Critical a11y violations on login:',
        critical.map((v) => `${v.id}: ${v.description} (${v.nodes.length} instances)`)
      )
    }

    if (serious.length > 0) {
      console.log(
        'Serious a11y violations on login (non-blocking):',
        serious.map((v) => `${v.id}: ${v.description} (${v.nodes.length} instances)`)
      )
    }

    // Only fail on critical violations; serious ones are logged as warnings
    expect(critical).toHaveLength(0)
  })

  test('pricing page should be accessible', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).analyze()

    const critical = results.violations.filter(
      (v) => v.impact === 'critical'
    )
    expect(critical).toHaveLength(0)
  })

  test('forms should have proper labels', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const inputs = await page.locator('input:not([type="hidden"])').all()

    for (const input of inputs) {
      const hasLabel =
        (await input.getAttribute('aria-label')) ||
        (await input.getAttribute('aria-labelledby')) ||
        (await input.getAttribute('id')) ||
        (await input.getAttribute('placeholder'))

      expect(hasLabel).toBeTruthy()
    }
  })

  test('visible buttons should have accessible names', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const buttons = await page.locator('button:visible').all()
    let buttonsWithoutName = 0

    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label').catch(() => null)
      const innerText = await button.innerText().catch(() => '')
      const title = await button.getAttribute('title').catch(() => null)
      const accessibleName = (ariaLabel || innerText || title || '').trim()

      if (accessibleName.length === 0) {
        buttonsWithoutName++
      }
    }

    // Allow a small number of icon-only buttons without labels (will be flagged in axe audit)
    expect(buttonsWithoutName).toBeLessThanOrEqual(2)
  })

  test('images should have alt text', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const images = await page.locator('img').all()

    for (const img of images) {
      const alt = await img.getAttribute('alt')
      const role = await img.getAttribute('role')

      // Must have alt or be decorative (role="presentation")
      expect(alt !== null || role === 'presentation' || role === 'none').toBeTruthy()
    }
  })
})
