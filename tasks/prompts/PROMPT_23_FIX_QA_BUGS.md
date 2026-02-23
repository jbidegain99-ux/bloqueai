# 🐛 Prompt 23: Fix All QA Bugs

---

## 🔴 METODOLOGÍA DE TRABAJO (LEER PRIMERO)

### Antes de Empezar
```bash
# 1. Leer backlog actual
cat tasks/todo.md

# 2. Leer lecciones aprendidas
cat tasks/lessons.md

# 3. Leer reporte de QA
cat tasks/QA_REPORT.md
```

### Core Principles
- **Simplicity First**: Fixes mínimos y elegantes
- **No Laziness**: Encontrar root causes, no parches
- **Minimal Impact**: No introducir nuevos bugs
- **Verification**: Correr tests después de cada fix

---

## 🎯 Objetivo

Arreglar los **5 bugs** encontrados en la sesión de QA E2E, en orden de severidad.

---

## 🔴 BUG-C01: Zustand Hydration Race Condition (CRITICAL)

### Problema
`useAuthStore` usa zustand persist con localStorage. En navegación directa (page.goto, reload, URL directa), Next.js SSR renderiza con `isAuthenticated: false` antes de que zustand hidrate desde localStorage. El `useEffect` del auth guard dispara con estado no-hidratado y redirige a `/login`.

### Impacto
Usuarios que navegan directamente a URLs protegidas (bookmark, refresh, back/forward) son redirigidos a login aunque su sesión es válida.

### Archivo
`apps/web/src/lib/auth.ts`

### Fix
Implementar patrón `useHydration()` para prevenir checks de auth antes de que zustand complete la hidratación.

```typescript
// apps/web/src/lib/auth.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useEffect, useState } from 'react';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean; // AGREGAR
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  setHydrated: () => void; // AGREGAR
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: false, // AGREGAR - empieza en false
      
      setAuth: (user, token) => set({ 
        user, 
        token, 
        isAuthenticated: true 
      }),
      
      logout: () => set({ 
        user: null, 
        token: null, 
        isAuthenticated: false 
      }),
      
      setHydrated: () => set({ isHydrated: true }), // AGREGAR
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Cuando zustand termina de hidratar, marcar como hidratado
        state?.setHydrated();
      },
    }
  )
);

// Hook para usar en componentes protegidos
export function useAuthHydrated() {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  return {
    isHydrated,
    isAuthenticated,
    isReady: isHydrated, // Solo hacer checks cuando está hidratado
  };
}
```

### Actualizar Auth Guards
En cada página protegida o layout que tenga auth guard:

```typescript
// Antes (MALO)
useEffect(() => {
  if (!isAuthenticated) {
    router.push('/login');
  }
}, [isAuthenticated]);

// Después (BUENO)
const { isHydrated, isAuthenticated } = useAuthHydrated();

useEffect(() => {
  // Solo redirigir si ya hidratamos Y no está autenticado
  if (isHydrated && !isAuthenticated) {
    router.push('/login');
  }
}, [isHydrated, isAuthenticated]);

// Mostrar loading mientras hidrata
if (!isHydrated) {
  return <LoadingSpinner />; // o skeleton
}
```

### Archivos a Modificar
1. `apps/web/src/lib/auth.ts` - Agregar isHydrated y onRehydrateStorage
2. `apps/web/src/components/auth/ProtectedRoute.tsx` (si existe)
3. `apps/web/src/app/employer/layout.tsx`
4. `apps/web/src/app/candidate/layout.tsx`
5. `apps/web/src/app/admin/layout.tsx`
6. Cualquier otro componente con auth guards

### Verificación
```bash
# Correr tests de auth
cd apps/web && npx playwright test e2e/tests/auth/ --project=chromium

# Test manual: 
# 1. Login como employer
# 2. Navegar a /employer/eor
# 3. Hacer refresh (F5)
# 4. Debe permanecer en la página, NO redirigir a login
```

---

## 🟠 BUG-H01: Admin ve menú de Employer (HIGH)

### Problema
En `AppShell.tsx`, `getRoleNav()` chequea `isEmployer()` antes de `isAdmin()`. Pero `isEmployer()` retorna `true` para ADMIN porque chequea `role === 'EMPLOYER' || role === 'RECRUITER' || role === 'ADMIN'`.

### Impacto
Admin users ven el nav de employer (Dashboard, Trabajos, Shortlists, EOR, Facturación) en vez del nav de admin (Dashboard, Trabajos, Clientes, Rúbricas, Entrevistas, KPIs, Placements).

### Archivo
`apps/web/src/components/brand/AppShell.tsx` (líneas 82-114)

### Fix
Reordenar los checks para que admin/recruiter se evalúe ANTES de employer:

```typescript
// apps/web/src/components/brand/AppShell.tsx

const getRoleNav = () => {
  // ANTES (MALO):
  // if (isEmployer()) return employerNav;
  // if (isRecruiter() || isAdmin()) return adminNav;
  // if (isCandidate()) return candidateNav;
  
  // DESPUÉS (BUENO) - Admin primero:
  if (isAdmin()) return adminNav;
  if (isRecruiter()) return recruiterNav; // Si hay nav específico para recruiter
  if (isEmployer()) return employerNav;
  if (isCandidate()) return candidateNav;
  
  return []; // fallback
};
```

### También verificar las funciones helper
```typescript
// Asegurar que isAdmin() solo retorne true para ADMIN
const isAdmin = () => user?.role === 'ADMIN';

// isEmployer() NO debe incluir ADMIN
const isEmployer = () => user?.role === 'EMPLOYER';

// Si necesitas "es employer O admin", crear función separada
const canAccessEmployerFeatures = () => 
  user?.role === 'EMPLOYER' || user?.role === 'ADMIN';
```

### Verificación
```bash
# Correr tests de admin
cd apps/web && npx playwright test e2e/tests/admin/ --project=chromium

# Test manual:
# 1. Login como admin@example.com
# 2. Verificar que el nav muestra: Dashboard, Trabajos, Clientes, Rúbricas, Entrevistas, KPIs, Placements
# 3. NO debe mostrar: Shortlists, EOR, Facturación
```

---

## 🟡 BUG-M01: Landing sin botón "Registrarse" (MEDIUM)

### Problema
Landing page solo tiene "Iniciar sesión" y "Solicitar demo". No hay CTA directo para registrarse.

### Impacto
UX pobre para nuevos usuarios que quieren registrarse rápidamente.

### Archivo
`apps/web/src/app/page.tsx` o `apps/web/src/components/landing/Header.tsx`

### Fix
Agregar botón "Registrarse" en el header y/o hero:

```tsx
// En el header/navbar de landing
<div className="flex items-center gap-4">
  <Link href="/login">
    <Button variant="ghost">Iniciar sesión</Button>
  </Link>
  <Link href="/register">
    <Button variant="default">Registrarse</Button>
  </Link>
</div>

// En el hero section
<div className="flex flex-col sm:flex-row gap-4 justify-center">
  <Link href="/register">
    <Button size="lg" className="w-full sm:w-auto">
      Comenzar gratis
    </Button>
  </Link>
  <Link href="/demo">
    <Button size="lg" variant="outline" className="w-full sm:w-auto">
      Solicitar demo
    </Button>
  </Link>
</div>
```

### Verificación
```bash
# Correr tests de landing
cd apps/web && npx playwright test e2e/tests/public/landing.spec.ts --project=chromium

# Test manual:
# 1. Ir a la landing page (/)
# 2. Verificar que hay botón "Registrarse" visible en header
# 3. Click en el botón debe llevar a /register
```

---

## 🟡 BUG-M02: Botones de iconos sin aria-label (MEDIUM)

### Problema
Botones que solo tienen iconos (sin texto) no tienen `aria-label`, haciéndolos inaccesibles para screen readers.

### Impacto
Usuarios con discapacidad visual no pueden saber qué hacen estos botones.

### Archivos
Buscar todos los botones con solo iconos:
```bash
# Buscar patrones comunes
grep -r "Button.*<.*Icon" apps/web/src --include="*.tsx" | head -20
grep -r "button.*onClick.*Icon" apps/web/src --include="*.tsx" | head -20
```

### Fix
Agregar `aria-label` a cada botón de icono:

```tsx
// ANTES (MALO)
<Button variant="ghost" size="icon" onClick={handleMenu}>
  <Menu className="h-5 w-5" />
</Button>

// DESPUÉS (BUENO)
<Button 
  variant="ghost" 
  size="icon" 
  onClick={handleMenu}
  aria-label="Abrir menú"
>
  <Menu className="h-5 w-5" />
</Button>

// Ejemplos comunes:
<Button aria-label="Cerrar">
  <X className="h-4 w-4" />
</Button>

<Button aria-label="Buscar">
  <Search className="h-4 w-4" />
</Button>

<Button aria-label="Configuración">
  <Settings className="h-4 w-4" />
</Button>

<Button aria-label="Más opciones">
  <MoreHorizontal className="h-4 w-4" />
</Button>

<Button aria-label="Editar">
  <Pencil className="h-4 w-4" />
</Button>

<Button aria-label="Eliminar">
  <Trash className="h-4 w-4" />
</Button>

<Button aria-label="Descargar">
  <Download className="h-4 w-4" />
</Button>
```

### Verificación
```bash
# Correr tests de accesibilidad
cd apps/web && npx playwright test e2e/tests/accessibility/ --project=chromium

# Verificar con axe-core que no hay violaciones de botones sin nombre
```

---

## 🟢 BUG-L01: Login con violaciones a11y "serious" (LOW)

### Problema
Login page tiene violaciones WCAG 2.0 AA nivel "serious" según axe-core. Probablemente relacionado con:
- Labels de formulario no asociados correctamente
- Ratios de contraste insuficientes
- Inputs sin labels accesibles

### Archivo
`apps/web/src/app/login/page.tsx` o `apps/web/src/app/(auth)/login/page.tsx`

### Fix
Revisar y corregir:

```tsx
// 1. Labels asociados correctamente
<div>
  <Label htmlFor="email">Correo electrónico</Label>
  <Input 
    id="email" 
    name="email"
    type="email" 
    aria-describedby="email-error"
  />
  {errors.email && (
    <p id="email-error" className="text-red-500 text-sm">
      {errors.email}
    </p>
  )}
</div>

// 2. Contraste suficiente (al menos 4.5:1 para texto normal)
// Verificar que text-gray-500 tenga suficiente contraste con el fondo
// Si no, usar text-gray-600 o text-gray-700

// 3. Inputs con aria-invalid cuando hay error
<Input 
  id="password"
  type="password"
  aria-invalid={!!errors.password}
  aria-describedby={errors.password ? "password-error" : undefined}
/>

// 4. Mensaje de error del formulario
{formError && (
  <div role="alert" className="text-red-500">
    {formError}
  </div>
)}
```

### Verificación
```bash
# Correr tests de accesibilidad específicos para login
cd apps/web && npx playwright test e2e/tests/accessibility/a11y.spec.ts --project=chromium

# Los tests no deben reportar violaciones "serious" en login
```

---

## ✅ Checklist de Verificación Final

Después de aplicar todos los fixes:

```bash
# Correr TODOS los tests
cd apps/web && npx playwright test --project=chromium
```

### Expected Results
- [ ] 76/76 tests pasan
- [ ] BUG-C01: Refresh en página protegida no redirige a login
- [ ] BUG-H01: Admin ve su propio menú (no el de employer)
- [ ] BUG-M01: Landing tiene botón "Registrarse"
- [ ] BUG-M02: Todos los botones de iconos tienen aria-label
- [ ] BUG-L01: Login no tiene violaciones a11y "serious"

---

## 📝 Output Esperado

```markdown
## Bug Fixes Complete

### BUG-C01 (Critical) ✅
- Added `isHydrated` flag to useAuthStore
- Added `onRehydrateStorage` callback
- Updated auth guards to wait for hydration
- Files: auth.ts, employer/layout.tsx, candidate/layout.tsx, admin/layout.tsx

### BUG-H01 (High) ✅
- Reordered role checks in getRoleNav()
- Admin now checked before employer
- Files: AppShell.tsx

### BUG-M01 (Medium) ✅
- Added "Registrarse" button to landing header
- Added "Comenzar gratis" CTA in hero
- Files: page.tsx (or Header.tsx)

### BUG-M02 (Medium) ✅
- Added aria-label to X icon buttons
- Files: [list of files]

### BUG-L01 (Low) ✅
- Fixed label associations in login form
- Added aria-describedby for errors
- Added role="alert" for form errors
- Files: login/page.tsx

### Test Results
- All 76 tests passing
- No accessibility violations
```

---

## 🚨 Cuando Termines

1. **Correr todos los tests**:
```bash
cd apps/web && npx playwright test --project=chromium
```

2. **Actualizar `tasks/todo.md`**:
```markdown
### Prompt 23: Bug Fixes from QA
- [x] BUG-C01: Zustand hydration race condition
- [x] BUG-H01: Admin nav priority
- [x] BUG-M01: Landing register CTA
- [x] BUG-M02: Icon button aria-labels
- [x] BUG-L01: Login a11y violations
```

3. **Actualizar `tasks/lessons.md`** con patrones aprendidos:
```markdown
### Zustand Persist + Next.js SSR
- Always add `isHydrated` flag when using zustand persist with SSR
- Auth guards must wait for hydration before redirecting
- Use `onRehydrateStorage` callback to set hydrated flag

### Role-based Navigation
- Check most specific roles first (admin before employer)
- Don't include admin in isEmployer() checks
- Create separate helper for "can access X features"
```

4. **Commit**:
```bash
git add .
git commit -m "fix: resolve all QA bugs (hydration, nav, a11y, landing CTA)"
git push
```
