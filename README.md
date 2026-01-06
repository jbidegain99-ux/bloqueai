# TalentOS by Bloque

**Plataforma de Reclutamiento con IA** - Sistema completo para reclutamiento inteligente con parsing de CV, entrevistas automatizadas con IA, scoring y ranking de candidatos.

## Características

- **CV Parsing con IA**: Extracción automática de datos de CVs (PDF/DOCX)
- **Entrevista IA**: Chat guiado con evaluación de competencias
- **Scoring Inteligente**: Puntuación automática basada en rúbricas configurables
- **Ranking de Candidatos**: Shortlist ordenado por match con la vacante
- **Human-in-the-loop**: Revisión y ajuste de scores por recruiters
- **Dashboard de KPIs**: Métricas de conversión y calidad
- **Multi-tenant**: Soporte para múltiples empresas
- **i18n Ready**: Soporte para español e inglés

## Stack Tecnológico

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI, Python 3.11, SQLAlchemy, Alembic
- **Worker**: Python RQ (Redis Queue)
- **Base de datos**: PostgreSQL 15
- **Cache/Queue**: Redis 7
- **Storage**: MinIO (S3-compatible)
- **IA**: OpenAI-compatible API (con stub para desarrollo)

## Inicio Rápido (< 10 minutos)

### Prerrequisitos

- Docker y Docker Compose
- Git

### 1. Clonar y configurar

```bash
git clone <repo-url>
cd bloqueai

# Copiar variables de entorno
cp .env.example .env
```

### 2. Levantar servicios

```bash
# Usar Docker Compose
docker-compose up -d

# O usar Make
make up
```

### 3. Acceder a la aplicación

- **Web App**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

### Cuentas de Prueba

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@talentos.local | Admin123! |
| Recruiter | recruiter@talentos.local | Recruiter123! |
| Employer | employer@talentos.local | Employer123! |
| Candidate | candidate1@example.com | Candidate123! |

## Estructura del Proyecto

```
bloqueai/
├── apps/
│   ├── api/              # FastAPI Backend
│   │   ├── app/
│   │   │   ├── core/     # Config, DB, Security
│   │   │   ├── models/   # SQLAlchemy models
│   │   │   ├── schemas/  # Pydantic schemas
│   │   │   ├── routers/  # API endpoints
│   │   │   ├── services/ # Business logic
│   │   │   └── utils/    # Helpers
│   │   ├── alembic/      # Migrations
│   │   ├── scripts/      # Seed data
│   │   └── tests/        # Pytest tests
│   ├── worker/           # Background jobs
│   └── web/              # Next.js Frontend
│       ├── src/
│       │   ├── app/      # App Router pages
│       │   ├── components/
│       │   ├── lib/      # API, Auth, Utils
│       │   └── styles/   # Tailwind config
│       └── tests/        # Playwright tests
├── packages/
│   └── shared/           # Shared types
├── docker-compose.yml
├── Makefile
└── README.md
```

## Desarrollo

### Sin Docker

```bash
# Terminal 1: API
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --reload

# Terminal 2: Web
cd apps/web
pnpm install
pnpm dev
```

Necesitarás PostgreSQL, Redis y MinIO corriendo localmente.

### Con Docker (Recomendado)

```bash
make up       # Levantar todos los servicios
make logs     # Ver logs
make down     # Detener servicios
make shell-api # Entrar al contenedor de API
```

## Migraciones

```bash
# Ejecutar migraciones
make migrate

# Crear nueva migración
make migrate-create MSG="add new table"
```

## Seed Data

```bash
make seed
```

Crea:
- 1 empresa (Bloque Internacional)
- 4 usuarios (admin, recruiter, employer, 3 candidates)
- 2 trabajos de ejemplo
- 1 rúbrica por defecto
- Candidatos con entrevistas y reportes

## API Endpoints Principales

### Auth
- `POST /auth/register` - Registro
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refrescar token
- `GET /auth/me` - Usuario actual

### Candidate
- `POST /candidate/resume` - Subir CV
- `POST /candidate/interview/start` - Iniciar entrevista
- `POST /candidate/interview/{id}/message` - Enviar mensaje
- `GET /candidate/profile` - Ver perfil
- `GET /candidate/report` - Ver reporte

### Employer
- `GET /employer/jobs` - Listar trabajos
- `POST /employer/jobs` - Crear trabajo
- `POST /employer/jobs/{id}/shortlist/generate` - Generar shortlist
- `GET /employer/jobs/{id}/shortlist` - Ver shortlist
- `GET /employer/jobs/{id}/shortlist/export.csv` - Exportar CSV

### Admin
- `GET /admin/rubrics` - Listar rúbricas
- `POST /admin/rubrics` - Crear rúbrica
- `POST /admin/rubrics/{id}/simulate` - Simular cambios
- `GET /admin/dashboard/kpis` - Ver KPIs
- `POST /admin/reports/{id}/override` - Override de score

## Variables de Entorno

```bash
# Database
DATABASE_URL=postgresql://talentos:talentos@localhost:5432/talentos

# Redis
REDIS_URL=redis://localhost:6379/0

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=talentos-uploads

# JWT
JWT_SECRET_KEY=your-secret-key

# LLM (dejar vacío para modo stub)
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Modo Stub (Sin LLM API Key)

Si `LLM_API_KEY` está vacío, el sistema usa un provider stub determinista:
- Parsing de CV devuelve datos estructurados consistentes
- Reportes de entrevista con scores basados en hash
- Útil para desarrollo y pruebas

## Tests

```bash
# Todos los tests
make test

# Solo API
cd apps/api && pytest -v

# Solo frontend
cd apps/web && pnpm test
```

## Brand Theme

Colores principales:
- **Navy 900**: #1B2A5C (fondos principales)
- **Navy 700**: #2A345F (hover, gradientes)
- **Gold 500**: #E6BE28 (CTAs, highlights)
- **Slate 200**: #C9CAD7 (bordes, divisores)
- **Gray 50**: #F7F8FB (backgrounds)

## Seguridad

- JWT con refresh tokens
- RBAC (CANDIDATE, EMPLOYER, RECRUITER, ADMIN)
- Rate limiting en endpoints sensibles
- Validación estricta con Pydantic
- PII masking en transcripts para employers
- Auditoría de cambios en rúbricas y overrides

## Decisiones de Diseño

1. **Monorepo con pnpm workspaces**: Facilita desarrollo y deploys
2. **FastAPI + SQLAlchemy sync**: Balance entre performance y simplicidad
3. **Stub LLM Provider**: Permite desarrollo sin API key
4. **Inline job processing**: MVP sin queue separado (configurable)
5. **shadcn/ui**: Componentes accesibles y personalizables
6. **JSONB para datos flexibles**: Skills, experience, scores

## Roadmap (Post-MVP)

- [ ] OAuth (Google, LinkedIn)
- [ ] Video interviews
- [ ] Integración con ATSs
- [ ] Analytics avanzados
- [ ] Mobile app
- [ ] Multi-idioma completo (en)

## Licencia

Propietario - Bloque Internacional

---

**TalentOS by Bloque** - Reclutamiento inteligente con IA
