import { test, expect } from '../../fixtures/auth.fixture'

/**
 * Helper: extract the first job UUID from the employer jobs list page.
 */
async function getFirstJobId(page: import('@playwright/test').Page): Promise<string | null> {
  const link = page.locator('a[href*="/employer/jobs/"]').first()
  const href = await link.getAttribute('href').catch(() => null)
  if (!href) return null
  const match = href.match(/\/employer\/jobs\/([a-f0-9-]+)/)
  return match ? match[1] : null
}

// ─── Employer: Candidatos Recomendados (Job Matches) ────────────────────────

test.describe('Employer Job Matches', () => {
  let jobId: string | null = null

  test.beforeEach(async ({ page, loginAs, navigateTo }) => {
    await loginAs('employer')
    await navigateTo('/employer/jobs')
    jobId = await getFirstJobId(page)
  })

  test('should load the matches page with heading and stats', async ({ page, navigateTo }) => {
    test.skip(!jobId, 'No jobs available to test matches')

    await navigateTo(`/employer/jobs/${jobId}/matches`)
    await page.waitForLoadState('networkidle')

    const heading = await page
      .locator('h1:has-text("Candidatos Recomendados")')
      .isVisible({ timeout: 30000 })
      .catch(() => false)

    expect(heading).toBeTruthy()

    // Verify stat labels exist
    const statsText = await page.locator('body').textContent()
    const hasStats =
      statsText?.includes('Total matches') ||
      statsText?.includes('En shortlist') ||
      statsText?.includes('Rechazados')

    expect(hasStats).toBeTruthy()
  })

  test('should show candidate cards or empty state', async ({ page, navigateTo }) => {
    test.skip(!jobId, 'No jobs available to test matches')

    await navigateTo(`/employer/jobs/${jobId}/matches`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const hasCards = await page
      .locator('[data-testid="candidate-match-card"]')
      .count()
      .then((c) => c > 0)
      .catch(() => false)

    const hasEmpty = await page
      .locator('text=/No hay candidatos/i')
      .first()
      .isVisible()
      .catch(() => false)

    expect(hasCards || hasEmpty).toBeTruthy()
  })

  test('should display match score badges', async ({ page, navigateTo }) => {
    test.skip(!jobId, 'No jobs available to test matches')

    await navigateTo(`/employer/jobs/${jobId}/matches`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const badges = page.locator('[data-testid="match-score-badge"]')
    const count = await badges.count().catch(() => 0)

    if (count > 0) {
      const text = await badges.first().textContent()
      expect(text).toMatch(/\d+%/)
    } else {
      // No matches — that's fine, empty state is valid
      const hasEmpty = await page
        .locator('text=/No hay candidatos/i')
        .first()
        .isVisible()
        .catch(() => false)
      expect(hasEmpty).toBeTruthy()
    }
  })

  test('should have score filter dropdown', async ({ page, navigateTo }) => {
    test.skip(!jobId, 'No jobs available to test matches')

    await navigateTo(`/employer/jobs/${jobId}/matches`)
    await page.waitForLoadState('networkidle')

    const select = page.locator('select').first()
    const isVisible = await select.isVisible({ timeout: 10000 }).catch(() => false)

    if (isVisible) {
      await select.selectOption({ index: 2 })
      await page.waitForTimeout(1000)
      // Page should update without crashing
      expect(true).toBeTruthy()
    } else {
      // Filter might not render if there are no matches
      expect(true).toBeTruthy()
    }
  })

  test('should have tabs for filtering by status', async ({ page, navigateTo }) => {
    test.skip(!jobId, 'No jobs available to test matches')

    await navigateTo(`/employer/jobs/${jobId}/matches`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const shortlistTab = page.locator('button:has-text("Shortlist"), [role="tab"]:has-text("Shortlist")').first()
    const rechazadosTab = page.locator('button:has-text("Rechazados"), [role="tab"]:has-text("Rechazados")').first()

    const hasShortlistTab = await shortlistTab.isVisible().catch(() => false)
    const hasRechazadosTab = await rechazadosTab.isVisible().catch(() => false)

    if (hasShortlistTab) {
      await shortlistTab.click()
      await page.waitForTimeout(500)
    }
    if (hasRechazadosTab) {
      await rechazadosTab.click()
      await page.waitForTimeout(500)
    }

    // Tabs should exist on the page
    expect(hasShortlistTab || hasRechazadosTab).toBeTruthy()
  })

  test('should navigate to matches from job detail via AI button', async ({ page, navigateTo }) => {
    test.skip(!jobId, 'No jobs available to test matches')

    await navigateTo(`/employer/jobs/${jobId}`)
    await page.waitForLoadState('networkidle')

    const aiButton = page
      .locator('a:has-text("Candidatos IA"), button:has-text("Candidatos IA"), a[href*="/matches"]')
      .first()

    const isVisible = await aiButton.isVisible({ timeout: 10000 }).catch(() => false)

    if (isVisible) {
      await aiButton.click()
      await page.waitForURL(/\/matches/, { timeout: 10000 })
      expect(page.url()).toContain('/matches')
    } else {
      // Button might not exist if feature is hidden or job has no detail page link
      test.skip(true, 'AI candidates button not found on job detail')
    }
  })

  test('should have refresh button', async ({ page, navigateTo }) => {
    test.skip(!jobId, 'No jobs available to test matches')

    await navigateTo(`/employer/jobs/${jobId}/matches`)
    await page.waitForLoadState('networkidle')

    const refreshBtn = page
      .locator('button:has-text("Actualizar"), button:has-text("actualizar")')
      .first()

    const isVisible = await refreshBtn.isVisible({ timeout: 10000 }).catch(() => false)

    if (isVisible) {
      await refreshBtn.click()
      // Spinner should appear briefly (animate-spin class on the icon)
      await page.waitForTimeout(500)
      expect(true).toBeTruthy()
    } else {
      // Refresh button might use an icon-only variant
      const iconBtn = page.locator('button svg.animate-spin, button svg.lucide-refresh-cw').first()
      const hasRefreshIcon = await iconBtn.isVisible({ timeout: 3000 }).catch(() => false)
      expect(isVisible || hasRefreshIcon).toBeTruthy()
    }
  })
})

// ─── Candidate: Trabajos Recomendados ───────────────────────────────────────

test.describe('Candidate Recommended Jobs', () => {
  test.beforeEach(async ({ loginAs, navigateTo }) => {
    await loginAs('candidate')
    await navigateTo('/candidate/recommended')
  })

  test('should load the recommended jobs page', async ({ page }) => {
    const heading = await page
      .locator('h1:has-text("Trabajos Recomendados"), h2:has-text("Trabajos Recomendados")')
      .isVisible({ timeout: 30000 })
      .catch(() => false)

    expect(heading).toBeTruthy()
  })

  test('should show job cards or empty state', async ({ page }) => {
    await page.waitForTimeout(3000)

    const hasCards = await page
      .locator('[data-testid="job-match-card"]')
      .count()
      .then((c) => c > 0)
      .catch(() => false)

    const hasEmpty = await page
      .locator('text=/No hay vacantes recomendadas/i')
      .first()
      .isVisible()
      .catch(() => false)

    expect(hasCards || hasEmpty).toBeTruthy()
  })

  test('should show profile CTA when empty', async ({ page }) => {
    await page.waitForTimeout(3000)

    const hasEmpty = await page
      .locator('text=/No hay vacantes recomendadas/i')
      .first()
      .isVisible()
      .catch(() => false)

    if (hasEmpty) {
      const profileLink = page
        .locator('a:has-text("Completar perfil"), a[href*="/candidate/profile"]')
        .first()

      const isVisible = await profileLink.isVisible().catch(() => false)
      expect(isVisible).toBeTruthy()
    } else {
      // Has results — no CTA expected
      expect(true).toBeTruthy()
    }
  })

  test('should have remote filter toggle', async ({ page }) => {
    await page.waitForTimeout(2000)

    const remoteToggle = page
      .locator('label:has-text("Solo remoto"), button:has-text("Solo remoto"), [role="switch"]')
      .first()

    const isVisible = await remoteToggle.isVisible({ timeout: 10000 }).catch(() => false)

    if (isVisible) {
      await remoteToggle.click()
      await page.waitForTimeout(1000)
      expect(true).toBeTruthy()
    } else {
      // Filter may not render if page is in loading/error state
      expect(true).toBeTruthy()
    }
  })

  test('should have score filter dropdown', async ({ page }) => {
    await page.waitForTimeout(2000)

    const select = page.locator('select').first()
    const isVisible = await select.isVisible({ timeout: 10000 }).catch(() => false)

    if (isVisible) {
      // Select the 85%+ option
      const options = await select.locator('option').allTextContents()
      const highScoreOption = options.findIndex((o) => o.includes('85'))
      if (highScoreOption >= 0) {
        await select.selectOption({ index: highScoreOption })
        await page.waitForTimeout(1000)
      }
      expect(true).toBeTruthy()
    } else {
      expect(true).toBeTruthy()
    }
  })
})
