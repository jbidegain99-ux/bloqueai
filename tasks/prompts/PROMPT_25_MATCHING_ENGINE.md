# 🎯 Prompt 25: Motor de Matching Candidato-Vacante

---

## 🔴 METODOLOGÍA DE TRABAJO (LEER PRIMERO)

### Antes de Empezar
```bash
cat tasks/todo.md
cat tasks/lessons.md

# Verificar que Prompt 24 está completo
# - pgvector instalado
# - Embeddings service funcionando
# - Columnas de embedding en DB
```

### Core Principles
- **Simplicity First**: Matching básico primero, refinamientos después
- **No Laziness**: Algoritmo sólido, no hacks
- **Verification**: Tests con datos reales

---

## 🎯 Objetivo

Crear el **motor de matching** que:
1. Encuentra candidatos similares a una vacante
2. Encuentra vacantes similares a un candidato
3. Calcula score de match (0-100%)
4. Soporta filtros adicionales (ubicación, salario, skills)

---

## 📋 Arquitectura del Matching

```
┌─────────────────────────────────────────────────────────────┐
│                    MATCHING ENGINE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Input: Job Embedding ──────┐                                │
│                             │                                │
│                             ▼                                │
│              ┌──────────────────────────┐                   │
│              │   pgvector Similarity    │                   │
│              │   (cosine distance)      │                   │
│              └──────────────────────────┘                   │
│                             │                                │
│                             ▼                                │
│              ┌──────────────────────────┐                   │
│              │   Filter & Rank          │                   │
│              │   - Location match       │                   │
│              │   - Salary range         │                   │
│              │   - Required skills      │                   │
│              │   - Experience level     │                   │
│              └──────────────────────────┘                   │
│                             │                                │
│                             ▼                                │
│              ┌──────────────────────────┐                   │
│              │   Score Calculation      │                   │
│              │   - Semantic: 60%        │                   │
│              │   - Skills: 25%          │                   │
│              │   - Other: 15%           │                   │
│              └──────────────────────────┘                   │
│                             │                                │
│                             ▼                                │
│  Output: Ranked Candidates with Scores                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Tareas

### Fase 1: Servicio de Matching

#### T25.1: Crear MatchingService principal
```python
# apps/api/app/services/matching_service.py

from typing import List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.candidate import CandidateProfile
from app.models.job import Job
from app.services.embedding_service import embedding_service
from app.core.logging import logger


@dataclass
class MatchResult:
    """Resultado de un match."""
    id: str
    score: float  # 0-100
    semantic_score: float  # Score de similaridad vectorial
    skills_score: float  # Score de match de skills
    metadata: dict  # Info adicional (nombre, título, etc.)


@dataclass
class MatchFilters:
    """Filtros opcionales para el matching."""
    min_score: float = 0.0  # Score mínimo (0-100)
    location: Optional[str] = None
    remote_only: bool = False
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    required_skills: Optional[List[str]] = None
    experience_years_min: Optional[int] = None
    experience_years_max: Optional[int] = None


class MatchingService:
    """
    Motor de matching usando embeddings y filtros adicionales.
    
    Scoring:
    - Semantic similarity (embeddings): 60%
    - Skills match: 25%
    - Other factors: 15%
    """
    
    # Pesos para el score final
    WEIGHT_SEMANTIC = 0.60
    WEIGHT_SKILLS = 0.25
    WEIGHT_OTHER = 0.15
    
    # Umbral mínimo de similaridad coseno para considerar match
    MIN_COSINE_SIMILARITY = 0.5
    
    async def find_candidates_for_job(
        self,
        db: Session,
        job_id: str,
        limit: int = 20,
        filters: Optional[MatchFilters] = None
    ) -> List[MatchResult]:
        """
        Encontrar candidatos que matchean con una vacante.
        
        Args:
            db: Database session
            job_id: ID de la vacante
            limit: Número máximo de resultados
            filters: Filtros opcionales
            
        Returns:
            Lista de MatchResult ordenada por score (mayor a menor)
        """
        filters = filters or MatchFilters()
        
        # Obtener la vacante
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.warning(f"Job {job_id} not found")
            return []
        
        # Verificar que tiene embedding
        if job.job_embedding is None:
            logger.warning(f"Job {job_id} has no embedding, generating...")
            from app.services.profile_embedding_service import profile_embedding_service
            await profile_embedding_service.generate_job_embedding(db, job_id, force=True)
            db.refresh(job)
        
        if job.job_embedding is None:
            logger.error(f"Could not generate embedding for job {job_id}")
            return []
        
        # Buscar candidatos similares usando pgvector
        # La distancia coseno en pgvector es 1 - similarity, así que ordenamos ASC
        query = text("""
            SELECT 
                cp.id,
                cp.user_id,
                cp.full_name,
                cp.headline,
                cp.skills,
                cp.profile_embedding,
                1 - (cp.profile_embedding <=> :job_embedding) as cosine_similarity
            FROM candidate_profiles cp
            WHERE cp.profile_embedding IS NOT NULL
            AND 1 - (cp.profile_embedding <=> :job_embedding) >= :min_similarity
            ORDER BY cp.profile_embedding <=> :job_embedding ASC
            LIMIT :limit
        """)
        
        result = db.execute(query, {
            "job_embedding": str(job.job_embedding),
            "min_similarity": self.MIN_COSINE_SIMILARITY,
            "limit": limit * 2  # Traer más para filtrar después
        })
        
        candidates = result.fetchall()
        
        # Procesar y calcular scores
        matches = []
        for row in candidates:
            # Calcular score de skills
            skills_score = self._calculate_skills_score(
                candidate_skills=row.skills or [],
                required_skills=job.skills_required or []
            )
            
            # Calcular score semántico (convertir similaridad coseno a 0-100)
            semantic_score = row.cosine_similarity * 100
            
            # Calcular score final ponderado
            final_score = (
                semantic_score * self.WEIGHT_SEMANTIC +
                skills_score * self.WEIGHT_SKILLS +
                self._calculate_other_score(row, job, filters) * self.WEIGHT_OTHER
            )
            
            # Aplicar filtros
            if final_score < filters.min_score:
                continue
            
            if not self._passes_filters(row, filters):
                continue
            
            matches.append(MatchResult(
                id=row.id,
                score=round(final_score, 1),
                semantic_score=round(semantic_score, 1),
                skills_score=round(skills_score, 1),
                metadata={
                    "name": row.full_name,
                    "headline": row.headline,
                    "skills": row.skills[:5] if row.skills else [],
                }
            ))
        
        # Ordenar por score y limitar
        matches.sort(key=lambda x: x.score, reverse=True)
        return matches[:limit]
    
    async def find_jobs_for_candidate(
        self,
        db: Session,
        candidate_id: str,
        limit: int = 20,
        filters: Optional[MatchFilters] = None
    ) -> List[MatchResult]:
        """
        Encontrar vacantes que matchean con un candidato.
        """
        filters = filters or MatchFilters()
        
        # Obtener el candidato
        profile = db.query(CandidateProfile).filter(
            CandidateProfile.id == candidate_id
        ).first()
        
        if not profile:
            logger.warning(f"Candidate {candidate_id} not found")
            return []
        
        # Verificar embedding
        if profile.profile_embedding is None:
            logger.warning(f"Candidate {candidate_id} has no embedding, generating...")
            from app.services.profile_embedding_service import profile_embedding_service
            await profile_embedding_service.generate_candidate_embedding(db, candidate_id, force=True)
            db.refresh(profile)
        
        if profile.profile_embedding is None:
            logger.error(f"Could not generate embedding for candidate {candidate_id}")
            return []
        
        # Buscar vacantes similares
        query = text("""
            SELECT 
                j.id,
                j.title,
                j.company_id,
                j.skills_required,
                j.location,
                j.remote_type,
                j.salary_min,
                j.salary_max,
                j.job_embedding,
                1 - (j.job_embedding <=> :candidate_embedding) as cosine_similarity
            FROM jobs j
            WHERE j.job_embedding IS NOT NULL
            AND j.status = 'active'
            AND 1 - (j.job_embedding <=> :candidate_embedding) >= :min_similarity
            ORDER BY j.job_embedding <=> :candidate_embedding ASC
            LIMIT :limit
        """)
        
        result = db.execute(query, {
            "candidate_embedding": str(profile.profile_embedding),
            "min_similarity": self.MIN_COSINE_SIMILARITY,
            "limit": limit * 2
        })
        
        jobs = result.fetchall()
        
        matches = []
        for row in jobs:
            skills_score = self._calculate_skills_score(
                candidate_skills=profile.skills or [],
                required_skills=row.skills_required or []
            )
            
            semantic_score = row.cosine_similarity * 100
            
            final_score = (
                semantic_score * self.WEIGHT_SEMANTIC +
                skills_score * self.WEIGHT_SKILLS +
                self._calculate_job_other_score(row, profile, filters) * self.WEIGHT_OTHER
            )
            
            if final_score < filters.min_score:
                continue
            
            if not self._job_passes_filters(row, filters):
                continue
            
            matches.append(MatchResult(
                id=row.id,
                score=round(final_score, 1),
                semantic_score=round(semantic_score, 1),
                skills_score=round(skills_score, 1),
                metadata={
                    "title": row.title,
                    "company_id": row.company_id,
                    "location": row.location,
                    "remote_type": row.remote_type,
                    "salary_range": f"${row.salary_min}-${row.salary_max}" if row.salary_min else None,
                }
            ))
        
        matches.sort(key=lambda x: x.score, reverse=True)
        return matches[:limit]
    
    def _calculate_skills_score(
        self,
        candidate_skills: List[str],
        required_skills: List[str]
    ) -> float:
        """
        Calcular score basado en match de skills.
        Retorna 0-100.
        """
        if not required_skills:
            return 50.0  # Score neutral si no hay requisitos
        
        if not candidate_skills:
            return 0.0
        
        # Normalizar skills a lowercase
        candidate_set = set(s.lower().strip() for s in candidate_skills)
        required_set = set(s.lower().strip() for s in required_skills)
        
        # Calcular intersección
        matches = candidate_set.intersection(required_set)
        
        # Score = porcentaje de skills requeridos que tiene el candidato
        score = (len(matches) / len(required_set)) * 100
        
        return min(score, 100.0)
    
    def _calculate_other_score(
        self,
        candidate_row,
        job: Job,
        filters: MatchFilters
    ) -> float:
        """
        Calcular score de otros factores (ubicación, etc.).
        """
        score = 50.0  # Base neutral
        
        # Bonus por ubicación match
        # TODO: Implementar cuando tengamos datos de ubicación
        
        return score
    
    def _calculate_job_other_score(
        self,
        job_row,
        profile: CandidateProfile,
        filters: MatchFilters
    ) -> float:
        """
        Calcular score de otros factores para matching de jobs.
        """
        score = 50.0
        
        # Bonus por remote si el candidato lo prefiere
        if job_row.remote_type == "remote":
            score += 10.0
        
        return min(score, 100.0)
    
    def _passes_filters(self, candidate_row, filters: MatchFilters) -> bool:
        """Verificar si el candidato pasa los filtros."""
        # TODO: Implementar filtros adicionales
        return True
    
    def _job_passes_filters(self, job_row, filters: MatchFilters) -> bool:
        """Verificar si la vacante pasa los filtros."""
        if filters.remote_only and job_row.remote_type != "remote":
            return False
        
        if filters.salary_min and job_row.salary_max:
            if job_row.salary_max < filters.salary_min:
                return False
        
        if filters.salary_max and job_row.salary_min:
            if job_row.salary_min > filters.salary_max:
                return False
        
        return True
    
    async def calculate_match_score(
        self,
        db: Session,
        candidate_id: str,
        job_id: str
    ) -> Optional[MatchResult]:
        """
        Calcular el score de match entre un candidato y una vacante específicos.
        """
        profile = db.query(CandidateProfile).filter(
            CandidateProfile.id == candidate_id
        ).first()
        
        job = db.query(Job).filter(Job.id == job_id).first()
        
        if not profile or not job:
            return None
        
        # Asegurar embeddings
        if profile.profile_embedding is None or job.job_embedding is None:
            from app.services.profile_embedding_service import profile_embedding_service
            if profile.profile_embedding is None:
                await profile_embedding_service.generate_candidate_embedding(db, candidate_id)
            if job.job_embedding is None:
                await profile_embedding_service.generate_job_embedding(db, job_id)
            db.refresh(profile)
            db.refresh(job)
        
        if profile.profile_embedding is None or job.job_embedding is None:
            return None
        
        # Calcular similaridad
        semantic_score = embedding_service.cosine_similarity(
            profile.profile_embedding,
            job.job_embedding
        ) * 100
        
        skills_score = self._calculate_skills_score(
            profile.skills or [],
            job.skills_required or []
        )
        
        final_score = (
            semantic_score * self.WEIGHT_SEMANTIC +
            skills_score * self.WEIGHT_SKILLS +
            50.0 * self.WEIGHT_OTHER  # Score neutral para otros factores
        )
        
        return MatchResult(
            id=f"{candidate_id}_{job_id}",
            score=round(final_score, 1),
            semantic_score=round(semantic_score, 1),
            skills_score=round(skills_score, 1),
            metadata={
                "candidate_name": profile.full_name,
                "job_title": job.title,
            }
        )


# Singleton
matching_service = MatchingService()
```

---

### Fase 2: Modelo de Match Guardado

#### T25.2: Modelo para guardar matches
```python
# apps/api/app/models/match.py

from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
import enum


class MatchStatus(str, enum.Enum):
    PENDING = "pending"  # Match encontrado, no revisado
    REVIEWED = "reviewed"  # Reclutador lo revisó
    SHORTLISTED = "shortlisted"  # Agregado a shortlist
    REJECTED = "rejected"  # Rechazado por reclutador
    APPLIED = "applied"  # Candidato aplicó
    HIRED = "hired"  # Contratado


class CandidateJobMatch(Base):
    """
    Registro de match entre candidato y vacante.
    Guarda el score y estado del match.
    """
    __tablename__ = "candidate_job_matches"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    candidate_id = Column(String, ForeignKey("candidate_profiles.id"), nullable=False)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False)
    
    # Scores
    overall_score = Column(Float, nullable=False)
    semantic_score = Column(Float)
    skills_score = Column(Float)
    
    # Estado
    status = Column(String, default="pending")
    
    # Metadata adicional
    match_metadata = Column(JSON, default=dict)
    
    # Notas del reclutador
    recruiter_notes = Column(String, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, server_default="now()")
    updated_at = Column(DateTime, server_default="now()", onupdate="now()")
    reviewed_at = Column(DateTime, nullable=True)
    
    # Relationships
    candidate = relationship("CandidateProfile")
    job = relationship("Job")
    
    # Índice único para evitar duplicados
    __table_args__ = (
        # Un candidato solo puede tener un match por vacante
        {"sqlite_autoincrement": True},
    )
```

#### T25.3: Migración para tabla de matches
```python
# apps/api/alembic/versions/016_add_matches_table.py

"""Add candidate_job_matches table

Revision ID: 016
Revises: 015
Create Date: 2026-02-23
"""

from alembic import op
import sqlalchemy as sa

revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'candidate_job_matches',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidate_profiles.id'), nullable=False),
        sa.Column('job_id', sa.String(), sa.ForeignKey('jobs.id'), nullable=False),
        sa.Column('overall_score', sa.Float(), nullable=False),
        sa.Column('semantic_score', sa.Float(), nullable=True),
        sa.Column('skills_score', sa.Float(), nullable=True),
        sa.Column('status', sa.String(), default='pending'),
        sa.Column('match_metadata', sa.JSON(), default={}),
        sa.Column('recruiter_notes', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Índice único para candidate_id + job_id
    op.create_index(
        'ix_candidate_job_unique',
        'candidate_job_matches',
        ['candidate_id', 'job_id'],
        unique=True
    )
    
    # Índice para búsquedas por job
    op.create_index(
        'ix_matches_by_job',
        'candidate_job_matches',
        ['job_id', 'overall_score'],
    )
    
    # Índice para búsquedas por candidato
    op.create_index(
        'ix_matches_by_candidate',
        'candidate_job_matches',
        ['candidate_id', 'overall_score'],
    )

def downgrade() -> None:
    op.drop_index('ix_matches_by_candidate')
    op.drop_index('ix_matches_by_job')
    op.drop_index('ix_candidate_job_unique')
    op.drop_table('candidate_job_matches')
```

---

### Fase 3: API de Matching

#### T25.4: Router de matching
```python
# apps/api/app/routers/matching.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.database import get_db
from app.auth import get_current_user
from app.services.matching_service import matching_service, MatchFilters, MatchResult
from app.models.match import CandidateJobMatch

router = APIRouter(prefix="/matching", tags=["matching"])


# === Request/Response Models ===

class MatchFiltersRequest(BaseModel):
    min_score: float = 0.0
    location: Optional[str] = None
    remote_only: bool = False
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    required_skills: Optional[List[str]] = None


class MatchResultResponse(BaseModel):
    id: str
    score: float
    semantic_score: float
    skills_score: float
    metadata: dict


class SaveMatchRequest(BaseModel):
    candidate_id: str
    job_id: str


class UpdateMatchStatusRequest(BaseModel):
    status: str
    notes: Optional[str] = None


# === Endpoints ===

@router.get("/candidates-for-job/{job_id}", response_model=List[MatchResultResponse])
async def find_candidates_for_job(
    job_id: str,
    limit: int = Query(20, ge=1, le=100),
    min_score: float = Query(0, ge=0, le=100),
    remote_only: bool = False,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Encontrar candidatos que matchean con una vacante.
    Retorna lista ordenada por score de match.
    """
    filters = MatchFilters(
        min_score=min_score,
        remote_only=remote_only,
    )
    
    matches = await matching_service.find_candidates_for_job(
        db=db,
        job_id=job_id,
        limit=limit,
        filters=filters
    )
    
    return [
        MatchResultResponse(
            id=m.id,
            score=m.score,
            semantic_score=m.semantic_score,
            skills_score=m.skills_score,
            metadata=m.metadata
        )
        for m in matches
    ]


@router.get("/jobs-for-candidate/{candidate_id}", response_model=List[MatchResultResponse])
async def find_jobs_for_candidate(
    candidate_id: str,
    limit: int = Query(20, ge=1, le=100),
    min_score: float = Query(0, ge=0, le=100),
    remote_only: bool = False,
    salary_min: Optional[float] = None,
    salary_max: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Encontrar vacantes que matchean con un candidato.
    Útil para sugerencias de trabajo.
    """
    filters = MatchFilters(
        min_score=min_score,
        remote_only=remote_only,
        salary_min=salary_min,
        salary_max=salary_max,
    )
    
    matches = await matching_service.find_jobs_for_candidate(
        db=db,
        candidate_id=candidate_id,
        limit=limit,
        filters=filters
    )
    
    return [
        MatchResultResponse(
            id=m.id,
            score=m.score,
            semantic_score=m.semantic_score,
            skills_score=m.skills_score,
            metadata=m.metadata
        )
        for m in matches
    ]


@router.get("/score/{candidate_id}/{job_id}")
async def get_match_score(
    candidate_id: str,
    job_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Calcular score de match entre un candidato y vacante específicos.
    """
    result = await matching_service.calculate_match_score(
        db=db,
        candidate_id=candidate_id,
        job_id=job_id
    )
    
    if not result:
        raise HTTPException(404, "Could not calculate match score")
    
    return {
        "candidate_id": candidate_id,
        "job_id": job_id,
        "score": result.score,
        "semantic_score": result.semantic_score,
        "skills_score": result.skills_score,
        "metadata": result.metadata,
    }


@router.post("/save")
async def save_match(
    request: SaveMatchRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Guardar un match en la base de datos.
    Útil para trackear candidatos revisados.
    """
    # Verificar si ya existe
    existing = db.query(CandidateJobMatch).filter(
        CandidateJobMatch.candidate_id == request.candidate_id,
        CandidateJobMatch.job_id == request.job_id
    ).first()
    
    if existing:
        return {"message": "Match already exists", "match_id": existing.id}
    
    # Calcular scores
    result = await matching_service.calculate_match_score(
        db=db,
        candidate_id=request.candidate_id,
        job_id=request.job_id
    )
    
    if not result:
        raise HTTPException(400, "Could not calculate match")
    
    # Crear match
    match = CandidateJobMatch(
        candidate_id=request.candidate_id,
        job_id=request.job_id,
        overall_score=result.score,
        semantic_score=result.semantic_score,
        skills_score=result.skills_score,
        match_metadata=result.metadata,
        status="pending"
    )
    
    db.add(match)
    db.commit()
    db.refresh(match)
    
    return {"message": "Match saved", "match_id": match.id, "score": match.overall_score}


@router.patch("/status/{match_id}")
async def update_match_status(
    match_id: str,
    request: UpdateMatchStatusRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Actualizar estado de un match (reviewed, shortlisted, rejected).
    """
    match = db.query(CandidateJobMatch).filter(
        CandidateJobMatch.id == match_id
    ).first()
    
    if not match:
        raise HTTPException(404, "Match not found")
    
    valid_statuses = ["pending", "reviewed", "shortlisted", "rejected", "applied", "hired"]
    if request.status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid_statuses}")
    
    match.status = request.status
    if request.notes:
        match.recruiter_notes = request.notes
    
    if request.status in ["reviewed", "shortlisted", "rejected"]:
        match.reviewed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(match)
    
    return {"message": "Status updated", "match": match}


@router.get("/job/{job_id}/matches")
async def get_job_matches(
    job_id: str,
    status: Optional[str] = None,
    min_score: float = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Obtener todos los matches guardados para una vacante.
    """
    query = db.query(CandidateJobMatch).filter(
        CandidateJobMatch.job_id == job_id,
        CandidateJobMatch.overall_score >= min_score
    )
    
    if status:
        query = query.filter(CandidateJobMatch.status == status)
    
    matches = query.order_by(CandidateJobMatch.overall_score.desc()).limit(limit).all()
    
    return {"job_id": job_id, "matches": matches, "count": len(matches)}


@router.get("/candidate/{candidate_id}/matches")
async def get_candidate_matches(
    candidate_id: str,
    status: Optional[str] = None,
    min_score: float = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Obtener todos los matches de un candidato.
    """
    query = db.query(CandidateJobMatch).filter(
        CandidateJobMatch.candidate_id == candidate_id,
        CandidateJobMatch.overall_score >= min_score
    )
    
    if status:
        query = query.filter(CandidateJobMatch.status == status)
    
    matches = query.order_by(CandidateJobMatch.overall_score.desc()).limit(limit).all()
    
    return {"candidate_id": candidate_id, "matches": matches, "count": len(matches)}
```

---

### Fase 4: Auto-matching en Background

#### T25.5: Worker para generar matches automáticamente
```python
# apps/api/app/workers/matching_worker.py

from typing import List
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.job import Job
from app.models.candidate import CandidateProfile
from app.models.match import CandidateJobMatch
from app.services.matching_service import matching_service
from app.core.logging import logger


async def generate_matches_for_job(job_id: str, min_score: float = 70.0) -> int:
    """
    Generar matches automáticamente para una vacante nueva.
    Se puede llamar cuando se crea una vacante.
    """
    db = SessionLocal()
    try:
        matches = await matching_service.find_candidates_for_job(
            db=db,
            job_id=job_id,
            limit=50,
            filters=MatchFilters(min_score=min_score)
        )
        
        count = 0
        for match in matches:
            # Verificar si ya existe
            existing = db.query(CandidateJobMatch).filter(
                CandidateJobMatch.candidate_id == match.id,
                CandidateJobMatch.job_id == job_id
            ).first()
            
            if not existing:
                new_match = CandidateJobMatch(
                    candidate_id=match.id,
                    job_id=job_id,
                    overall_score=match.score,
                    semantic_score=match.semantic_score,
                    skills_score=match.skills_score,
                    match_metadata=match.metadata,
                    status="pending"
                )
                db.add(new_match)
                count += 1
        
        db.commit()
        logger.info(f"Generated {count} matches for job {job_id}")
        return count
        
    finally:
        db.close()


async def generate_matches_for_candidate(candidate_id: str, min_score: float = 70.0) -> int:
    """
    Generar matches para un candidato nuevo.
    Se puede llamar cuando un candidato completa su perfil.
    """
    db = SessionLocal()
    try:
        matches = await matching_service.find_jobs_for_candidate(
            db=db,
            candidate_id=candidate_id,
            limit=20,
            filters=MatchFilters(min_score=min_score)
        )
        
        count = 0
        for match in matches:
            existing = db.query(CandidateJobMatch).filter(
                CandidateJobMatch.candidate_id == candidate_id,
                CandidateJobMatch.job_id == match.id
            ).first()
            
            if not existing:
                new_match = CandidateJobMatch(
                    candidate_id=candidate_id,
                    job_id=match.id,
                    overall_score=match.score,
                    semantic_score=match.semantic_score,
                    skills_score=match.skills_score,
                    match_metadata=match.metadata,
                    status="pending"
                )
                db.add(new_match)
                count += 1
        
        db.commit()
        logger.info(f"Generated {count} matches for candidate {candidate_id}")
        return count
        
    finally:
        db.close()


async def refresh_all_matches(batch_size: int = 100) -> dict:
    """
    Regenerar todos los matches.
    Útil para recalcular después de cambios en el algoritmo.
    """
    db = SessionLocal()
    try:
        # Obtener todas las vacantes activas
        jobs = db.query(Job).filter(Job.status == "active").all()
        
        total_matches = 0
        for job in jobs:
            count = await generate_matches_for_job(job.id)
            total_matches += count
        
        return {
            "jobs_processed": len(jobs),
            "matches_generated": total_matches
        }
        
    finally:
        db.close()
```

---

### Fase 5: Tests

#### T25.6: Tests para matching service
```python
# apps/api/tests/test_matching_service.py

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.services.matching_service import MatchingService, MatchFilters

@pytest.fixture
def matching_service():
    return MatchingService()

class TestMatchingService:
    
    def test_calculate_skills_score_full_match(self, matching_service):
        candidate_skills = ["python", "react", "sql"]
        required_skills = ["python", "react", "sql"]
        
        score = matching_service._calculate_skills_score(candidate_skills, required_skills)
        assert score == 100.0
    
    def test_calculate_skills_score_partial_match(self, matching_service):
        candidate_skills = ["python", "javascript"]
        required_skills = ["python", "react", "sql", "javascript"]
        
        score = matching_service._calculate_skills_score(candidate_skills, required_skills)
        assert score == 50.0  # 2 de 4
    
    def test_calculate_skills_score_no_match(self, matching_service):
        candidate_skills = ["java", "c++"]
        required_skills = ["python", "react"]
        
        score = matching_service._calculate_skills_score(candidate_skills, required_skills)
        assert score == 0.0
    
    def test_calculate_skills_score_case_insensitive(self, matching_service):
        candidate_skills = ["Python", "REACT"]
        required_skills = ["python", "react"]
        
        score = matching_service._calculate_skills_score(candidate_skills, required_skills)
        assert score == 100.0
    
    def test_calculate_skills_score_no_requirements(self, matching_service):
        candidate_skills = ["python"]
        required_skills = []
        
        score = matching_service._calculate_skills_score(candidate_skills, required_skills)
        assert score == 50.0  # Neutral
    
    def test_job_passes_filters_remote(self, matching_service):
        job_row = MagicMock(remote_type="remote", salary_min=1000, salary_max=2000)
        filters = MatchFilters(remote_only=True)
        
        assert matching_service._job_passes_filters(job_row, filters) == True
    
    def test_job_fails_filters_remote(self, matching_service):
        job_row = MagicMock(remote_type="onsite", salary_min=1000, salary_max=2000)
        filters = MatchFilters(remote_only=True)
        
        assert matching_service._job_passes_filters(job_row, filters) == False
    
    def test_job_passes_filters_salary(self, matching_service):
        job_row = MagicMock(remote_type="remote", salary_min=1500, salary_max=3000)
        filters = MatchFilters(salary_min=1000, salary_max=4000)
        
        assert matching_service._job_passes_filters(job_row, filters) == True
```

---

## ✅ Checklist de Verificación

### Servicios
- [ ] MatchingService encuentra candidatos para job
- [ ] MatchingService encuentra jobs para candidate
- [ ] Skills score calcula correctamente
- [ ] Filtros funcionan (remote, salary, min_score)

### Base de Datos
- [ ] Migración 016 aplicada
- [ ] Tabla candidate_job_matches creada
- [ ] Índices creados

### API
- [ ] `GET /matching/candidates-for-job/{id}` funciona
- [ ] `GET /matching/jobs-for-candidate/{id}` funciona
- [ ] `GET /matching/score/{candidate}/{job}` funciona
- [ ] `POST /matching/save` guarda match
- [ ] `PATCH /matching/status/{id}` actualiza estado

### Tests
- [ ] Tests de skills score pasan
- [ ] Tests de filtros pasan

---

## 📝 Output Esperado

```markdown
## Prompt 25 Complete - Matching Engine

### Services
- [x] MatchingService with vector similarity search
- [x] Skills matching algorithm
- [x] Filtering by location, salary, remote

### Database
- [x] CandidateJobMatch model
- [x] Migration with indexes

### API Endpoints
- [x] Find candidates for job
- [x] Find jobs for candidate
- [x] Calculate match score
- [x] Save/update match status

### Files Created
- apps/api/app/services/matching_service.py
- apps/api/app/models/match.py
- apps/api/app/routers/matching.py
- apps/api/app/workers/matching_worker.py
- apps/api/alembic/versions/016_add_matches_table.py
- apps/api/tests/test_matching_service.py

### Ready For
- Prompt 26: UI de matching
```

---

## 🚨 Cuando Termines

1. **Ejecutar migración**:
```bash
cd apps/api && alembic upgrade head
```

2. **Registrar router**:
```python
# apps/api/app/main.py
from app.routers.matching import router as matching_router
app.include_router(matching_router)
```

3. **Actualizar `tasks/todo.md`**

4. **Commit**:
```bash
git add .
git commit -m "feat(ai): add matching engine with vector similarity search

- Add MatchingService for candidate-job matching
- Implement skills matching algorithm
- Add CandidateJobMatch model for tracking
- Create API endpoints for matching operations
- Include filtering by remote, salary, score"
git push
```
