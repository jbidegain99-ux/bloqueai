import { test, expect } from '../../fixtures/auth.fixture'

test.describe('Billing Module', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('employer')
  })

  test.describe('Billing Dashboard', () => {
    test('should display billing page', async ({ page, navigateTo }) => {
      await navigateTo('/employer/settings/billing')

      await expect(page.locator('h1, h2').first()).toBeVisible()
    })

    test('should display plan info or no-subscription state', async ({ page, navigateTo }) => {
      await navigateTo('/employer/settings/billing')

      // Wait for the billing page content to load
      await expect(
        page.locator('text=/Billing|Subscription|plan|No active/i').first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have action button (Choose Plan or Upgrade)', async ({ page, navigateTo }) => {
      await navigateTo('/employer/settings/billing')

      await expect(
        page.locator('button:has-text("Choose"), button:has-text("Upgrade"), a:has-text("Choose"), button:has-text("Cambiar"), a[href="/pricing"]').first()
      ).toBeVisible()
    })
  })

  test.describe('Invoices', () => {
    test('should display invoices section', async ({ page, navigateTo }) => {
      await navigateTo('/employer/settings/billing')

      await expect(
        page.locator('text=/Invoices|facturas|historial/i').first()
      ).toBeVisible()
    })

    test('should show empty state or invoice list', async ({ page, navigateTo }) => {
      await navigateTo('/employer/settings/billing')

      // Wait for billing page to fully load
      await page.locator('text=/Billing|Invoices/i').first().waitFor({ timeout: 10000 })

      const hasInvoices = await page
        .locator('table tbody tr, [data-testid="invoice-row"]')
        .count()
        .then((c) => c > 0)
        .catch(() => false)
      const hasEmptyState = await page
        .locator('text=/No invoices|no hay facturas|No invoices yet/i')
        .isVisible()
        .catch(() => false)
      // When there's no subscription, the Invoices section may not be shown at all
      const hasNoSubscription = await page
        .locator('text=/No active subscription/i')
        .isVisible()
        .catch(() => false)

      expect(hasInvoices || hasEmptyState || hasNoSubscription).toBeTruthy()
    })
  })
})

test.describe('Public Pricing Page', () => {
  test('should display pricing page', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('should display plan options', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')

    const plans = ['Free', 'Growth', 'Professional', 'Enterprise', 'Piloto', 'Empresa', 'Custom']
    let foundPlans = 0
    for (const plan of plans) {
      const isVisible = await page
        .locator(`text=${plan}`)
        .first()
        .isVisible()
        .catch(() => false)
      if (isVisible) foundPlans++
    }
    expect(foundPlans).toBeGreaterThanOrEqual(2)
  })

  test('should have CTA buttons', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')

    const ctaButtons = page.locator(
      'button:has-text("Comenzar"), button:has-text("Iniciar"), a:has-text("Contactar"), a:has-text("Solicitar"), button:has-text("Solicitar"), button:has-text("Agenda")'
    )
    await expect(ctaButtons.first()).toBeVisible()
  })
})
