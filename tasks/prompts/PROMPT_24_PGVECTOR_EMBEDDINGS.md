# 🧠 Prompt 24: Setup pgvector + Embeddings para Matching IA

---

## 🔴 METODOLOGÍA DE TRABAJO (LEER PRIMERO)

### Antes de Empezar
```bash
# 1. Leer backlog actual
cat tasks/todo.md

# 2. Leer lecciones aprendidas
cat tasks/lessons.md

# 3. Verificar que los servicios funcionan
cd apps/api && uvicorn app.main:app --reload
cd apps/web && npm run dev
```

### Core Principles
- **Simplicity First**: Implementación mínima viable primero
- **No Laziness**: Embeddings de calidad, no shortcuts
- **Minimal Impact**: No romper funcionalidad existente
- **Verification**: Tests para cada componente

---

## 🎯 Objetivo

Configurar la infraestructura de **vector search** para el matching inteligente candidato-vacante:

1. Instalar y configurar **pgvector** en PostgreSQL
2. Crear servicio de **embeddings** con OpenAI
3. Agregar columnas de vectores a candidatos y vacantes
4. Crear índices para búsqueda eficiente
5. Implementar funciones de similaridad

---

## 📋 Contexto

### ¿Qué es pgvector?
Extensión de PostgreSQL para almacenar y buscar vectores (embeddings). Permite:
- Almacenar embeddings de 1536 dimensiones (OpenAI ada-002)
- Búsqueda por similaridad coseno/euclidiana
- Índices HNSW para búsquedas rápidas

### ¿Cómo funciona el matching?
```
1. Candidato sube CV → Extraemos texto → Generamos embedding
2. Employer crea vacante → Extraemos requisitos → Generamos embedding
3. Búsqueda: Encontrar candidatos cuyo embedding sea similar al de la vacante
4. Resultado: Lista ordenada por % de match
```

---

## ✅ Tareas

### Fase 1: Configurar pgvector

#### T24.1: Instalar extensión pgvector en PostgreSQL

**Opción A: PostgreSQL local con Docker**
```bash
# Si usas Docker, agregar pgvector a la imagen
# docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg16
    # ... resto de config
```

**Opción B: PostgreSQL existente**
```sql
-- Conectar a la base de datos y ejecutar:
CREATE EXTENSION IF NOT EXISTS vector;

-- Verificar instalación
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**Opción C: Supabase/Neon (cloud)**
```sql
-- En el SQL editor de Supabase:
CREATE EXTENSION IF NOT EXISTS vector;
```

#### T24.2: Crear migración para extensión
```python
# apps/api/alembic/versions/013_add_pgvector_extension.py

"""Add pgvector extension

Revision ID: 013
Revises: 012
Create Date: 2026-02-23
"""

from alembic import op

revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Crear extensión pgvector
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

def downgrade() -> None:
    op.execute('DROP EXTENSION IF EXISTS vector')
```

---

### Fase 2: Servicio de Embeddings

#### T24.3: Crear servicio de embeddings con OpenAI
```python
# apps/api/app/services/embedding_service.py

import openai
from typing import List, Optional
import numpy as np
from pydantic import BaseModel
import hashlib
import json
from app.core.config import settings
from app.core.logging import logger

# Configurar cliente OpenAI
openai.api_key = settings.OPENAI_API_KEY

class EmbeddingResult(BaseModel):
    text: str
    embedding: List[float]
    model: str
    dimensions: int
    tokens_used: int


class EmbeddingService:
    """
    Servicio para generar embeddings usando OpenAI.
    
    Modelo: text-embedding-3-small (más barato) o text-embedding-ada-002
    Dimensiones: 1536
    """
    
    MODEL = "text-embedding-3-small"  # Más barato y eficiente
    DIMENSIONS = 1536
    MAX_TOKENS = 8191  # Límite del modelo
    
    def __init__(self):
        self.client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        self._cache = {}  # Cache simple en memoria
    
    def _get_cache_key(self, text: str) -> str:
        """Generar key de cache basado en hash del texto."""
        return hashlib.md5(text.encode()).hexdigest()
    
    def _truncate_text(self, text: str, max_chars: int = 30000) -> str:
        """Truncar texto si es muy largo."""
        if len(text) > max_chars:
            logger.warning(f"Text truncated from {len(text)} to {max_chars} chars")
            return text[:max_chars]
        return text
    
    async def generate_embedding(
        self, 
        text: str,
        use_cache: bool = True
    ) -> EmbeddingResult:
        """
        Generar embedding para un texto.
        
        Args:
            text: Texto a convertir en embedding
            use_cache: Si usar cache para evitar llamadas repetidas
            
        Returns:
            EmbeddingResult con el vector y metadata
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        # Limpiar y truncar texto
        clean_text = self._truncate_text(text.strip())
        
        # Verificar cache
        cache_key = self._get_cache_key(clean_text)
        if use_cache and cache_key in self._cache:
            logger.debug(f"Embedding cache hit for key {cache_key[:8]}")
            return self._cache[cache_key]
        
        try:
            response = self.client.embeddings.create(
                model=self.MODEL,
                input=clean_text,
                dimensions=self.DIMENSIONS
            )
            
            embedding = response.data[0].embedding
            tokens_used = response.usage.total_tokens
            
            result = EmbeddingResult(
                text=clean_text[:100] + "..." if len(clean_text) > 100 else clean_text,
                embedding=embedding,
                model=self.MODEL,
                dimensions=len(embedding),
                tokens_used=tokens_used
            )
            
            # Guardar en cache
            if use_cache:
                self._cache[cache_key] = result
            
            logger.info(f"Generated embedding: {len(embedding)} dims, {tokens_used} tokens")
            return result
            
        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise
    
    async def generate_embeddings_batch(
        self,
        texts: List[str],
        use_cache: bool = True
    ) -> List[EmbeddingResult]:
        """
        Generar embeddings para múltiples textos en batch.
        Más eficiente que llamadas individuales.
        """
        if not texts:
            return []
        
        # Limpiar textos
        clean_texts = [self._truncate_text(t.strip()) for t in texts if t and t.strip()]
        
        if not clean_texts:
            return []
        
        # Separar cached vs nuevos
        results = []
        texts_to_embed = []
        text_indices = []
        
        for i, text in enumerate(clean_texts):
            cache_key = self._get_cache_key(text)
            if use_cache and cache_key in self._cache:
                results.append((i, self._cache[cache_key]))
            else:
                texts_to_embed.append(text)
                text_indices.append(i)
        
        # Generar embeddings para textos no cacheados
        if texts_to_embed:
            try:
                response = self.client.embeddings.create(
                    model=self.MODEL,
                    input=texts_to_embed,
                    dimensions=self.DIMENSIONS
                )
                
                for j, embedding_data in enumerate(response.data):
                    original_idx = text_indices[j]
                    text = texts_to_embed[j]
                    
                    result = EmbeddingResult(
                        text=text[:100] + "..." if len(text) > 100 else text,
                        embedding=embedding_data.embedding,
                        model=self.MODEL,
                        dimensions=len(embedding_data.embedding),
                        tokens_used=response.usage.total_tokens // len(texts_to_embed)
                    )
                    
                    # Cache
                    if use_cache:
                        cache_key = self._get_cache_key(text)
                        self._cache[cache_key] = result
                    
                    results.append((original_idx, result))
                    
            except Exception as e:
                logger.error(f"Batch embedding failed: {e}")
                raise
        
        # Ordenar por índice original
        results.sort(key=lambda x: x[0])
        return [r[1] for r in results]
    
    def cosine_similarity(
        self, 
        embedding1: List[float], 
        embedding2: List[float]
    ) -> float:
        """Calcular similaridad coseno entre dos embeddings."""
        a = np.array(embedding1)
        b = np.array(embedding2)
        
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
    
    def clear_cache(self):
        """Limpiar cache de embeddings."""
        self._cache.clear()
        logger.info("Embedding cache cleared")


# Singleton
embedding_service = EmbeddingService()
```

#### T24.4: Agregar configuración de OpenAI
```python
# apps/api/app/core/config.py

# Agregar a Settings:
class Settings(BaseSettings):
    # ... existing settings ...
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    
    # Embeddings
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536
```

```bash
# .env
OPENAI_API_KEY=sk-your-api-key-here
```

---

### Fase 3: Modelos con Vectores

#### T24.5: Agregar columna de embedding a Candidate
```python
# apps/api/app/models/candidate.py

from sqlalchemy import Column, String, Text, DateTime, JSON
from pgvector.sqlalchemy import Vector  # Importar Vector type
from app.database import Base

class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    # Datos existentes
    full_name = Column(String)
    headline = Column(String)
    summary = Column(Text)
    skills = Column(JSON)  # ["python", "react", "sql"]
    experience = Column(JSON)  # Lista de experiencias
    education = Column(JSON)  # Lista de educación
    
    # CV
    cv_text = Column(Text)  # Texto extraído del CV
    cv_url = Column(String)
    
    # NUEVO: Embedding del perfil
    profile_embedding = Column(Vector(1536), nullable=True)
    embedding_updated_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, server_default="now()")
    updated_at = Column(DateTime, server_default="now()", onupdate="now()")
```

#### T24.6: Agregar columna de embedding a Job/Vacancy
```python
# apps/api/app/models/job.py

from sqlalchemy import Column, String, Text, DateTime, JSON, Integer, Numeric
from pgvector.sqlalchemy import Vector
from app.database import Base

class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False)
    
    # Datos existentes
    title = Column(String, nullable=False)
    description = Column(Text)
    requirements = Column(Text)
    responsibilities = Column(Text)
    skills_required = Column(JSON)  # ["python", "3+ years", "react"]
    
    # Compensation
    salary_min = Column(Numeric)
    salary_max = Column(Numeric)
    currency = Column(String, default="USD")
    
    # Location
    location = Column(String)
    remote_type = Column(String)  # remote, hybrid, onsite
    
    # Status
    status = Column(String, default="active")  # active, paused, closed
    
    # NUEVO: Embedding de la vacante
    job_embedding = Column(Vector(1536), nullable=True)
    embedding_updated_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, server_default="now()")
    updated_at = Column(DateTime, server_default="now()", onupdate="now()")
```

#### T24.7: Migración para agregar columnas de embedding
```python
# apps/api/alembic/versions/014_add_embedding_columns.py

"""Add embedding columns to candidates and jobs

Revision ID: 014
Revises: 013
Create Date: 2026-02-23
"""

from alembic import op
import sqlalchemy as sa

revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Agregar columna de embedding a candidate_profiles
    op.add_column(
        'candidate_profiles',
        sa.Column('profile_embedding', sa.LargeBinary(), nullable=True)
    )
    op.add_column(
        'candidate_profiles',
        sa.Column('embedding_updated_at', sa.DateTime(), nullable=True)
    )
    
    # Usar SQL raw para el tipo vector (pgvector)
    op.execute('''
        ALTER TABLE candidate_profiles 
        ALTER COLUMN profile_embedding TYPE vector(1536) 
        USING profile_embedding::vector(1536)
    ''')
    
    # Agregar columna de embedding a jobs
    op.add_column(
        'jobs',
        sa.Column('job_embedding', sa.LargeBinary(), nullable=True)
    )
    op.add_column(
        'jobs',
        sa.Column('embedding_updated_at', sa.DateTime(), nullable=True)
    )
    
    op.execute('''
        ALTER TABLE jobs 
        ALTER COLUMN job_embedding TYPE vector(1536) 
        USING job_embedding::vector(1536)
    ''')

def downgrade() -> None:
    op.drop_column('candidate_profiles', 'profile_embedding')
    op.drop_column('candidate_profiles', 'embedding_updated_at')
    op.drop_column('jobs', 'job_embedding')
    op.drop_column('jobs', 'embedding_updated_at')
```

---

### Fase 4: Índices para Búsqueda Eficiente

#### T24.8: Crear índices HNSW para búsqueda vectorial
```python
# apps/api/alembic/versions/015_add_vector_indexes.py

"""Add HNSW indexes for vector search

Revision ID: 015
Revises: 014
Create Date: 2026-02-23
"""

from alembic import op

revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Índice HNSW para candidate_profiles
    # HNSW = Hierarchical Navigable Small World (más rápido que IVFFlat)
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_candidate_embedding_hnsw 
        ON candidate_profiles 
        USING hnsw (profile_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    ''')
    
    # Índice HNSW para jobs
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_job_embedding_hnsw 
        ON jobs 
        USING hnsw (job_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    ''')

def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS idx_candidate_embedding_hnsw')
    op.execute('DROP INDEX IF EXISTS idx_job_embedding_hnsw')
```

**Nota sobre parámetros HNSW:**
- `m = 16`: Número de conexiones por nodo (más = más preciso, más lento)
- `ef_construction = 64`: Factor de construcción (más = mejor índice, más lento de construir)
- `vector_cosine_ops`: Usar similaridad coseno

---

### Fase 5: Funciones de Generación de Embeddings

#### T24.9: Servicio para generar embeddings de perfiles
```python
# apps/api/app/services/profile_embedding_service.py

from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.candidate import CandidateProfile
from app.models.job import Job
from app.services.embedding_service import embedding_service
from app.core.logging import logger


class ProfileEmbeddingService:
    """
    Servicio para generar y actualizar embeddings de perfiles y vacantes.
    """
    
    def _build_candidate_text(self, profile: CandidateProfile) -> str:
        """
        Construir texto representativo del candidato para embedding.
        Combina: headline, summary, skills, experiencia, educación, CV.
        """
        parts = []
        
        if profile.headline:
            parts.append(f"Title: {profile.headline}")
        
        if profile.summary:
            parts.append(f"Summary: {profile.summary}")
        
        if profile.skills:
            skills_text = ", ".join(profile.skills) if isinstance(profile.skills, list) else str(profile.skills)
            parts.append(f"Skills: {skills_text}")
        
        if profile.experience:
            exp_texts = []
            for exp in profile.experience if isinstance(profile.experience, list) else []:
                exp_text = f"{exp.get('title', '')} at {exp.get('company', '')}"
                if exp.get('description'):
                    exp_text += f": {exp.get('description')}"
                exp_texts.append(exp_text)
            if exp_texts:
                parts.append(f"Experience: {'; '.join(exp_texts)}")
        
        if profile.education:
            edu_texts = []
            for edu in profile.education if isinstance(profile.education, list) else []:
                edu_text = f"{edu.get('degree', '')} in {edu.get('field', '')} from {edu.get('institution', '')}"
                edu_texts.append(edu_text)
            if edu_texts:
                parts.append(f"Education: {'; '.join(edu_texts)}")
        
        if profile.cv_text:
            # Agregar extracto del CV (primeros 2000 chars)
            cv_excerpt = profile.cv_text[:2000]
            parts.append(f"CV: {cv_excerpt}")
        
        return "\n\n".join(parts)
    
    def _build_job_text(self, job: Job) -> str:
        """
        Construir texto representativo de la vacante para embedding.
        Combina: título, descripción, requisitos, responsabilidades, skills.
        """
        parts = []
        
        if job.title:
            parts.append(f"Position: {job.title}")
        
        if job.description:
            parts.append(f"Description: {job.description}")
        
        if job.requirements:
            parts.append(f"Requirements: {job.requirements}")
        
        if job.responsibilities:
            parts.append(f"Responsibilities: {job.responsibilities}")
        
        if job.skills_required:
            skills_text = ", ".join(job.skills_required) if isinstance(job.skills_required, list) else str(job.skills_required)
            parts.append(f"Required Skills: {skills_text}")
        
        if job.location:
            parts.append(f"Location: {job.location}")
        
        if job.remote_type:
            parts.append(f"Work Type: {job.remote_type}")
        
        return "\n\n".join(parts)
    
    async def generate_candidate_embedding(
        self,
        db: Session,
        candidate_id: str,
        force: bool = False
    ) -> Optional[CandidateProfile]:
        """
        Generar/actualizar embedding para un candidato.
        
        Args:
            db: Database session
            candidate_id: ID del candidato
            force: Si regenerar aunque ya tenga embedding
            
        Returns:
            CandidateProfile actualizado o None si no existe
        """
        profile = db.query(CandidateProfile).filter(
            CandidateProfile.id == candidate_id
        ).first()
        
        if not profile:
            logger.warning(f"Candidate {candidate_id} not found")
            return None
        
        # Si ya tiene embedding y no es force, skip
        if profile.profile_embedding is not None and not force:
            logger.info(f"Candidate {candidate_id} already has embedding, skipping")
            return profile
        
        # Construir texto
        text = self._build_candidate_text(profile)
        
        if not text.strip():
            logger.warning(f"Candidate {candidate_id} has no text content for embedding")
            return profile
        
        # Generar embedding
        result = await embedding_service.generate_embedding(text)
        
        # Actualizar perfil
        profile.profile_embedding = result.embedding
        profile.embedding_updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(profile)
        
        logger.info(f"Generated embedding for candidate {candidate_id}")
        return profile
    
    async def generate_job_embedding(
        self,
        db: Session,
        job_id: str,
        force: bool = False
    ) -> Optional[Job]:
        """
        Generar/actualizar embedding para una vacante.
        """
        job = db.query(Job).filter(Job.id == job_id).first()
        
        if not job:
            logger.warning(f"Job {job_id} not found")
            return None
        
        if job.job_embedding is not None and not force:
            logger.info(f"Job {job_id} already has embedding, skipping")
            return job
        
        text = self._build_job_text(job)
        
        if not text.strip():
            logger.warning(f"Job {job_id} has no text content for embedding")
            return job
        
        result = await embedding_service.generate_embedding(text)
        
        job.job_embedding = result.embedding
        job.embedding_updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(job)
        
        logger.info(f"Generated embedding for job {job_id}")
        return job
    
    async def bulk_generate_candidate_embeddings(
        self,
        db: Session,
        limit: int = 100,
        force: bool = False
    ) -> int:
        """
        Generar embeddings para candidatos que no tienen.
        Útil para migración inicial.
        """
        query = db.query(CandidateProfile)
        
        if not force:
            query = query.filter(CandidateProfile.profile_embedding.is_(None))
        
        profiles = query.limit(limit).all()
        
        count = 0
        for profile in profiles:
            try:
                await self.generate_candidate_embedding(db, profile.id, force=True)
                count += 1
            except Exception as e:
                logger.error(f"Failed to generate embedding for candidate {profile.id}: {e}")
        
        logger.info(f"Generated {count} candidate embeddings")
        return count
    
    async def bulk_generate_job_embeddings(
        self,
        db: Session,
        limit: int = 100,
        force: bool = False
    ) -> int:
        """
        Generar embeddings para vacantes que no tienen.
        """
        query = db.query(Job)
        
        if not force:
            query = query.filter(Job.job_embedding.is_(None))
        
        jobs = query.limit(limit).all()
        
        count = 0
        for job in jobs:
            try:
                await self.generate_job_embedding(db, job.id, force=True)
                count += 1
            except Exception as e:
                logger.error(f"Failed to generate embedding for job {job.id}: {e}")
        
        logger.info(f"Generated {count} job embeddings")
        return count


# Singleton
profile_embedding_service = ProfileEmbeddingService()
```

---

### Fase 6: API Endpoints

#### T24.10: Router para embeddings
```python
# apps/api/app/routers/embeddings.py

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user, require_admin
from app.services.profile_embedding_service import profile_embedding_service
from pydantic import BaseModel

router = APIRouter(prefix="/embeddings", tags=["embeddings"])


class BulkGenerateRequest(BaseModel):
    entity_type: str  # "candidates" or "jobs"
    limit: int = 100
    force: bool = False


class BulkGenerateResponse(BaseModel):
    message: str
    count: int


@router.post("/generate/candidate/{candidate_id}")
async def generate_candidate_embedding(
    candidate_id: str,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Generar embedding para un candidato específico."""
    profile = await profile_embedding_service.generate_candidate_embedding(
        db, candidate_id, force=force
    )
    
    if not profile:
        raise HTTPException(404, "Candidate not found")
    
    return {
        "message": "Embedding generated",
        "candidate_id": candidate_id,
        "has_embedding": profile.profile_embedding is not None,
        "updated_at": profile.embedding_updated_at,
    }


@router.post("/generate/job/{job_id}")
async def generate_job_embedding(
    job_id: str,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Generar embedding para una vacante específica."""
    job = await profile_embedding_service.generate_job_embedding(
        db, job_id, force=force
    )
    
    if not job:
        raise HTTPException(404, "Job not found")
    
    return {
        "message": "Embedding generated",
        "job_id": job_id,
        "has_embedding": job.job_embedding is not None,
        "updated_at": job.embedding_updated_at,
    }


@router.post("/generate/bulk", response_model=BulkGenerateResponse)
async def bulk_generate_embeddings(
    request: BulkGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin),
):
    """
    Generar embeddings en bulk (solo admin).
    Corre en background para no bloquear.
    """
    if request.entity_type == "candidates":
        count = await profile_embedding_service.bulk_generate_candidate_embeddings(
            db, limit=request.limit, force=request.force
        )
    elif request.entity_type == "jobs":
        count = await profile_embedding_service.bulk_generate_job_embeddings(
            db, limit=request.limit, force=request.force
        )
    else:
        raise HTTPException(400, "entity_type must be 'candidates' or 'jobs'")
    
    return BulkGenerateResponse(
        message=f"Generated embeddings for {count} {request.entity_type}",
        count=count
    )


@router.get("/stats")
async def get_embedding_stats(
    db: Session = Depends(get_db),
    current_user = Depends(require_admin),
):
    """Obtener estadísticas de embeddings (solo admin)."""
    from app.models.candidate import CandidateProfile
    from app.models.job import Job
    
    total_candidates = db.query(CandidateProfile).count()
    candidates_with_embedding = db.query(CandidateProfile).filter(
        CandidateProfile.profile_embedding.isnot(None)
    ).count()
    
    total_jobs = db.query(Job).count()
    jobs_with_embedding = db.query(Job).filter(
        Job.job_embedding.isnot(None)
    ).count()
    
    return {
        "candidates": {
            "total": total_candidates,
            "with_embedding": candidates_with_embedding,
            "percentage": round(candidates_with_embedding / total_candidates * 100, 1) if total_candidates > 0 else 0,
        },
        "jobs": {
            "total": total_jobs,
            "with_embedding": jobs_with_embedding,
            "percentage": round(jobs_with_embedding / total_jobs * 100, 1) if total_jobs > 0 else 0,
        },
    }
```

---

### Fase 7: Tests

#### T24.11: Tests para embedding service
```python
# apps/api/tests/test_embedding_service.py

import pytest
from unittest.mock import patch, MagicMock
from app.services.embedding_service import EmbeddingService, EmbeddingResult

@pytest.fixture
def embedding_service():
    return EmbeddingService()

@pytest.fixture
def mock_openai_response():
    return MagicMock(
        data=[MagicMock(embedding=[0.1] * 1536)],
        usage=MagicMock(total_tokens=100)
    )

class TestEmbeddingService:
    
    @pytest.mark.asyncio
    async def test_generate_embedding_returns_correct_dimensions(
        self, embedding_service, mock_openai_response
    ):
        with patch.object(
            embedding_service.client.embeddings, 
            'create', 
            return_value=mock_openai_response
        ):
            result = await embedding_service.generate_embedding("Test text")
            
            assert len(result.embedding) == 1536
            assert result.model == "text-embedding-3-small"
            assert result.dimensions == 1536
    
    @pytest.mark.asyncio
    async def test_generate_embedding_uses_cache(
        self, embedding_service, mock_openai_response
    ):
        with patch.object(
            embedding_service.client.embeddings,
            'create',
            return_value=mock_openai_response
        ) as mock_create:
            # Primera llamada
            await embedding_service.generate_embedding("Same text")
            # Segunda llamada (debe usar cache)
            await embedding_service.generate_embedding("Same text")
            
            # Solo debe llamar a OpenAI una vez
            assert mock_create.call_count == 1
    
    @pytest.mark.asyncio
    async def test_generate_embedding_empty_text_raises(self, embedding_service):
        with pytest.raises(ValueError, match="cannot be empty"):
            await embedding_service.generate_embedding("")
    
    def test_cosine_similarity_identical_vectors(self, embedding_service):
        vector = [0.1] * 1536
        similarity = embedding_service.cosine_similarity(vector, vector)
        assert abs(similarity - 1.0) < 0.0001
    
    def test_cosine_similarity_orthogonal_vectors(self, embedding_service):
        vector1 = [1.0] + [0.0] * 1535
        vector2 = [0.0, 1.0] + [0.0] * 1534
        similarity = embedding_service.cosine_similarity(vector1, vector2)
        assert abs(similarity) < 0.0001
```

---

## ✅ Checklist de Verificación

### Instalación
- [ ] pgvector instalado en PostgreSQL
- [ ] Extensión vector creada en la base de datos
- [ ] `pgvector` package instalado: `pip install pgvector`

### Migraciones
- [ ] Migración 013: CREATE EXTENSION vector
- [ ] Migración 014: Columnas de embedding agregadas
- [ ] Migración 015: Índices HNSW creados
- [ ] `alembic upgrade head` ejecutado sin errores

### Servicios
- [ ] EmbeddingService genera embeddings correctamente
- [ ] ProfileEmbeddingService construye texto apropiado
- [ ] Cache de embeddings funciona
- [ ] Batch embeddings funciona

### API
- [ ] `POST /embeddings/generate/candidate/{id}` funciona
- [ ] `POST /embeddings/generate/job/{id}` funciona
- [ ] `POST /embeddings/generate/bulk` funciona (admin only)
- [ ] `GET /embeddings/stats` retorna estadísticas

### Tests
- [ ] Tests de embedding service pasan
- [ ] Tests de API pasan

---

## 📝 Output Esperado

```markdown
## Prompt 24 Complete - pgvector + Embeddings Setup

### Database
- [x] pgvector extension installed
- [x] 3 migrations applied (extension, columns, indexes)
- [x] HNSW indexes created for fast vector search

### Services
- [x] EmbeddingService with OpenAI integration
- [x] ProfileEmbeddingService for candidates/jobs
- [x] Caching and batch processing

### API Endpoints
- [x] POST /embeddings/generate/candidate/{id}
- [x] POST /embeddings/generate/job/{id}
- [x] POST /embeddings/generate/bulk (admin)
- [x] GET /embeddings/stats (admin)

### Files Created
- apps/api/app/services/embedding_service.py
- apps/api/app/services/profile_embedding_service.py
- apps/api/app/routers/embeddings.py
- apps/api/alembic/versions/013_add_pgvector_extension.py
- apps/api/alembic/versions/014_add_embedding_columns.py
- apps/api/alembic/versions/015_add_vector_indexes.py
- apps/api/tests/test_embedding_service.py

### Ready For
- Prompt 25: Matching engine using vector similarity
```

---

## 🚨 Cuando Termines

1. **Instalar dependencias**:
```bash
cd apps/api
pip install pgvector openai numpy --break-system-packages
```

2. **Ejecutar migraciones**:
```bash
alembic upgrade head
```

3. **Verificar en PostgreSQL**:
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
\d candidate_profiles  -- debe mostrar columna profile_embedding
\d jobs  -- debe mostrar columna job_embedding
```

4. **Actualizar `tasks/todo.md`**

5. **Commit**:
```bash
git add .
git commit -m "feat(ai): add pgvector embeddings infrastructure for matching

- Add pgvector extension and HNSW indexes
- Create EmbeddingService with OpenAI integration
- Add embedding columns to candidates and jobs
- Add API endpoints for embedding generation
- Include caching and batch processing"
git push
```
