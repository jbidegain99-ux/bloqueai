# 💳 Prompt 21: Monetización Skeleton

---

## 🔴 METODOLOGÍA DE TRABAJO (LEER PRIMERO)

### Antes de Empezar
```bash
# 1. Leer backlog actual
cat tasks/todo.md

# 2. Leer lecciones aprendidas
cat tasks/lessons.md

# 3. Verificar que dev server funciona
cd apps/web && npm run dev
cd apps/api && uvicorn app.main:app --reload
```

### Workflow Orchestration

#### 1. Plan Mode Default
- Entrar en plan mode para CUALQUIER tarea no trivial (3+ pasos o decisiones arquitectónicas)
- Si algo sale mal, PARAR y re-planear inmediatamente — no seguir empujando
- Usar plan mode para pasos de verificación, no solo para construir
- Escribir specs detallados upfront para reducir ambigüedad

#### 2. Subagent Strategy
- Usar subagents liberalmente para mantener el context window limpio
- Offload research, exploración, y análisis paralelo a subagents
- Para problemas complejos, usar más compute via subagents
- Una tarea por subagent para ejecución enfocada

#### 3. Self-Improvement Loop
- Después de CUALQUIER corrección del usuario: actualizar `tasks/lessons.md` con el patrón
- Escribir reglas para ti mismo que prevengan el mismo error
- Iterar implacablemente en estas lecciones hasta que la tasa de errores baje
- Revisar lecciones al inicio de la sesión para el proyecto relevante

#### 4. Verification Before Done
- NUNCA marcar una tarea como completa sin probar que funciona
- Diff behavior entre main y tus cambios cuando sea relevante
- Preguntarte: "¿Un staff engineer aprobaría esto?"
- Correr tests, revisar logs, demostrar correctitud

#### 5. Demand Elegance (Balanced)
- Para cambios no triviales: pausar y preguntar "¿hay una forma más elegante?"
- Si un fix se siente hacky: "Sabiendo todo lo que sé ahora, implementar la solución elegante"
- Saltar esto para fixes simples y obvios — no over-engineer
- Desafiar tu propio trabajo antes de presentarlo

#### 6. Autonomous Bug Fixing
- Cuando te dan un bug report: solo arréglalo. No pidas hand-holding
- Apuntar a logs, errores, tests fallando — luego resolverlos
- Cero context switching requerido del usuario
- Ir a arreglar tests de CI fallando sin que te digan cómo

### Task Management
1. **Plan First**: Escribir plan en `tasks/todo.md` con checkboxes
2. **Verify Plan**: Check in antes de empezar implementación
3. **Track Progress**: Marcar items completos conforme avanzas
4. **Explain Changes**: Resumen de alto nivel en cada paso
5. **Document Results**: Agregar sección de review a `tasks/todo.md`
6. **Capture Lessons**: Actualizar `tasks/lessons.md` después de correcciones

### Core Principles
- **Simplicity First**: Hacer cada cambio lo más simple posible. Código de impacto mínimo.
- **No Laziness**: Encontrar root causes. No fixes temporales. Estándares de senior developer.
- **Minimal Impact**: Cambios solo deben tocar lo necesario. Evitar introducir bugs.

---

## 📋 Contexto del Proyecto

**TalentOS** - Plataforma de reclutamiento con IA + EOR/Payroll para LATAM.

### Estructura
```
/home/jose/TalenOS/
├── apps/
│   ├── api/       ← Backend (FastAPI/Python/SQLAlchemy/Alembic)
│   ├── web/       ← Frontend (Next.js 14/React/TypeScript/Tailwind/shadcn)
│   └── worker/    ← Background jobs
├── tasks/
│   ├── todo.md    ← Backlog con checkboxes
│   └── lessons.md ← Lecciones aprendidas
```

### URLs
- **Producción:** https://bloqueai-ia.vercel.app
- **Backend:** https://bloqueai-api.vercel.app
- **Repo:** https://github.com/jbidegain99-ux/bloqueai

---

## 🎯 Objetivo del Prompt 21

Construir el **skeleton de monetización** — toda la estructura sin pasarela de pago real.

**¿Por qué skeleton?** La pasarela de pago aún no está elegida. Será un banco o proveedor de El Salvador (posiblemente Wompi). El skeleton permite:
1. UI completa y funcional
2. Feature gating operativo
3. Base de datos lista
4. Fácil conexión cuando se elija pasarela

---

## 📊 Estructura de Planes

| Plan | Precio | ATS Posiciones | Usuarios | EOR |
|------|--------|----------------|----------|-----|
| Free | $0 | 2 activas | 1 | ❌ |
| Growth | $99/mes | 10 activas | 3 | $29/contractor |
| Professional | $299/mes | Ilimitadas | Ilimitados | $349/empleado |
| Enterprise | Custom | Ilimitadas | Ilimitados | Negociable |

---

## ✅ Tareas

### Fase 1: Modelos de Base de Datos

#### T21.1: Crear modelos de billing
```python
# apps/api/app/models/billing.py

from enum import Enum
from sqlalchemy import Column, String, Integer, Numeric, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
import uuid

class PlanTier(str, Enum):
    FREE = "free"
    GROWTH = "growth"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"

class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    TRIALING = "trialing"
    PAUSED = "paused"

class Plan(Base):
    __tablename__ = "plans"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tier = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String)
    
    # Precios
    price_monthly = Column(Numeric(10, 2), default=0)
    price_yearly = Column(Numeric(10, 2), default=0)
    currency = Column(String, default="USD")
    
    # Límites
    max_positions = Column(Integer, default=2)  # -1 = ilimitado
    max_users = Column(Integer, default=1)
    max_candidates_per_position = Column(Integer, default=50)
    
    # Features
    features = Column(JSON, default=dict)
    
    # EOR pricing
    eor_price_per_employee = Column(Numeric(10, 2), nullable=True)
    eor_price_per_contractor = Column(Numeric(10, 2), nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default="now()")
    updated_at = Column(DateTime, server_default="now()", onupdate="now()")


class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    plan_id = Column(String, ForeignKey("plans.id"), nullable=False)
    
    status = Column(String, default="active")
    billing_cycle = Column(String, default="monthly")
    current_period_start = Column(DateTime)
    current_period_end = Column(DateTime)
    
    # Trial
    trial_start = Column(DateTime, nullable=True)
    trial_end = Column(DateTime, nullable=True)
    
    # Payment gateway (preparado para Wompi u otro)
    gateway = Column(String, nullable=True)
    gateway_subscription_id = Column(String, nullable=True)
    gateway_customer_id = Column(String, nullable=True)
    
    canceled_at = Column(DateTime, nullable=True)
    cancel_reason = Column(String, nullable=True)
    
    created_at = Column(DateTime, server_default="now()")
    updated_at = Column(DateTime, server_default="now()", onupdate="now()")
    
    organization = relationship("Organization", back_populates="subscription")
    plan = relationship("Plan")
    invoices = relationship("Invoice", back_populates="subscription")


class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    subscription_id = Column(String, ForeignKey("subscriptions.id"), nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    
    subtotal = Column(Numeric(10, 2), nullable=False)
    tax = Column(Numeric(10, 2), default=0)
    total = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, default="USD")
    
    status = Column(String, default="draft")
    line_items = Column(JSON, default=list)
    
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    due_date = Column(DateTime)
    paid_at = Column(DateTime, nullable=True)
    
    payment_method = Column(String, nullable=True)
    payment_reference = Column(String, nullable=True)
    
    invoice_number = Column(String, unique=True)
    invoice_pdf_url = Column(String, nullable=True)
    
    created_at = Column(DateTime, server_default="now()")
    
    subscription = relationship("Subscription", back_populates="invoices")


class UsageRecord(Base):
    __tablename__ = "usage_records"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    subscription_id = Column(String, ForeignKey("subscriptions.id"), nullable=False)
    
    usage_type = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    unit_price = Column(Numeric(10, 2))
    
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    
    created_at = Column(DateTime, server_default="now()")
```

#### T21.2: Migración Alembic
```bash
cd apps/api
alembic revision --autogenerate -m "add billing models"
alembic upgrade head
```

#### T21.3: Seed de planes
```python
# apps/api/app/db/seeds/plans.py

PLANS_SEED = [
    {
        "tier": "free",
        "name": "Free",
        "description": "Para comenzar a reclutar",
        "price_monthly": 0,
        "price_yearly": 0,
        "max_positions": 2,
        "max_users": 1,
        "max_candidates_per_position": 50,
        "features": {
            "ai_screening": True,
            "ai_matching": False,
            "video_interviews": False,
            "career_page": True,
            "pipeline_kanban": True,
            "email_templates": 3,
            "analytics_basic": True,
            "analytics_advanced": False,
            "api_access": False,
            "custom_branding": False,
            "eor_access": False,
        },
    },
    {
        "tier": "growth",
        "name": "Growth",
        "description": "Para equipos pequeños en crecimiento",
        "price_monthly": 99,
        "price_yearly": 948,
        "max_positions": 10,
        "max_users": 3,
        "max_candidates_per_position": 200,
        "eor_price_per_contractor": 29,
        "features": {
            "ai_screening": True,
            "ai_matching": True,
            "video_interviews": True,
            "career_page": True,
            "pipeline_kanban": True,
            "email_templates": -1,
            "analytics_basic": True,
            "analytics_advanced": False,
            "api_access": False,
            "custom_branding": True,
            "eor_access": True,
        },
    },
    {
        "tier": "professional",
        "name": "Professional",
        "description": "Para empresas en crecimiento",
        "price_monthly": 299,
        "price_yearly": 2868,
        "max_positions": -1,
        "max_users": -1,
        "max_candidates_per_position": -1,
        "eor_price_per_employee": 349,
        "features": {
            "ai_screening": True,
            "ai_matching": True,
            "video_interviews": True,
            "career_page": True,
            "pipeline_kanban": True,
            "email_templates": -1,
            "analytics_basic": True,
            "analytics_advanced": True,
            "api_access": True,
            "custom_branding": True,
            "eor_access": True,
            "priority_support": True,
        },
    },
    {
        "tier": "enterprise",
        "name": "Enterprise",
        "description": "Para corporaciones con necesidades específicas",
        "price_monthly": 0,
        "price_yearly": 0,
        "max_positions": -1,
        "max_users": -1,
        "max_candidates_per_position": -1,
        "features": {
            "ai_screening": True,
            "ai_matching": True,
            "video_interviews": True,
            "career_page": True,
            "pipeline_kanban": True,
            "email_templates": -1,
            "analytics_basic": True,
            "analytics_advanced": True,
            "api_access": True,
            "custom_branding": True,
            "eor_access": True,
            "priority_support": True,
            "sso_saml": True,
            "dedicated_account_manager": True,
            "custom_integrations": True,
            "sla_99_9": True,
        },
    },
]
```

---

### Fase 2: API de Billing

#### T21.4: Servicios de billing
```python
# apps/api/app/services/billing_service.py

from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from app.models.billing import Plan, Subscription, Invoice, UsageRecord

class BillingService:
    """Servicio de billing - skeleton sin pasarela real."""
    
    def get_plans(self, db: Session, include_enterprise: bool = False) -> list[Plan]:
        query = db.query(Plan).filter(Plan.is_active == True)
        if not include_enterprise:
            query = query.filter(Plan.tier != "enterprise")
        return query.all()
    
    def get_current_subscription(self, db: Session, organization_id: str) -> Optional[Subscription]:
        return db.query(Subscription).filter(
            Subscription.organization_id == organization_id,
            Subscription.status.in_(["active", "trialing", "past_due"])
        ).first()
    
    def create_subscription(
        self,
        db: Session,
        organization_id: str,
        plan_tier: str,
        billing_cycle: str = "monthly",
        start_trial: bool = True,
    ) -> Subscription:
        plan = db.query(Plan).filter(Plan.tier == plan_tier).first()
        if not plan:
            raise ValueError(f"Plan {plan_tier} not found")
        
        now = datetime.utcnow()
        
        subscription = Subscription(
            organization_id=organization_id,
            plan_id=plan.id,
            billing_cycle=billing_cycle,
            status="trialing" if start_trial else "active",
            current_period_start=now,
            current_period_end=now + timedelta(days=30 if billing_cycle == "monthly" else 365),
        )
        
        if start_trial:
            subscription.trial_start = now
            subscription.trial_end = now + timedelta(days=14)
        
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
        
        return subscription
    
    def upgrade_subscription(
        self,
        db: Session,
        subscription_id: str,
        new_plan_tier: str,
    ) -> Subscription:
        subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
        new_plan = db.query(Plan).filter(Plan.tier == new_plan_tier).first()
        
        if not subscription or not new_plan:
            raise ValueError("Subscription or plan not found")
        
        subscription.plan_id = new_plan.id
        subscription.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(subscription)
        
        return subscription
    
    def cancel_subscription(
        self,
        db: Session,
        subscription_id: str,
        reason: Optional[str] = None,
        immediate: bool = False,
    ) -> Subscription:
        subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
        
        if not subscription:
            raise ValueError("Subscription not found")
        
        subscription.canceled_at = datetime.utcnow()
        subscription.cancel_reason = reason
        
        if immediate:
            subscription.status = "canceled"
        
        db.commit()
        db.refresh(subscription)
        
        return subscription
    
    def check_feature_access(
        self,
        db: Session,
        organization_id: str,
        feature: str,
    ) -> bool:
        subscription = self.get_current_subscription(db, organization_id)
        
        if not subscription:
            free_plan = db.query(Plan).filter(Plan.tier == "free").first()
            return free_plan.features.get(feature, False) if free_plan else False
        
        return subscription.plan.features.get(feature, False)
    
    def check_limit(
        self,
        db: Session,
        organization_id: str,
        limit_type: str,
        current_count: int,
    ) -> tuple[bool, int]:
        subscription = self.get_current_subscription(db, organization_id)
        
        if not subscription:
            free_plan = db.query(Plan).filter(Plan.tier == "free").first()
            plan = free_plan
        else:
            plan = subscription.plan
        
        limit_map = {
            "positions": plan.max_positions,
            "users": plan.max_users,
            "candidates_per_position": plan.max_candidates_per_position,
        }
        
        max_allowed = limit_map.get(limit_type, 0)
        
        if max_allowed == -1:
            return True, -1
        
        return current_count < max_allowed, max_allowed
    
    def create_invoice(
        self,
        db: Session,
        subscription: Subscription,
        line_items: list[dict],
    ) -> Invoice:
        subtotal = sum(item.get("amount", 0) * item.get("quantity", 1) for item in line_items)
        tax = subtotal * 0.13  # IVA El Salvador 13%
        
        last_invoice = db.query(Invoice).order_by(Invoice.created_at.desc()).first()
        if last_invoice and last_invoice.invoice_number:
            last_num = int(last_invoice.invoice_number.split("-")[-1])
            new_num = last_num + 1
        else:
            new_num = 1
        
        invoice = Invoice(
            subscription_id=subscription.id,
            organization_id=subscription.organization_id,
            subtotal=subtotal,
            tax=tax,
            total=subtotal + tax,
            line_items=line_items,
            period_start=subscription.current_period_start,
            period_end=subscription.current_period_end,
            due_date=datetime.utcnow() + timedelta(days=15),
            invoice_number=f"TOS-{datetime.utcnow().year}-{new_num:06d}",
            status="open",
        )
        
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        
        return invoice


billing_service = BillingService()
```

#### T21.5: Router de billing
```python
# apps/api/app/routers/billing.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.services.billing_service import billing_service
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/billing", tags=["billing"])


class CreateSubscriptionRequest(BaseModel):
    plan_tier: str
    billing_cycle: str = "monthly"


class UpgradeRequest(BaseModel):
    new_plan_tier: str


class CancelRequest(BaseModel):
    reason: Optional[str] = None
    immediate: bool = False


@router.get("/plans")
async def get_plans(db: Session = Depends(get_db)):
    plans = billing_service.get_plans(db)
    return {"plans": plans}


@router.get("/subscription")
async def get_subscription(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subscription = billing_service.get_current_subscription(db, current_user.organization_id)
    return {"subscription": subscription}


@router.post("/subscribe")
async def create_subscription(
    request: CreateSubscriptionRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = billing_service.get_current_subscription(db, current_user.organization_id)
    if existing:
        raise HTTPException(400, "Organization already has an active subscription")
    
    subscription = billing_service.create_subscription(
        db,
        organization_id=current_user.organization_id,
        plan_tier=request.plan_tier,
        billing_cycle=request.billing_cycle,
    )
    
    return {"subscription": subscription, "message": "Subscription created. Trial period: 14 days."}


@router.post("/upgrade")
async def upgrade_subscription(
    request: UpgradeRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subscription = billing_service.get_current_subscription(db, current_user.organization_id)
    if not subscription:
        raise HTTPException(400, "No active subscription found")
    
    updated = billing_service.upgrade_subscription(db, subscription.id, request.new_plan_tier)
    
    return {"subscription": updated, "message": f"Plan changed to {request.new_plan_tier}"}


@router.post("/cancel")
async def cancel_subscription(
    request: CancelRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subscription = billing_service.get_current_subscription(db, current_user.organization_id)
    if not subscription:
        raise HTTPException(400, "No active subscription found")
    
    canceled = billing_service.cancel_subscription(
        db,
        subscription.id,
        reason=request.reason,
        immediate=request.immediate,
    )
    
    return {"subscription": canceled, "message": "Subscription canceled"}


@router.get("/invoices")
async def get_invoices(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.billing import Invoice
    
    invoices = db.query(Invoice).filter(
        Invoice.organization_id == current_user.organization_id
    ).order_by(Invoice.created_at.desc()).all()
    
    return {"invoices": invoices}


@router.get("/check-feature/{feature}")
async def check_feature_access(
    feature: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    has_access = billing_service.check_feature_access(db, current_user.organization_id, feature)
    return {"feature": feature, "has_access": has_access}


@router.get("/check-limit/{limit_type}")
async def check_limit(
    limit_type: str,
    current_count: int = 0,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_within, max_allowed = billing_service.check_limit(
        db, current_user.organization_id, limit_type, current_count
    )
    return {
        "limit_type": limit_type,
        "current_count": current_count,
        "max_allowed": max_allowed,
        "is_within_limit": is_within,
    }
```

#### T21.6: Middleware de feature gating
```python
# apps/api/app/middleware/feature_gate.py

from functools import wraps
from fastapi import HTTPException
from app.services.billing_service import billing_service


def require_feature(feature: str):
    """Decorator para endpoints que requieren una feature específica."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")
            
            if not db or not current_user:
                raise HTTPException(500, "Missing dependencies for feature check")
            
            has_access = billing_service.check_feature_access(
                db, current_user.organization_id, feature
            )
            
            if not has_access:
                raise HTTPException(
                    403,
                    detail={
                        "error": "feature_not_available",
                        "feature": feature,
                        "message": f"Your plan doesn't include {feature}. Please upgrade.",
                        "upgrade_url": "/settings/billing",
                    }
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_limit(limit_type: str, count_getter: callable):
    """Decorator para endpoints que tienen límites."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")
            
            if not db or not current_user:
                raise HTTPException(500, "Missing dependencies for limit check")
            
            current_count = count_getter(db, current_user)
            is_within, max_allowed = billing_service.check_limit(
                db, current_user.organization_id, limit_type, current_count
            )
            
            if not is_within:
                raise HTTPException(
                    403,
                    detail={
                        "error": "limit_reached",
                        "limit_type": limit_type,
                        "current": current_count,
                        "max": max_allowed,
                        "message": f"You've reached your {limit_type} limit ({max_allowed}). Please upgrade.",
                        "upgrade_url": "/settings/billing",
                    }
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

---

### Fase 3: UI de Pricing y Billing

#### T21.7: Página de Pricing (pública)
Crear `apps/web/src/app/pricing/page.tsx`:
- Hero con badge "14 días de prueba gratis"
- Toggle mensual/anual con descuento -20%
- 4 cards de planes (Free, Growth, Professional, Enterprise)
- Lista de features con checks/X
- CTAs: "Comenzar gratis", "Iniciar prueba", "Contactar ventas"
- Animaciones con Framer Motion
- Responsive mobile-first

#### T21.8: Dashboard de Billing (privado)
Crear `apps/web/src/app/settings/billing/page.tsx`:
- Card de plan actual con status (active/trialing)
- Días de trial restantes si aplica
- Barras de uso (posiciones, usuarios, candidatos)
- Sección de método de pago (skeleton para Wompi)
- Lista de facturas con status icons
- Botones: "Cambiar plan", "Cancelar suscripción"

#### T21.9: API client de billing
Crear `apps/web/src/lib/api/billing.ts`:
- Tipos TypeScript para Plan, Subscription, Invoice
- Funciones: getPlans, getSubscription, createSubscription, upgrade, cancel, getInvoices
- checkFeature, checkLimit

#### T21.10: Hook de feature gating para UI
Crear `apps/web/src/hooks/use-feature.ts`:
- `useFeature(feature)` → { hasAccess, isLoading }
- `useLimit(limitType, currentCount)` → { isWithinLimit, maxAllowed, isLoading }
- Componente `<FeatureGate feature="x">` para renderizado condicional
- Componente `<UpgradePrompt>` para mostrar cuando no hay acceso

---

## ✅ Checklist de Verificación

### Base de Datos
- [ ] Modelos creados: Plan, Subscription, Invoice, UsageRecord
- [ ] Migración ejecutada sin errores
- [ ] Seed de planes ejecutado
- [ ] Datos visibles en DB

### API
- [ ] `GET /billing/plans` retorna planes
- [ ] `GET /billing/subscription` funciona
- [ ] `POST /billing/subscribe` crea suscripción con trial
- [ ] `POST /billing/upgrade` cambia plan
- [ ] `POST /billing/cancel` cancela suscripción
- [ ] `GET /billing/invoices` retorna lista
- [ ] `GET /billing/check-feature/{feature}` funciona
- [ ] `GET /billing/check-limit/{limit}` funciona

### UI
- [ ] Página `/pricing` renderiza correctamente
- [ ] Toggle mensual/anual funciona
- [ ] Página `/settings/billing` muestra plan actual
- [ ] Barras de uso se muestran
- [ ] Lista de facturas se muestra (o empty state)

### Feature Gating
- [ ] Middleware `@require_feature` bloquea endpoints
- [ ] Hook `useFeature` funciona en frontend
- [ ] Componente `FeatureGate` renderiza condicionalmente
- [ ] `UpgradePrompt` se muestra cuando no hay acceso

### Build
- [ ] `npm run build` pasa sin errores
- [ ] `pytest` pasa sin errores
- [ ] TypeScript sin errores
- [ ] ESLint sin errores

---

## 📝 Output Esperado

```markdown
## Monetización Skeleton - Completado

### Base de Datos
- [x] 4 modelos creados (Plan, Subscription, Invoice, UsageRecord)
- [x] Migración aplicada
- [x] 4 planes seeded (Free, Growth, Professional, Enterprise)

### API
- [x] 8 endpoints implementados
- [x] Feature gating middleware
- [x] Tests pasando

### UI
- [x] Página de pricing pública
- [x] Dashboard de billing
- [x] Hooks de feature gating
- [x] Componentes FeatureGate y UpgradePrompt

### Listo para integrar
- [ ] Pasarela de pago (Wompi pendiente)
- [ ] Webhooks de pago
- [ ] Generación de PDF de facturas

### Archivos creados/modificados
- apps/api/app/models/billing.py
- apps/api/app/services/billing_service.py
- apps/api/app/routers/billing.py
- apps/api/app/middleware/feature_gate.py
- apps/api/app/db/seeds/plans.py
- apps/web/src/app/pricing/page.tsx
- apps/web/src/app/settings/billing/page.tsx
- apps/web/src/lib/api/billing.ts
- apps/web/src/hooks/use-feature.ts
```

---

## 🚨 Cuando Termines

1. **Actualizar `tasks/todo.md`**:
```markdown
### Prompt 21: Monetización Skeleton
- [x] T21.1: Modelos de billing
- [x] T21.2: Migración Alembic
- [x] T21.3: Seed de planes
- [x] T21.4: BillingService
- [x] T21.5: Router de billing
- [x] T21.6: Middleware feature gating
- [x] T21.7: Página de pricing
- [x] T21.8: Dashboard de billing
- [x] T21.9: API client billing
- [x] T21.10: Hooks de feature gating
```

2. **Actualizar `tasks/lessons.md`** si hubo correcciones

3. **Commit**:
```bash
git add .
git commit -m "feat(billing): add monetization skeleton with plans, subscriptions, and feature gating"
git push
```
