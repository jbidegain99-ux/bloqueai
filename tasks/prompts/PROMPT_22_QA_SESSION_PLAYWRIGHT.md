# 🧪 Prompt 22: QA Session Extensiva - Playwright E2E Testing

---

## 🔴 METODOLOGÍA DE TRABAJO (LEER PRIMERO)

### Antes de Empezar
```bash
# 1. Leer backlog actual
cat tasks/todo.md

# 2. Leer lecciones aprendidas
cat tasks/lessons.md

# 3. Verificar que dev servers funcionan
cd apps/web && npm run dev &
cd apps/api && uvicorn app.main:app --reload &
```

### Workflow Orchestration

#### 1. Plan Mode Default
- Entrar en plan mode para CUALQUIER tarea no trivial (3+ pasos o decisiones arquitectónicas)
- Si algo sale mal, PARAR y re-planear inmediatamente — no seguir empujando
- Usar plan mode para pasos de verificación, no solo para construir
- Escribir specs detallados upfront para reducir ambigüedad

#### 2. Self-Improvement Loop
- Después de CUALQUIER corrección del usuario: actualizar `tasks/lessons.md` con el patrón
- Escribir reglas para ti mismo que prevengan el mismo error

#### 3. Verification Before Done
- NUNCA marcar una tarea como completa sin probar que funciona
- Correr tests, revisar logs, demostrar correctitud

#### 4. Autonomous Bug Fixing
- Cuando encuentres un bug: documéntalo Y arréglalo
- Cero context switching requerido del usuario

### Core Principles
- **Simplicity First**: Tests claros y mantenibles
- **No Laziness**: Cobertura completa, no atajos
- **Minimal Impact**: Tests no deben romper funcionalidad existente

---

## 🎯 Tu Rol

**Eres un QA Engineer Senior con 10+ años de experiencia** en testing de aplicaciones SaaS enterprise. Has trabajado en empresas como Google, Stripe, y Workday. Tu estándar de calidad es implacable.

### Tu Mentalidad:
- "Si no está testeado, está roto"
- "Los edge cases son donde viven los bugs"
- "Un test flaky es peor que no tener test"
- "La cobertura del happy path es solo el 20% del trabajo"
- "Cada bug encontrado en producción es un fracaso del QA"

### Tu Enfoque:
1. **Primero explorar** - Navegar manualmente para entender los flujos
2. **Documentar todo** - Cada bug, cada inconsistencia, cada mejora
3. **Tests determinísticos** - Cero flakiness, 100% reproducibles
4. **Cobertura completa** - Happy paths, edge cases, error states, permisos

---

## 📋 Contexto de TalentOS

### Módulos Construidos

| Módulo | Descripción | Usuarios |
|--------|-------------|----------|
| **Auth** | Login, registro, recuperar contraseña, roles | Todos |
| **Landing** | Página pública, pricing | Público |
| **Dashboard Candidate** | Perfil, aplicaciones, entrevistas | Candidate |
| **Dashboard Employer** | Vacantes, candidatos, pipeline, EOR | Employer |
| **Dashboard Admin** | Gestión global, usuarios, métricas | Admin |
| **Análisis CV** | Upload, parsing, scoring con IA | Candidate/Employer |
| **Motor de Match** | Matching candidato-vacante | Sistema |
| **EOR El Salvador** | Empleados, nómina, contratos, calculadora | Employer |
| **Billing** | Planes, suscripciones, facturas, feature gating | Employer |

### Cuentas de Test
```
Admin:     admin@example.com / Admin123!
Employer:  employer@example.com / Employer123!
Candidate: candidate1@example.com / Candidate123!
```

### URLs
- **Frontend:** http://localhost:3000 (dev) | https://bloqueai-ia.vercel.app (prod)
- **Backend:** http://localhost:8000 (dev) | https://bloqueai-api.vercel.app (prod)
- **Calculadora EOR:** /calculator

---

## ✅ Tareas de QA

### Fase 1: Setup de Testing Infrastructure

#### T22.1: Configurar Playwright
```bash
cd apps/web
npm init playwright@latest
```

Configuración recomendada en `playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

#### T22.2: Crear estructura de carpetas
```
apps/web/e2e/
├── fixtures/
│   ├── auth.fixture.ts      # Login helpers
│   ├── test-data.ts         # Datos de prueba
│   └── api.fixture.ts       # API mocking si necesario
├── pages/
│   ├── login.page.ts        # Page Object Model
│   ├── dashboard.page.ts
│   ├── employer/
│   │   ├── vacancies.page.ts
│   │   ├── candidates.page.ts
│   │   ├── eor.page.ts
│   │   └── billing.page.ts
│   └── candidate/
│       ├── profile.page.ts
│       └── applications.page.ts
├── tests/
│   ├── auth/
│   ├── employer/
│   ├── candidate/
│   ├── admin/
│   ├── eor/
│   ├── billing/
│   └── public/
└── utils/
    ├── helpers.ts
    └── assertions.ts
```

#### T22.3: Crear Auth Fixture
```typescript
// apps/web/e2e/fixtures/auth.fixture.ts

import { test as base, Page } from '@playwright/test';

type UserRole = 'admin' | 'employer' | 'candidate';

interface AuthFixture {
  loginAs: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const credentials: Record<UserRole, { email: string; password: string }> = {
  admin: { email: 'admin@example.com', password: 'Admin123!' },
  employer: { email: 'employer@example.com', password: 'Employer123!' },
  candidate: { email: 'candidate1@example.com', password: 'Candidate123!' },
};

export const test = base.extend<AuthFixture>({
  loginAs: async ({ page }, use) => {
    const login = async (role: UserRole) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      const { email, password } = credentials[role];
      
      await page.fill('[data-testid="email-input"], input[type="email"], input[name="email"]', email);
      await page.fill('[data-testid="password-input"], input[type="password"], input[name="password"]', password);
      await page.click('[data-testid="login-button"], button[type="submit"]');
      
      // Esperar redirección al dashboard
      await page.waitForURL(/\/(admin|employer|candidate)/, { timeout: 10000 });
    };
    
    await use(login);
  },
  
  logout: async ({ page }, use) => {
    const logout = async () => {
      // Buscar botón de logout en diferentes ubicaciones
      const logoutButton = page.locator('[data-testid="logout-button"], button:has-text("Cerrar sesión"), button:has-text("Logout")');
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      }
      await page.waitForURL('/login');
    };
    
    await use(logout);
  },
});

export { expect } from '@playwright/test';
```

---

### Fase 2: Tests de Autenticación

#### T22.4: Auth Tests
```typescript
// apps/web/e2e/tests/auth/login.spec.ts

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Authentication', () => {
  
  test.describe('Login Page', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
    });
    
    test('should display login form', async ({ page }) => {
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });
    
    test('should show error for invalid credentials', async ({ page }) => {
      await page.fill('input[type="email"]', 'wrong@email.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      await expect(page.locator('[role="alert"], .error, .toast-error')).toBeVisible({ timeout: 5000 });
    });
    
    test('should show validation errors for empty fields', async ({ page }) => {
      await page.click('button[type="submit"]');
      
      // Verificar que hay errores de validación
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });
    
    test('should login as admin and redirect to admin dashboard', async ({ page, loginAs }) => {
      await loginAs('admin');
      await expect(page).toHaveURL(/\/admin/);
    });
    
    test('should login as employer and redirect to employer dashboard', async ({ page, loginAs }) => {
      await loginAs('employer');
      await expect(page).toHaveURL(/\/employer/);
    });
    
    test('should login as candidate and redirect to candidate dashboard', async ({ page, loginAs }) => {
      await loginAs('candidate');
      await expect(page).toHaveURL(/\/candidate/);
    });
    
    test('should persist session after page reload', async ({ page, loginAs }) => {
      await loginAs('employer');
      await page.reload();
      await expect(page).toHaveURL(/\/employer/);
    });
    
  });
  
  test.describe('Registration', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.goto('/register');
    });
    
    test('should display registration form', async ({ page }) => {
      await expect(page.locator('input[name="name"], input[name="firstName"]')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });
    
    test('should validate email format', async ({ page }) => {
      await page.fill('input[type="email"]', 'invalid-email');
      await page.click('button[type="submit"]');
      
      // Esperar error de validación
      await expect(page.locator('text=/email|correo/i')).toBeVisible();
    });
    
    test('should validate password strength', async ({ page }) => {
      await page.fill('input[type="password"]', '123');
      await page.click('button[type="submit"]');
      
      // Esperar error de contraseña débil
      await expect(page.locator('text=/password|contraseña/i')).toBeVisible();
    });
    
  });
  
  test.describe('Password Recovery', () => {
    
    test('should display forgot password link', async ({ page }) => {
      await page.goto('/login');
      await expect(page.locator('a:has-text("Olvidé"), a:has-text("Forgot")')).toBeVisible();
    });
    
    test('should navigate to password recovery page', async ({ page }) => {
      await page.goto('/login');
      await page.click('a:has-text("Olvidé"), a:has-text("Forgot")');
      await expect(page).toHaveURL(/forgot|recovery|reset/);
    });
    
  });
  
  test.describe('Logout', () => {
    
    test('should logout and redirect to login', async ({ page, loginAs, logout }) => {
      await loginAs('employer');
      await logout();
      await expect(page).toHaveURL(/\/login/);
    });
    
    test('should clear session after logout', async ({ page, loginAs, logout }) => {
      await loginAs('employer');
      await logout();
      
      // Intentar acceder a ruta protegida
      await page.goto('/employer');
      await expect(page).toHaveURL(/\/login/);
    });
    
  });
  
});
```

---

### Fase 3: Tests de Employer Dashboard

#### T22.5: Employer Dashboard Tests
```typescript
// apps/web/e2e/tests/employer/dashboard.spec.ts

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Employer Dashboard', () => {
  
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('employer');
  });
  
  test.describe('Navigation', () => {
    
    test('should display sidebar with all menu items', async ({ page }) => {
      const menuItems = [
        'Dashboard',
        'Vacantes',
        'Candidatos',
        'EOR',
        'Facturación',
      ];
      
      for (const item of menuItems) {
        await expect(page.locator(`nav >> text=${item}`).first()).toBeVisible();
      }
    });
    
    test('should navigate to vacancies page', async ({ page }) => {
      await page.click('nav >> text=Vacantes');
      await expect(page).toHaveURL(/\/employer\/vacancies|\/employer\/positions/);
    });
    
    test('should navigate to candidates page', async ({ page }) => {
      await page.click('nav >> text=Candidatos');
      await expect(page).toHaveURL(/\/employer\/candidates/);
    });
    
    test('should navigate to EOR page', async ({ page }) => {
      await page.click('nav >> text=EOR');
      await expect(page).toHaveURL(/\/employer\/eor/);
    });
    
    test('should navigate to billing page', async ({ page }) => {
      await page.click('nav >> text=Facturación');
      await expect(page).toHaveURL(/\/employer\/settings\/billing/);
    });
    
  });
  
  test.describe('Dashboard Metrics', () => {
    
    test('should display metric cards', async ({ page }) => {
      await page.goto('/employer');
      
      // Verificar que hay cards de métricas
      const metricCards = page.locator('[data-testid="metric-card"], .metric-card, .stat-card');
      await expect(metricCards.first()).toBeVisible();
    });
    
    test('should display recent activity', async ({ page }) => {
      await page.goto('/employer');
      
      // Buscar sección de actividad reciente
      await expect(page.locator('text=/actividad|activity|reciente/i').first()).toBeVisible();
    });
    
  });
  
});
```

#### T22.6: Vacancies Tests
```typescript
// apps/web/e2e/tests/employer/vacancies.spec.ts

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Employer Vacancies', () => {
  
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('employer');
    await page.goto('/employer/vacancies');
    await page.waitForLoadState('networkidle');
  });
  
  test.describe('Vacancies List', () => {
    
    test('should display vacancies list or empty state', async ({ page }) => {
      const hasList = await page.locator('table, [data-testid="vacancies-list"]').isVisible();
      const hasEmptyState = await page.locator('text=/no hay|no tienes|empty|crear primera/i').isVisible();
      
      expect(hasList || hasEmptyState).toBeTruthy();
    });
    
    test('should have create vacancy button', async ({ page }) => {
      await expect(page.locator('button:has-text("Crear"), button:has-text("Nueva"), a:has-text("Crear")')).toBeVisible();
    });
    
  });
  
  test.describe('Create Vacancy', () => {
    
    test('should open create vacancy form', async ({ page }) => {
      await page.click('button:has-text("Crear"), button:has-text("Nueva"), a:has-text("Crear")');
      
      // Verificar que el formulario o modal está visible
      await expect(page.locator('form, [role="dialog"]')).toBeVisible();
    });
    
    test('should validate required fields', async ({ page }) => {
      await page.click('button:has-text("Crear"), button:has-text("Nueva")');
      
      // Intentar submit sin llenar campos
      await page.click('button[type="submit"], button:has-text("Guardar"), button:has-text("Crear")');
      
      // Verificar errores de validación
      await expect(page.locator('[aria-invalid="true"], .error, .text-red')).toBeVisible();
    });
    
    test('should create vacancy successfully', async ({ page }) => {
      await page.click('button:has-text("Crear"), button:has-text("Nueva")');
      
      // Llenar formulario
      await page.fill('input[name="title"], input[name="name"]', 'Test QA Engineer');
      await page.fill('textarea[name="description"]', 'This is a test vacancy created by Playwright E2E tests.');
      
      // Seleccionar tipo de trabajo si existe
      const workTypeSelect = page.locator('select[name="workType"], [data-testid="work-type"]');
      if (await workTypeSelect.isVisible()) {
        await workTypeSelect.selectOption({ index: 1 });
      }
      
      // Submit
      await page.click('button[type="submit"], button:has-text("Guardar")');
      
      // Verificar éxito
      await expect(page.locator('text=/creada|success|éxito/i')).toBeVisible({ timeout: 10000 });
    });
    
  });
  
});
```

#### T22.7: EOR Module Tests
```typescript
// apps/web/e2e/tests/employer/eor.spec.ts

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('EOR Module - El Salvador', () => {
  
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('employer');
  });
  
  test.describe('EOR Dashboard', () => {
    
    test('should display EOR dashboard', async ({ page }) => {
      await page.goto('/employer/eor');
      await page.waitForLoadState('networkidle');
      
      // Verificar que la página carga
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
    
    test('should display employee list or empty state', async ({ page }) => {
      await page.goto('/employer/eor');
      
      const hasList = await page.locator('table, [data-testid="employees-list"]').isVisible();
      const hasEmptyState = await page.locator('text=/no hay|no tienes|empty|agregar/i').isVisible();
      
      expect(hasList || hasEmptyState).toBeTruthy();
    });
    
    test('should have add employee button', async ({ page }) => {
      await page.goto('/employer/eor');
      
      await expect(page.locator('button:has-text("Agregar"), button:has-text("Nuevo"), a:has-text("Agregar")')).toBeVisible();
    });
    
  });
  
  test.describe('Add Employee Wizard', () => {
    
    test('should open employee wizard', async ({ page }) => {
      await page.goto('/employer/eor');
      await page.click('button:has-text("Agregar"), a:has-text("Agregar")');
      
      await expect(page).toHaveURL(/\/employer\/eor\/new/);
    });
    
    test('should display step 1 - personal data', async ({ page }) => {
      await page.goto('/employer/eor/new');
      
      await expect(page.locator('input[name="firstName"], input[name="nombre"]')).toBeVisible();
      await expect(page.locator('input[name="lastName"], input[name="apellido"]')).toBeVisible();
      await expect(page.locator('input[name="dui"]')).toBeVisible();
    });
    
    test('should validate DUI format (El Salvador)', async ({ page }) => {
      await page.goto('/employer/eor/new');
      
      await page.fill('input[name="dui"]', '12345'); // Formato incorrecto
      await page.click('button:has-text("Siguiente"), button:has-text("Next")');
      
      // Debe mostrar error de formato DUI
      await expect(page.locator('text=/DUI|formato|inválido/i')).toBeVisible();
    });
    
    test('should accept valid DUI format', async ({ page }) => {
      await page.goto('/employer/eor/new');
      
      await page.fill('input[name="firstName"], input[name="nombre"]', 'Juan');
      await page.fill('input[name="lastName"], input[name="apellido"]', 'Pérez');
      await page.fill('input[name="dui"]', '12345678-9');
      await page.fill('input[name="email"]', 'juan.perez@test.com');
      
      await page.click('button:has-text("Siguiente"), button:has-text("Next")');
      
      // Debe avanzar al paso 2
      await expect(page.locator('text=/laboral|puesto|salario/i')).toBeVisible();
    });
    
    test('should complete full wizard flow', async ({ page }) => {
      await page.goto('/employer/eor/new');
      
      // Paso 1: Datos personales
      await page.fill('input[name="firstName"], input[name="nombre"]', 'Test');
      await page.fill('input[name="lastName"], input[name="apellido"]', 'Employee');
      await page.fill('input[name="dui"]', '00000000-0');
      await page.fill('input[name="email"]', `test${Date.now()}@example.com`);
      await page.click('button:has-text("Siguiente")');
      
      // Paso 2: Datos laborales
      await page.waitForTimeout(500);
      await page.fill('input[name="position"], input[name="puesto"]', 'Developer');
      await page.fill('input[name="salary"], input[name="salario"]', '1500');
      await page.click('button:has-text("Siguiente")');
      
      // Paso 3: Seguro social y banco
      await page.waitForTimeout(500);
      const afpSelect = page.locator('select[name="afp"]');
      if (await afpSelect.isVisible()) {
        await afpSelect.selectOption({ index: 1 });
      }
      await page.click('button:has-text("Siguiente")');
      
      // Paso 4: Revisión y confirmación
      await page.waitForTimeout(500);
      await expect(page.locator('text=/resumen|confirmar|revisar/i')).toBeVisible();
    });
    
  });
  
  test.describe('Payroll Calculator', () => {
    
    test('should display payroll calculation', async ({ page }) => {
      await page.goto('/employer/eor');
      
      // Si hay empleados, debe mostrar cálculos de nómina
      const hasEmployees = await page.locator('table tbody tr').count() > 0;
      
      if (hasEmployees) {
        await expect(page.locator('text=/ISSS|AFP|ISR|neto/i').first()).toBeVisible();
      }
    });
    
  });
  
});

test.describe('Public EOR Calculator', () => {
  
  test('should display calculator page', async ({ page }) => {
    await page.goto('/calculator');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
  
  test('should calculate costs for given salary', async ({ page }) => {
    await page.goto('/calculator');
    
    // Input de salario
    const salaryInput = page.locator('input[type="number"], input[name="salary"]');
    await salaryInput.fill('1000');
    
    // Trigger cálculo (blur o click en calcular)
    await salaryInput.blur();
    await page.waitForTimeout(500);
    
    // Verificar que muestra resultados
    await expect(page.locator('text=/ISSS|AFP|total|costo/i').first()).toBeVisible();
  });
  
  test('should show breakdown of costs', async ({ page }) => {
    await page.goto('/calculator');
    
    await page.fill('input[type="number"], input[name="salary"]', '2000');
    await page.locator('input[type="number"]').blur();
    await page.waitForTimeout(500);
    
    // Verificar desglose
    const expectedItems = ['ISSS', 'AFP'];
    for (const item of expectedItems) {
      await expect(page.locator(`text=${item}`).first()).toBeVisible();
    }
  });
  
  test('should have CTA to register/contact', async ({ page }) => {
    await page.goto('/calculator');
    
    await expect(page.locator('button:has-text("Comenzar"), a:has-text("Comenzar"), button:has-text("Contactar")')).toBeVisible();
  });
  
});
```

#### T22.8: Billing Tests
```typescript
// apps/web/e2e/tests/employer/billing.spec.ts

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Billing Module', () => {
  
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('employer');
  });
  
  test.describe('Billing Dashboard', () => {
    
    test('should display billing page', async ({ page }) => {
      await page.goto('/employer/settings/billing');
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
    
    test('should display current plan', async ({ page }) => {
      await page.goto('/employer/settings/billing');
      
      await expect(page.locator('text=/plan|Free|Growth|Professional/i').first()).toBeVisible();
    });
    
    test('should display usage metrics', async ({ page }) => {
      await page.goto('/employer/settings/billing');
      
      // Buscar barras de uso o métricas
      await expect(page.locator('text=/posiciones|usuarios|uso/i').first()).toBeVisible();
    });
    
    test('should have upgrade button', async ({ page }) => {
      await page.goto('/employer/settings/billing');
      
      await expect(page.locator('button:has-text("Cambiar"), a:has-text("Upgrade"), button:has-text("Mejorar")')).toBeVisible();
    });
    
  });
  
  test.describe('Invoices', () => {
    
    test('should display invoices section', async ({ page }) => {
      await page.goto('/employer/settings/billing');
      
      await expect(page.locator('text=/facturas|invoices|historial/i').first()).toBeVisible();
    });
    
    test('should show empty state or invoice list', async ({ page }) => {
      await page.goto('/employer/settings/billing');
      
      const hasInvoices = await page.locator('table tbody tr, [data-testid="invoice-row"]').count() > 0;
      const hasEmptyState = await page.locator('text=/no hay facturas|no invoices/i').isVisible();
      
      expect(hasInvoices || hasEmptyState).toBeTruthy();
    });
    
  });
  
});

test.describe('Public Pricing Page', () => {
  
  test('should display pricing page', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('h1').first()).toBeVisible();
  });
  
  test('should display all 4 plans', async ({ page }) => {
    await page.goto('/pricing');
    
    const plans = ['Free', 'Growth', 'Professional', 'Enterprise'];
    for (const plan of plans) {
      await expect(page.locator(`text=${plan}`).first()).toBeVisible();
    }
  });
  
  test('should toggle between monthly and yearly billing', async ({ page }) => {
    await page.goto('/pricing');
    
    const toggle = page.locator('button:has-text("Anual"), button:has-text("Yearly")');
    if (await toggle.isVisible()) {
      await toggle.click();
      
      // Verificar que los precios cambian (descuento anual)
      await expect(page.locator('text=/-20%|descuento|save/i').first()).toBeVisible();
    }
  });
  
  test('should have CTA buttons for each plan', async ({ page }) => {
    await page.goto('/pricing');
    
    const ctaButtons = page.locator('button:has-text("Comenzar"), button:has-text("Iniciar"), a:has-text("Contactar")');
    await expect(ctaButtons.first()).toBeVisible();
  });
  
});
```

---

### Fase 4: Tests de Candidate Dashboard

#### T22.9: Candidate Tests
```typescript
// apps/web/e2e/tests/candidate/dashboard.spec.ts

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Candidate Dashboard', () => {
  
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('candidate');
  });
  
  test.describe('Profile', () => {
    
    test('should display candidate profile', async ({ page }) => {
      await page.goto('/candidate/profile');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
    
    test('should allow editing profile', async ({ page }) => {
      await page.goto('/candidate/profile');
      
      const editButton = page.locator('button:has-text("Editar"), button:has-text("Edit")');
      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.locator('form, input[name="name"]')).toBeVisible();
      }
    });
    
  });
  
  test.describe('CV Upload', () => {
    
    test('should display CV upload area', async ({ page }) => {
      await page.goto('/candidate/profile');
      
      await expect(page.locator('input[type="file"], [data-testid="cv-upload"], text=/subir|upload|CV/i').first()).toBeVisible();
    });
    
    test('should show uploaded CV if exists', async ({ page }) => {
      await page.goto('/candidate/profile');
      
      const hasCV = await page.locator('text=/CV|resume|currículum/i').first().isVisible();
      expect(hasCV).toBeTruthy();
    });
    
  });
  
  test.describe('Applications', () => {
    
    test('should display applications page', async ({ page }) => {
      await page.goto('/candidate/applications');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
    
    test('should show applications list or empty state', async ({ page }) => {
      await page.goto('/candidate/applications');
      
      const hasList = await page.locator('table, [data-testid="applications-list"]').isVisible();
      const hasEmptyState = await page.locator('text=/no hay|no tienes|sin aplicaciones/i').isVisible();
      
      expect(hasList || hasEmptyState).toBeTruthy();
    });
    
  });
  
  test.describe('Job Search', () => {
    
    test('should display available jobs', async ({ page }) => {
      await page.goto('/candidate/jobs');
      
      const hasJobs = await page.locator('[data-testid="job-card"], .job-card').count() > 0;
      const hasEmptyState = await page.locator('text=/no hay vacantes|no jobs/i').isVisible();
      
      expect(hasJobs || hasEmptyState).toBeTruthy();
    });
    
    test('should allow searching/filtering jobs', async ({ page }) => {
      await page.goto('/candidate/jobs');
      
      const searchInput = page.locator('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="Search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('Developer');
        await page.waitForTimeout(500);
        // Verificar que la lista se actualiza
      }
    });
    
  });
  
});
```

---

### Fase 5: Tests de Admin Dashboard

#### T22.10: Admin Tests
```typescript
// apps/web/e2e/tests/admin/dashboard.spec.ts

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Admin Dashboard', () => {
  
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin');
  });
  
  test.describe('Dashboard Overview', () => {
    
    test('should display admin dashboard', async ({ page }) => {
      await page.goto('/admin');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
    
    test('should display global metrics', async ({ page }) => {
      await page.goto('/admin');
      
      // Métricas esperadas: usuarios, empresas, vacantes, candidatos
      await expect(page.locator('[data-testid="metric-card"], .metric-card, .stat').first()).toBeVisible();
    });
    
  });
  
  test.describe('User Management', () => {
    
    test('should display users list', async ({ page }) => {
      await page.goto('/admin/users');
      
      await expect(page.locator('table, [data-testid="users-list"]')).toBeVisible();
    });
    
    test('should allow searching users', async ({ page }) => {
      await page.goto('/admin/users');
      
      const searchInput = page.locator('input[type="search"], input[placeholder*="Buscar"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('employer');
        await page.waitForTimeout(500);
      }
    });
    
  });
  
  test.describe('Companies Management', () => {
    
    test('should display companies list', async ({ page }) => {
      await page.goto('/admin/companies');
      
      const hasList = await page.locator('table, [data-testid="companies-list"]').isVisible();
      expect(hasList).toBeTruthy();
    });
    
  });
  
});
```

---

### Fase 6: Tests de Responsive y Accesibilidad

#### T22.11: Responsive Tests
```typescript
// apps/web/e2e/tests/responsive/mobile.spec.ts

import { test, expect, devices } from '@playwright/test';

const mobileDevice = devices['iPhone 12'];

test.describe('Mobile Responsiveness', () => {
  
  test.use({ ...mobileDevice });
  
  test('landing page should be responsive', async ({ page }) => {
    await page.goto('/');
    
    // Verificar que no hay overflow horizontal
    const body = await page.locator('body').boundingBox();
    expect(body?.width).toBeLessThanOrEqual(mobileDevice.viewport.width + 1);
  });
  
  test('login page should be usable on mobile', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Verificar que los inputs son tocables
    const emailInput = await page.locator('input[type="email"]').boundingBox();
    expect(emailInput?.height).toBeGreaterThanOrEqual(44); // Mínimo touch target
  });
  
  test('pricing page should stack cards on mobile', async ({ page }) => {
    await page.goto('/pricing');
    
    // Las cards deben estar apiladas verticalmente
    const cards = page.locator('[class*="pricing"], [class*="plan-card"]');
    const cardCount = await cards.count();
    
    if (cardCount > 1) {
      const firstCard = await cards.first().boundingBox();
      const secondCard = await cards.nth(1).boundingBox();
      
      // En mobile, las cards deben estar una debajo de otra
      expect(secondCard?.y).toBeGreaterThan(firstCard?.y || 0);
    }
  });
  
  test('navigation should have mobile menu', async ({ page }) => {
    await page.goto('/');
    
    // Buscar hamburger menu
    const mobileMenu = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"], .hamburger');
    await expect(mobileMenu).toBeVisible();
  });
  
});
```

#### T22.12: Accessibility Tests
```typescript
// apps/web/e2e/tests/accessibility/a11y.spec.ts

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  
  test('landing page should have no critical accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations.filter(v => v.impact === 'critical')).toHaveLength(0);
  });
  
  test('login page should be accessible', async ({ page }) => {
    await page.goto('/login');
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    // Log violations for debugging
    if (results.violations.length > 0) {
      console.log('Accessibility violations:', results.violations);
    }
    
    expect(results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toHaveLength(0);
  });
  
  test('pricing page should be accessible', async ({ page }) => {
    await page.goto('/pricing');
    
    const results = await new AxeBuilder({ page }).analyze();
    
    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0);
  });
  
  test('forms should have proper labels', async ({ page }) => {
    await page.goto('/login');
    
    const inputs = await page.locator('input').all();
    
    for (const input of inputs) {
      const hasLabel = await input.getAttribute('aria-label') ||
                       await input.getAttribute('aria-labelledby') ||
                       await input.getAttribute('id');
      
      expect(hasLabel).toBeTruthy();
    }
  });
  
  test('buttons should have accessible names', async ({ page }) => {
    await page.goto('/');
    
    const buttons = await page.locator('button').all();
    
    for (const button of buttons) {
      const accessibleName = await button.getAttribute('aria-label') ||
                             await button.innerText();
      
      expect(accessibleName?.trim().length).toBeGreaterThan(0);
    }
  });
  
  test('images should have alt text', async ({ page }) => {
    await page.goto('/');
    
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      
      // Debe tener alt o ser decorativa (role="presentation")
      expect(alt !== null || role === 'presentation').toBeTruthy();
    }
  });
  
});
```

---

### Fase 7: Tests de API

#### T22.13: API Integration Tests
```typescript
// apps/web/e2e/tests/api/billing-api.spec.ts

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8000';

test.describe('Billing API', () => {
  
  test('GET /billing/plans should return all plans', async ({ request }) => {
    const response = await request.get(`${API_BASE}/billing/plans`);
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.plans).toBeDefined();
    expect(data.plans.length).toBeGreaterThanOrEqual(4);
    
    // Verificar estructura de plan
    const plan = data.plans[0];
    expect(plan).toHaveProperty('tier');
    expect(plan).toHaveProperty('name');
    expect(plan).toHaveProperty('price_monthly');
    expect(plan).toHaveProperty('features');
  });
  
  test('GET /billing/plans should include all tiers', async ({ request }) => {
    const response = await request.get(`${API_BASE}/billing/plans`);
    const data = await response.json();
    
    const tiers = data.plans.map((p: any) => p.tier);
    expect(tiers).toContain('free');
    expect(tiers).toContain('growth');
    expect(tiers).toContain('professional');
  });
  
});

test.describe('Auth API', () => {
  
  test('POST /auth/login should return token for valid credentials', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: 'employer@example.com',
        password: 'Employer123!',
      },
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.access_token || data.token).toBeDefined();
  });
  
  test('POST /auth/login should reject invalid credentials', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: 'wrong@email.com',
        password: 'wrongpassword',
      },
    });
    
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(401);
  });
  
});

test.describe('EOR Calculator API', () => {
  
  test('GET /eor/calculator should calculate payroll', async ({ request }) => {
    const response = await request.get(`${API_BASE}/eor/calculator`, {
      params: {
        salary: 1000,
        country: 'SV',
      },
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('gross_salary');
    expect(data).toHaveProperty('isss_employee');
    expect(data).toHaveProperty('afp_employee');
    expect(data).toHaveProperty('net_salary');
    expect(data).toHaveProperty('total_employer_cost');
  });
  
});
```

---

### Fase 8: Bug Tracking y Reporte

#### T22.14: Crear Bug Report Template
```typescript
// apps/web/e2e/utils/bug-reporter.ts

interface Bug {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  module: string;
  steps: string[];
  expected: string;
  actual: string;
  screenshot?: string;
  url: string;
  browser: string;
  timestamp: string;
}

export class BugReporter {
  private bugs: Bug[] = [];
  
  addBug(bug: Omit<Bug, 'id' | 'timestamp'>) {
    this.bugs.push({
      ...bug,
      id: `BUG-${Date.now()}`,
      timestamp: new Date().toISOString(),
    });
  }
  
  generateReport(): string {
    let report = '# 🐛 Bug Report - TalentOS QA Session\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    report += `Total bugs found: ${this.bugs.length}\n\n`;
    
    const bySeverity = {
      critical: this.bugs.filter(b => b.severity === 'critical'),
      high: this.bugs.filter(b => b.severity === 'high'),
      medium: this.bugs.filter(b => b.severity === 'medium'),
      low: this.bugs.filter(b => b.severity === 'low'),
    };
    
    report += `## Summary\n`;
    report += `- 🔴 Critical: ${bySeverity.critical.length}\n`;
    report += `- 🟠 High: ${bySeverity.high.length}\n`;
    report += `- 🟡 Medium: ${bySeverity.medium.length}\n`;
    report += `- 🟢 Low: ${bySeverity.low.length}\n\n`;
    
    for (const bug of this.bugs) {
      report += `---\n\n`;
      report += `### ${bug.id}: ${bug.title}\n\n`;
      report += `**Severity:** ${bug.severity}\n`;
      report += `**Module:** ${bug.module}\n`;
      report += `**URL:** ${bug.url}\n\n`;
      report += `**Steps to Reproduce:**\n`;
      bug.steps.forEach((step, i) => {
        report += `${i + 1}. ${step}\n`;
      });
      report += `\n**Expected:** ${bug.expected}\n`;
      report += `**Actual:** ${bug.actual}\n\n`;
    }
    
    return report;
  }
  
  getBugs() {
    return this.bugs;
  }
}
```

---

## ✅ Checklist de Verificación Final

### Setup
- [ ] Playwright instalado y configurado
- [ ] Estructura de carpetas creada
- [ ] Auth fixture funcionando
- [ ] Page objects creados

### Tests por Módulo
- [ ] Auth: Login, Register, Logout, Password Recovery
- [ ] Employer Dashboard: Navigation, Metrics
- [ ] Vacancies: List, Create, Edit, Delete
- [ ] EOR: Dashboard, Add Employee, Wizard, Calculator
- [ ] Billing: Dashboard, Plans, Invoices
- [ ] Candidate: Profile, CV Upload, Applications, Job Search
- [ ] Admin: Dashboard, Users, Companies
- [ ] Public: Landing, Pricing, Calculator

### Calidad
- [ ] Tests responsive (mobile, tablet, desktop)
- [ ] Tests de accesibilidad (axe-core)
- [ ] Tests de API
- [ ] Cero tests flaky
- [ ] Screenshots en failures
- [ ] Video recording habilitado

### Reporte
- [ ] Bug report generado
- [ ] Bugs clasificados por severidad
- [ ] Screenshots adjuntos
- [ ] Pasos de reproducción claros

---

## 📝 Output Esperado

```markdown
## QA Session Report - TalentOS

### Test Results
- Total tests: XX
- Passed: XX ✅
- Failed: XX ❌
- Skipped: XX ⏭️

### Coverage by Module
| Module | Tests | Pass Rate |
|--------|-------|-----------|
| Auth | X | XX% |
| Employer | X | XX% |
| Candidate | X | XX% |
| Admin | X | XX% |
| EOR | X | XX% |
| Billing | X | XX% |
| Public | X | XX% |

### Bugs Found
- 🔴 Critical: X
- 🟠 High: X
- 🟡 Medium: X
- 🟢 Low: X

### Recommendations
1. [Lista de mejoras sugeridas]

### Files Created
- apps/web/e2e/... (XX files)
- apps/web/playwright.config.ts
- test-results/report.html
```

---

## 🚨 Cuando Termines

1. **Actualizar `tasks/todo.md`** con resultados de QA

2. **Crear `tasks/QA_REPORT.md`** con:
   - Bugs encontrados
   - Tests creados
   - Cobertura
   - Recomendaciones

3. **Actualizar `tasks/lessons.md`** con cualquier patrón de bugs encontrado

4. **Commit**:
```bash
git add .
git commit -m "test: add comprehensive E2E tests with Playwright"
git push
```

5. **Ejecutar tests y compartir reporte**:
```bash
cd apps/web
npx playwright test
npx playwright show-report
```
