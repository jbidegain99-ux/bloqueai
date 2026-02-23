import { test as base, expect, request } from '@playwright/test'

type UserRole = 'admin' | 'employer' | 'candidate'

interface AuthFixture {
  loginAs: (role: UserRole) => Promise<void>
  navigateTo: (path: string) => Promise<void>
  logout: () => Promise<void>
}

const credentials: Record<UserRole, { email: string; password: string }> = {
  admin: { email: 'admin@example.com', password: 'Admin123!' },
  employer: { email: 'employer@example.com', password: 'Employer123!' },
  candidate: { email: 'candidate1@example.com', password: 'Candidate123!' },
}

export const test = base.extend<AuthFixture>({
  loginAs: async ({ page }, use) => {
    const login = async (role: UserRole) => {
      const { email, password } = credentials[role]

      await page.goto('/login')
      await page.waitForLoadState('domcontentloaded')

      const emailInput = page.locator('input[type="email"], input[name="email"]')
      await emailInput.waitFor({ state: 'visible', timeout: 10000 })
      await emailInput.fill(email)
      await page.locator('input[type="password"], input[name="password"]').fill(password)
      await page.locator('button[type="submit"]').click()

      await page.waitForURL(
        (url) => !url.pathname.includes('/login'),
        { timeout: 15000 }
      )
      await page.waitForLoadState('networkidle')
    }

    await use(login)
  },

  navigateTo: async ({ page }, use) => {
    /**
     * Client-side navigation using Next.js router.
     * Avoids full page reload (page.goto) which causes zustand hydration race.
     * Must be called AFTER loginAs().
     */
    const navigate = async (path: string) => {
      const currentPath = new URL(page.url()).pathname
      if (currentPath === path) return

      await page.evaluate((targetPath) => {
        // Use Next.js internal router for client-side navigation
        // @ts-ignore - Next.js exposes router on window.next
        if (window.next?.router?.push) {
          window.next.router.push(targetPath)
        }
      }, path)

      await page.waitForURL((url) => url.pathname === path, { timeout: 10000 })
      await page.waitForLoadState('networkidle')
    }

    await use(navigate)
  },

  logout: async ({ page }, use) => {
    const doLogout = async () => {
      const avatarButton = page
        .locator('nav')
        .locator('..')
        .locator('button')
        .filter({ hasText: /^[A-Z]{2}$/ })
        .first()
      if (await avatarButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await avatarButton.click()
        await page.waitForTimeout(300)
      }

      const logoutItem = page.getByRole('menuitem', { name: 'Cerrar sesión' })
      if (await logoutItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await logoutItem.click()
      }

      await page.waitForURL(/\/login/, { timeout: 10000 })
    }

    await use(doLogout)
  },
})

export { expect }
