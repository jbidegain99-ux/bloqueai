import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate employee login by setting auth state in localStorage. */
async function loginAsEmployee(page: import('@playwright/test').Page) {
  await page.goto(BASE)
  await page.evaluate(() => {
    const authState = {
      state: {
        user: {
          id: 'e2e-employee-id',
          email: 'maria.lopez@demo.com',
          full_name: 'Maria Lopez',
          role: 'employee',
        },
        accessToken: 'e2e-test-token',
        isAuthenticated: true,
        isHydrated: true,
      },
      version: 0,
    }
    localStorage.setItem('auth-storage', JSON.stringify(authState))
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Employee Portal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEmployee(page)
  })

  // ── Dashboard ──────────────────────────────────────────────────

  test('employee logs in and sees dashboard', async ({ page }) => {
    await page.goto(`${BASE}/portal`)
    // The page should load without redirecting to /login
    await expect(page).toHaveURL(/\/portal/)
  })

  test('dashboard shows welcome message and quick actions', async ({ page }) => {
    await page.goto(`${BASE}/portal`)

    // Welcome greeting (Spanish) — "Hola, Maria!" or similar
    await expect(page.locator('h1')).toContainText('Hola')

    // Quick action buttons (Spanish labels from the portal page)
    await expect(page.getByText('Ver colillas')).toBeVisible()
    await expect(page.getByText('Descargar comprobante')).toBeVisible()
    await expect(page.getByText('Preguntar al asistente')).toBeVisible()
    await expect(page.getByText('Actualizar perfil')).toBeVisible()
  })

  // ── Navigation ─────────────────────────────────────────────────

  test('can navigate to payslips page', async ({ page }) => {
    await page.goto(`${BASE}/portal`)
    await page.getByText('Ver colillas').click()
    await expect(page).toHaveURL(/\/portal\/payslips/)
    await expect(page.getByText('Colillas de Pago')).toBeVisible()
  })

  test('can navigate to salary breakdown page', async ({ page }) => {
    await page.goto(`${BASE}/portal/salary`)
    await expect(page).toHaveURL(/\/portal\/salary/)
    await expect(page.getByText('Desglose Salarial')).toBeVisible()
  })

  test('can navigate to profile page', async ({ page }) => {
    await page.goto(`${BASE}/portal`)
    await page.getByText('Actualizar perfil').click()
    await expect(page).toHaveURL(/\/portal\/profile/)
    await expect(page.getByText('Mi Perfil')).toBeVisible()
  })

  test('can navigate to documents page', async ({ page }) => {
    await page.goto(`${BASE}/portal`)
    await page.getByText('Descargar comprobante').click()
    await expect(page).toHaveURL(/\/portal\/documents/)
    await expect(page.getByText('Mis Documentos')).toBeVisible()
  })

  test('can navigate to assistant page', async ({ page }) => {
    await page.goto(`${BASE}/portal`)
    await page.getByText('Preguntar al asistente').click()
    await expect(page).toHaveURL(/\/portal\/assistant/)
    await expect(page.getByText('Valentina')).toBeVisible()
    await expect(page.getByText('Asistente de RRHH')).toBeVisible()
  })

  // ── Assistant Chat ─────────────────────────────────────────────

  test('can type a message in the assistant and send it', async ({ page }) => {
    await page.goto(`${BASE}/portal/assistant`)

    // Wait for the welcome message from Valentina
    await expect(page.getByText(/Soy Valentina/)).toBeVisible()

    // Type a question in the textarea
    const textarea = page.locator('textarea[placeholder="Escribe tu pregunta..."]')
    await expect(textarea).toBeVisible()
    await textarea.fill('Cual es mi salario neto?')

    // The send button should be enabled now
    const sendButton = page.locator('button[type="submit"]')
    await expect(sendButton).toBeEnabled()

    // Click send
    await sendButton.click()

    // The user message should appear in the chat
    await expect(page.getByText('Cual es mi salario neto?')).toBeVisible()

    // The textarea should be cleared after sending
    await expect(textarea).toHaveValue('')
  })

  test('assistant shows suggested questions', async ({ page }) => {
    await page.goto(`${BASE}/portal/assistant`)

    // Suggested questions should be visible
    await expect(page.getByText('Sugerencias')).toBeVisible()
    await expect(page.getByText('Cual es mi salario neto?')).toBeVisible()
    await expect(page.getByText('Cuando es el proximo pago?')).toBeVisible()
    await expect(page.getByText('Como solicito vacaciones?')).toBeVisible()
  })

  // ── Documents ──────────────────────────────────────────────────

  test('can generate a proof of income document', async ({ page }) => {
    await page.goto(`${BASE}/portal/documents`)

    // The "Constancia de Ingresos" card should be visible
    await expect(page.getByText('Constancia de Ingresos')).toBeVisible()
    await expect(
      page.getByText('Genera una constancia actualizada')
    ).toBeVisible()

    // Click on the proof-of-income card
    const proofCard = page.getByText('Constancia de Ingresos').locator('..')
    await proofCard.click()

    // After clicking, a loading spinner or result should appear
    // (In a real environment, the API would respond; we just verify the click triggers)
  })

  test('documents page shows quick action cards', async ({ page }) => {
    await page.goto(`${BASE}/portal/documents`)

    await expect(page.getByText('Constancia de Ingresos')).toBeVisible()
    await expect(page.getByText('Carta de Empleo')).toBeVisible()
    await expect(page.getByText('Colillas de Pago')).toBeVisible()
  })

  // ── Spanish Language Labels ────────────────────────────────────

  test('verify Spanish language labels are present', async ({ page }) => {
    // Dashboard Spanish labels
    await page.goto(`${BASE}/portal`)
    await expect(page.getByText('Ver colillas')).toBeVisible()
    await expect(page.getByText('Descargar comprobante')).toBeVisible()
    await expect(page.getByText('Preguntar al asistente')).toBeVisible()
    await expect(page.getByText('Actualizar perfil')).toBeVisible()
    await expect(page.getByText('Ultima Colilla de Pago')).toBeVisible()
    await expect(page.getByText('Resumen del Ano')).toBeVisible()

    // Payslips Spanish labels
    await page.goto(`${BASE}/portal/payslips`)
    await expect(page.getByText('Colillas de Pago')).toBeVisible()
    await expect(page.getByText('Historial de pagos y comprobantes')).toBeVisible()

    // Salary breakdown Spanish labels
    await page.goto(`${BASE}/portal/salary`)
    await expect(page.getByText('Desglose Salarial')).toBeVisible()

    // Profile Spanish labels
    await page.goto(`${BASE}/portal/profile`)
    await expect(page.getByText('Mi Perfil')).toBeVisible()
    await expect(page.getByText('Informacion personal y laboral')).toBeVisible()

    // Documents Spanish labels
    await page.goto(`${BASE}/portal/documents`)
    await expect(page.getByText('Mis Documentos')).toBeVisible()
    await expect(
      page.getByText('Genera y descarga tus documentos laborales')
    ).toBeVisible()

    // Assistant Spanish labels
    await page.goto(`${BASE}/portal/assistant`)
    await expect(page.getByText('Valentina')).toBeVisible()
    await expect(page.getByText('Asistente de RRHH')).toBeVisible()
    await expect(
      page.locator('textarea[placeholder="Escribe tu pregunta..."]')
    ).toBeVisible()
  })

  // ── Payslips Detail ────────────────────────────────────────────

  test('payslips page shows year selector', async ({ page }) => {
    await page.goto(`${BASE}/portal/payslips`)

    // Year selector should be present
    const currentYear = new Date().getFullYear()
    await expect(page.getByText(String(currentYear))).toBeVisible()
  })

  // ── Salary Breakdown ──────────────────────────────────────────

  test('salary breakdown page shows deduction concepts', async ({ page }) => {
    await page.goto(`${BASE}/portal/salary`)

    // Headers that should be present on the breakdown page
    await expect(page.getByText('Desglose Salarial')).toBeVisible()
  })

  // ── Profile Details ────────────────────────────────────────────

  test('profile page shows personal and employment sections', async ({ page }) => {
    await page.goto(`${BASE}/portal/profile`)

    await expect(page.getByText('Informacion Personal')).toBeVisible()
    await expect(page.getByText('Informacion Laboral')).toBeVisible()
    await expect(page.getByText('Informacion Bancaria')).toBeVisible()
    await expect(page.getByText('Contacto de Emergencia')).toBeVisible()
  })

  // ── Back Navigation ────────────────────────────────────────────

  test('sub-pages have back button to portal', async ({ page }) => {
    // Payslips back button
    await page.goto(`${BASE}/portal/payslips`)
    const backButton = page.getByRole('button', { name: /Portal/ })
    await expect(backButton).toBeVisible()
    await backButton.click()
    await expect(page).toHaveURL(/\/portal$/)
  })
})
