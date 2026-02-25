import { test, expect } from '../../fixtures/auth.fixture'

test.describe('EOR Module - El Salvador', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('employer')
  })

  test.describe('EOR Dashboard', () => {
    test('should display EOR dashboard', async ({ page, navigateTo }) => {
      await navigateTo('/employer/eor')

      await expect(page.locator('h1, h2').first()).toBeVisible()
    })

    test('should display employee list or empty state', async ({ page, navigateTo }) => {
      await navigateTo('/employer/eor')

      const hasList = await page.locator('table').isVisible().catch(() => false)
      const hasEmptyState = await page
        .locator('text=/no hay|no tienes|empty|agregar|empleado/i')
        .first()
        .isVisible()
        .catch(() => false)
      const hasMetrics = await page
        .locator('text=/Total Empleados/i')
        .isVisible()
        .catch(() => false)

      expect(hasList || hasEmptyState || hasMetrics).toBeTruthy()
    })

    test('should have add employee button', async ({ page, navigateTo }) => {
      await navigateTo('/employer/eor')

      // Button text is "Agregar Empleado"
      await expect(
        page.locator('a:has-text("Agregar Empleado"), a:has-text("Agregar empleado"), a[href="/employer/eor/new"], button:has-text("Agregar")').first()
      ).toBeVisible()
    })
  })

  test.describe('Add Employee Wizard', () => {
    test('should navigate to add employee page', async ({ page, navigateTo }) => {
      await navigateTo('/employer/eor')

      await page.click(
        'a:has-text("Agregar Empleado"), a:has-text("Agregar empleado"), a[href="/employer/eor/new"]'
      )

      await expect(page).toHaveURL(/\/employer\/eor\/new/)
    })

    test('should display wizard step 1', async ({ page, navigateTo }) => {
      await navigateTo('/employer/eor/new')

      // Wizard should show first step with personal data fields or step indicator
      const hasForm = await page.locator('form, input').first().isVisible().catch(() => false)
      const hasStepText = await page
        .locator('text=/paso|step|datos personales|personal/i')
        .first()
        .isVisible()
        .catch(() => false)

      expect(hasForm || hasStepText).toBeTruthy()
    })
  })
})

test.describe('Public EOR Calculator', () => {
  test('should display calculator page', async ({ page }) => {
    await page.goto('/calculator')
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('should calculate costs for given salary', async ({ page }) => {
    await page.goto('/calculator')
    await page.waitForLoadState('networkidle')

    const salaryInput = page.locator('input[type="number"], input[name="salary"]').first()
    await salaryInput.fill('1000')
    await salaryInput.blur()
    await page.waitForTimeout(1000)

    await expect(page.locator('text=/ISSS|AFP|total|costo/i').first()).toBeVisible()
  })

  test('should show breakdown of costs', async ({ page }) => {
    await page.goto('/calculator')
    await page.waitForLoadState('networkidle')

    await page.fill('input[type="number"], input[name="salary"]', '2000')
    await page.locator('input[type="number"]').first().blur()
    await page.waitForTimeout(1000)

    const expectedItems = ['ISSS', 'AFP']
    for (const item of expectedItems) {
      await expect(page.locator(`text=${item}`).first()).toBeVisible()
    }
  })

  test('should have CTA to register/contact', async ({ page }) => {
    await page.goto('/calculator')
    await page.waitForLoadState('networkidle')

    await expect(
      page.locator('button:has-text("Comenzar"), a:has-text("Comenzar"), button:has-text("Contactar"), a:has-text("Registrar")').first()
    ).toBeVisible()
  })
})
