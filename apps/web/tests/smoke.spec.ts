import { test, expect } from '@playwright/test'

test.describe('Smoke Tests', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login')

    // Check page title
    await expect(page).toHaveTitle(/TalentOS/)

    // Check login form elements
    await expect(page.getByLabel(/correo/i)).toBeVisible()
    await expect(page.getByLabel(/contraseña/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible()
  })

  test('should show register link on login page', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('link', { name: /regístrate/i })).toBeVisible()
  })

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('link', { name: /regístrate/i }).click()

    await expect(page).toHaveURL('/register')
    await expect(page.getByRole('heading', { name: /crear cuenta/i })).toBeVisible()
  })

  test('should show validation errors on empty login', async ({ page }) => {
    await page.goto('/login')

    // Try to submit empty form
    await page.getByRole('button', { name: /ingresar/i }).click()

    // Browser should show validation (required fields)
    const emailInput = page.getByLabel(/correo/i)
    await expect(emailInput).toHaveAttribute('required', '')
  })

  test('should show test credentials info', async ({ page }) => {
    await page.goto('/login')

    // Check that test credentials are shown
    await expect(page.getByText(/admin@talentos.local/i)).toBeVisible()
    await expect(page.getByText(/candidate1@example.com/i)).toBeVisible()
  })
})

test.describe('Navigation Tests', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })

  test('home page should redirect', async ({ page }) => {
    await page.goto('/')

    // Should redirect somewhere (login or dashboard)
    await expect(page.url()).not.toBe('http://localhost:3000/')
  })
})

test.describe('Register Page', () => {
  test('should show role selection', async ({ page }) => {
    await page.goto('/register')

    await expect(page.getByLabel(/tipo de cuenta/i)).toBeVisible()
  })

  test('should show company field for employer role', async ({ page }) => {
    await page.goto('/register')

    // Select employer role
    await page.getByLabel(/tipo de cuenta/i).click()
    await page.getByRole('option', { name: /empresa/i }).click()

    // Company field should appear
    await expect(page.getByLabel(/nombre de la empresa/i)).toBeVisible()
  })
})
