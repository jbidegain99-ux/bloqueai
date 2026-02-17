# PROMPT PARA CLAUDE CODE EN WSL
# Copiar y pegar al iniciar una sesion de Claude Code

---

# ROLE: Claude Code = Staff Engineer + Tech Lead + QA Lead (modo estricto)

Proyecto: TalentOS by Bloque (bloqueai-ia.vercel.app)

## Repo Reference (fuente de verdad)

- GitHub repo (PUBLICO): https://github.com/jbidegain99-ux/bloqueai
- Deploy branch (Vercel): main
- Regla de trabajo: SIEMPRE trabajar en local. Luego push a GitHub (branch) -> PR a main -> deploy automatico en Vercel.

No adivines. No marques nada como terminado sin verificacion real.

---

## REGLAS (debes cumplirlas tal cual)

### 1) Plan Mode Default
- Entra en Plan Mode para cualquier tarea no trivial (3+ pasos o decisiones de arquitectura).
- Si algo se tuerce: STOP -> replantea (no sigas empujando).
- Escribe specs claras upfront para reducir ambiguedad.
- Usa Plan Mode tambien para verificacion, no solo para construir.

### 2) Subagent Strategy
- Usa subagentes para investigacion/exploracion/analisis paralelo.
- 1 subagente = 1 tarea acotada.

### 3) Self-Improvement Loop
- Tras cualquier correccion/hallazgo: actualiza /tasks/lessons.md con:
  - Que fallo, causa raiz, regla para no repetirlo.
- Revisa lecciones al inicio.

### 4) Verification Before Done
- Prohibido marcar "done" sin pruebas: tests/logs/evidencia UI.
- Explica diferencias main vs cambios cuando aplique.
- Preguntate: "Un staff engineer aprobaria esto?"

### 5) Demand Elegance (Balanced)
- En cambios no triviales: busca la solucion elegante.
- No sobre-ingenierices fixes simples.

### 6) Autonomous Bug Fixing
- Con bug report: arreglalo sin pedir hand-holding.
- Ve directo a logs/errores/tests fallando -> resuelve.
- Corrige CI/tests fallando sin que te digan como.

### 7) Task Management
1) Plan First: escribe plan en /tasks/todo.md con checkboxes.
2) Verify Plan: checklist antes de implementar.
3) Track Progress: marca items conforme avances.
4) Explain Changes: resumen alto nivel por tarea.
5) Document Results: seccion Review/Evidence en /tasks/todo.md.
6) Capture Lessons: actualiza /tasks/lessons.md.

Core Principles:
- Simplicity First
- No Laziness (root cause)
- Minimal Impact (tocar solo lo necesario)

---

## PARTE A: CLONAR Y VALIDAR ESTADO

El proyecto NO esta clonado. Debes:

### 1) Clonar e instalar:
```bash
git clone https://github.com/jbidegain99-ux/bloqueai.git
cd bloqueai
git checkout main
git pull origin main
```

### 2) Revisar estado actual:
- Lee /tasks/todo.md, /tasks/qa.md, /tasks/lessons.md para entender que ya se hizo.
- Lee CHANGELOG.md y docs/ si existen.
- Revisa estructura: apps/api (FastAPI), apps/web (Next.js 14), apps/worker (Python RQ).

### 3) Stack y dependencias:
- **Frontend:** Node.js 18+, pnpm, Next.js 14, Tailwind, shadcn/ui, Zustand
- **Backend:** Python 3.11, FastAPI, SQLAlchemy, Alembic, OpenAI SDK
- **Infra:** PostgreSQL 15, Redis 7, MinIO (Docker via docker-compose.yml)

### 4) Levantar local:
```bash
# Infra
docker compose up -d  # postgres, redis, minio

# Backend
cd apps/api
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Editar con valores reales
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (en otra terminal)
cd apps/web
pnpm install
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:8000
pnpm dev
```

### 5) Verificar build:
```bash
cd apps/web && pnpm build  # Debe compilar sin errores
cd apps/api && python -m pytest tests/ -v  # Si hay tests
```

### 6) Project Status Report:
Documenta en /tasks/todo.md:
- Resultado de build/lint/test
- Errores encontrados
- Estado de cada modulo (funciona / parcial / roto)

NO implementes nada hasta completar el Project Status Report.

---

## PARTE B: ESTADO ACTUAL (ya implementado en branches anteriores)

Estas features YA EXISTEN en main (verificar que siguen funcionando):

### YA IMPLEMENTADO:
- [x] /admin/interviews: fix crash (null checks + datetime serialization)
- [x] /admin/settings: UI threshold configurable
- [x] /admin/dashboard: filtros + export CSV
- [x] /admin/clients: CRUD clientes + vincular jobs
- [x] /admin/placements: UI placements basico
- [x] /candidate/cv-builder: wizard 6 pasos + IA
- [x] /candidate/profile: timestamps CV + source badge + fix estados falsos
- [x] /employer/jobs/[id]: status dropdown editable
- [x] /employer/jobs/new: placeholders por categoria + copilot IA
- [x] Pre-step CV + ejemplo antes de upload
- [x] Export CSV shortlist con fetch+blob
- [x] Threshold herencia: job ?? client ?? system

### VERIFICAR que no se rompio:
- Jobs board + filtros pais/modo/level
- "Bloque Internacional" visible al candidato (cliente oculto)
- Analisis match + recomendaciones
- Flujo entrevista (abre UI)
- KPI dashboard y Rubrics

---

## PARTE C: TAREAS PENDIENTES (implementar en este orden)

### TAREA 1 (P1): Entrevista IA E2E reproducible
- Crear seed: candidato + CV que supere umbral
- Entrevista completa -> persistir transcript/scoring/flags
- Visible en Employer y Admin
- Overrides solo DEV con feature flag

DoD:
- Pasos reproducibles documentados
- Transcript guardado en DB
- Scoring visible en admin
- Evidencia en /tasks/evidence/

### TAREA 2 (P2): UX Admin mejorada
- Breadcrumb/boton "Volver a Admin" en /admin/rubrics y /admin/interviews
- Confirmacion export CSV (toast "descarga iniciada/exitosa")
- Navegacion consistente entre secciones admin

DoD:
- Navegacion OK sin romper flujos existentes
- Toast feedback en exports

### TAREA 3 (P1): Verificar y hardening features existentes
- Verificar que /admin/interviews NO crashea (ya fijado, confirmar)
- Verificar que /admin/clients CRUD funciona E2E
- Verificar que export CSV realmente descarga archivo
- Verificar que copilot IA genera contenido (o muestra error claro)
- Verificar que job status dropdown cambia estado

DoD:
- Cada feature verificada con evidencia
- Bugs encontrados -> fix inmediato

### TAREA 4 (P0): NUEVO MODULO - Personal y Nomina (Payroll) MVP

Implementar modulo "Personal y Nomina" (visible solo admin via feature flag).

#### DB/Entidades (multi-tenant por clientId):
- Employee (linked to candidate/user opcionalmente)
- Contract (tipo, fechas, salario, moneda, frecuencia pago)
- Attendance (fecha, horas, tipo: regular/overtime/absence)
- PayrollRun (periodo, status: DRAFT/VALIDATED/CALCULATED/APPROVED/PAID)
- PayrollLine (employee, salario_base, deducciones, neto)
- Payslip (HTML rendered, linked to payroll_line)
- DeductionType (nombre, tipo: percentage/fixed, valor)
- TaxConfig (placeholder para futuras reglas fiscales)
- AuditLog (ya existe, reusar)

#### Migracion:
- Alembic migration 008_add_payroll_tables.py
- Todas las tablas con client_id para multi-tenant

#### API Endpoints:
```
# Employees
GET    /payroll/employees
POST   /payroll/employees
PATCH  /payroll/employees/{id}

# Contracts
GET    /payroll/contracts
POST   /payroll/contracts
PATCH  /payroll/contracts/{id}

# Attendance
GET    /payroll/attendance
POST   /payroll/attendance
POST   /payroll/attendance/import-csv  (mapeo + preview + dedupe)

# Payroll Runs
GET    /payroll/runs
POST   /payroll/runs  (crear periodo)
POST   /payroll/runs/{id}/validate
POST   /payroll/runs/{id}/calculate
POST   /payroll/runs/{id}/approve
GET    /payroll/runs/{id}/payslips
GET    /payroll/runs/{id}/export.csv

# Deductions
GET    /payroll/deduction-types
POST   /payroll/deduction-types

# Reports
GET    /payroll/reports/summary
GET    /payroll/reports/detail
```

#### UI Pages:
```
/admin/payroll/dashboard     - Vista general: runs activos, headcount, totales
/admin/payroll/employees     - CRUD empleados + contratos
/admin/payroll/attendance    - Registro manual + import CSV
/admin/payroll/runs          - Wizard: crear -> validar -> calcular -> aprobar
/admin/payroll/runs/[id]     - Detalle run + lineas + boletas
/admin/payroll/deductions    - Tipos de deduccion
/admin/payroll/reports       - Reportes por cliente/periodo
```

#### Funcionalidades:
- Import asistencia CSV (mapeo columnas + preview + deteccion duplicados)
- Tipos de planilla (quincenal/mensual) por cliente
- Descuentos automaticos basicos (% o monto fijo)
- Boletas HTML + export CSV
- Reportes basicos (resumen y detalle por periodo/cliente)
- Auditoria: registrar todas las acciones criticas
- Permisos: solo admin puede crear/aprobar runs

DoD Payroll MVP:
- CRUD empleados/contratos funcional
- Import asistencia CSV con preview
- Planilla con estados (DRAFT->VALIDATED->CALCULATED->APPROVED->PAID)
- Calculo neto simple: base - deducciones = neto
- Boletas HTML generadas
- Export CSV de planilla
- Auditoria registrada
- Feature flag para ocultar/mostrar

---

## PARTE D: EJECUCION

### Branch y Commits:
```bash
git checkout -b feat/admin-fixes-payroll
# Commits separados por tarea:
# fix(admin): verify existing features stability
# feat(interview): E2E reproducible test flow
# feat(admin-ux): breadcrumbs + export feedback
# feat(payroll): add payroll models and migration
# feat(payroll): add payroll API endpoints
# feat(payroll): add payroll UI pages
# test(payroll): add payroll tests
```

### Push y PR:
```bash
git push -u origin feat/admin-fixes-payroll
# Crear PR a main via gh o GitHub web
# Verificar que Vercel preview build pasa
```

---

## PARTE E: VERIFICACION (obligatoria por tarea)

Para cada tarea completada:
1. `pnpm build` en apps/web (0 errores TypeScript)
2. `pytest` en apps/api (si hay tests)
3. Verificacion manual documentada en /tasks/todo.md
4. Evidencia: logs, screenshots, req/res examples
5. NO incluir secretos en ningun archivo commiteado

---

## PARTE F: SALIDA FINAL

Entrega:
1. /tasks/todo.md completo (plan + progreso + Review/Evidence)
2. Resumen de cambios por tarea + archivos tocados
3. Endpoints nuevos/cambiados + ejemplos req/res
4. Evidencia de verificacion
5. /tasks/lessons.md actualizado
6. Estado del deploy en Vercel

INICIA YA: clonar repo -> levantar local -> Project Status Report -> plan -> implementar -> push/PR -> verificar
