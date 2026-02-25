# Prompt 27: Video Interviews - Infraestructura LiveKit + Pipecat

## 🎯 Objetivo
Configurar la infraestructura de video/audio en tiempo real usando LiveKit para WebRTC y Pipecat como pipeline de IA conversacional.

## 📚 Antes de Comenzar
```bash
# OBLIGATORIO: Revisar documentación del proyecto
cat tasks/todo.md
cat tasks/lessons.md
```

## 🏗️ Arquitectura de Video Interviews

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Candidate     │────▶│   LiveKit    │────▶│   Pipecat       │
│   Browser       │     │   Server     │     │   Pipeline      │
│   (WebRTC)      │◀────│   (SFU)      │◀────│   (AI Agent)    │
└─────────────────┘     └──────────────┘     └─────────────────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              ▼                     ▼                     ▼
                        ┌──────────┐         ┌──────────┐         ┌──────────┐
                        │ Deepgram │         │  Claude  │         │ElevenLabs│
                        │   STT    │         │   LLM    │         │   TTS    │
                        └──────────┘         └──────────┘         └──────────┘
```

## 📦 Dependencias a Instalar

### Backend (apps/api)
```bash
cd apps/api
pip install livekit livekit-api pipecat-ai pipecat-ai[livekit,deepgram,anthropic,elevenlabs]
```

### Frontend (apps/web)
```bash
cd apps/web
pnpm add @livekit/components-react @livekit/components-styles livekit-client
```

## 📋 Tareas

### T27.1: Configuración LiveKit Cloud

#### Variables de Entorno
Agregar a `.env` (backend) y `.env.local` (frontend):

```env
# LiveKit (obtener de https://cloud.livekit.io)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# Deepgram (https://console.deepgram.com)
DEEPGRAM_API_KEY=your-deepgram-key

# ElevenLabs (https://elevenlabs.io)
ELEVENLABS_API_KEY=your-elevenlabs-key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Rachel - professional female

# Anthropic (ya deberías tenerlo)
ANTHROPIC_API_KEY=your-anthropic-key
```

#### Verificación
- [ ] Cuenta LiveKit Cloud creada (free tier: 50 participant-minutes/month)
- [ ] Cuenta Deepgram creada (free tier: $200 crédito inicial)
- [ ] Cuenta ElevenLabs creada (free tier: 10k characters/month)
- [ ] Variables de entorno configuradas

### T27.2: Backend - Servicio de Tokens LiveKit

#### Archivo: `apps/api/app/services/livekit_service.py`

```python
"""
LiveKit token generation service for video interviews.
"""
import os
from datetime import timedelta
from livekit import api

class LiveKitService:
    def __init__(self):
        self.api_key = os.getenv("LIVEKIT_API_KEY")
        self.api_secret = os.getenv("LIVEKIT_API_SECRET")
        self.livekit_url = os.getenv("LIVEKIT_URL")
        
        if not all([self.api_key, self.api_secret, self.livekit_url]):
            raise ValueError("LiveKit environment variables not configured")
    
    def create_token(
        self,
        room_name: str,
        participant_identity: str,
        participant_name: str,
        is_ai_agent: bool = False,
        ttl_minutes: int = 60
    ) -> str:
        """
        Generate a LiveKit access token for a participant.
        
        Args:
            room_name: Unique room identifier (e.g., interview_{interview_id})
            participant_identity: Unique participant ID
            participant_name: Display name in video room
            is_ai_agent: If True, grants agent permissions
            ttl_minutes: Token validity in minutes
        
        Returns:
            JWT access token
        """
        token = api.AccessToken(self.api_key, self.api_secret)
        token.with_identity(participant_identity)
        token.with_name(participant_name)
        token.with_ttl(timedelta(minutes=ttl_minutes))
        
        # Grant permissions
        grant = api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        )
        
        if is_ai_agent:
            # AI agent can update participant metadata
            grant.room_admin = True
        
        token.with_grants(grant)
        
        return token.to_jwt()
    
    def create_room(self, room_name: str) -> dict:
        """
        Create a LiveKit room for an interview.
        """
        room_service = api.RoomServiceClient(
            self.livekit_url,
            self.api_key,
            self.api_secret
        )
        
        room = room_service.create_room(
            api.CreateRoomRequest(
                name=room_name,
                empty_timeout=300,  # 5 min timeout when empty
                max_participants=3,  # Candidate + AI + optional observer
            )
        )
        
        return {
            "name": room.name,
            "sid": room.sid,
            "created_at": room.creation_time,
        }

# Singleton instance
_livekit_service = None

def get_livekit_service() -> LiveKitService:
    global _livekit_service
    if _livekit_service is None:
        _livekit_service = LiveKitService()
    return _livekit_service
```

#### Verificación T27.2
- [ ] Archivo creado en la ubicación correcta
- [ ] Imports funcionan sin errores
- [ ] Sin errores de sintaxis Python

### T27.3: Backend - Pipecat AI Interview Agent

#### Archivo: `apps/api/app/services/interview_agent.py`

```python
"""
Pipecat-based AI Interview Agent.
Conducts live interviews with candidates using voice.
"""
import asyncio
import os
from typing import Optional
from pipecat.frames.frames import (
    TextFrame,
    EndFrame,
    LLMMessagesFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.elevenlabs import ElevenLabsTTSService
from pipecat.services.anthropic import AnthropicLLMService
from pipecat.transports.services.livekit import LiveKitTransport

class InterviewAgent:
    """
    AI-powered interview agent that:
    1. Listens to candidate audio (Deepgram STT)
    2. Processes with Claude (Anthropic LLM)
    3. Responds with natural voice (ElevenLabs TTS)
    """
    
    def __init__(
        self,
        room_name: str,
        job_title: str,
        job_description: str,
        candidate_name: str,
        candidate_cv_summary: Optional[str] = None,
        num_questions: int = 5,
    ):
        self.room_name = room_name
        self.job_title = job_title
        self.job_description = job_description
        self.candidate_name = candidate_name
        self.candidate_cv_summary = candidate_cv_summary
        self.num_questions = num_questions
        
        # Interview state
        self.questions_asked = 0
        self.conversation_history = []
        self.transcript = []
        
    def _build_system_prompt(self) -> str:
        """Build the system prompt for the AI interviewer."""
        cv_context = ""
        if self.candidate_cv_summary:
            cv_context = f"""
## Candidate Background (from CV)
{self.candidate_cv_summary}

Use this information to ask relevant follow-up questions about their experience.
"""
        
        return f"""You are an AI interviewer conducting a video interview for TalentOS.

## Your Role
- Professional, friendly, and encouraging interviewer
- Ask {self.num_questions} questions total, one at a time
- Listen carefully and ask relevant follow-ups
- Keep responses concise (2-3 sentences max for speaking)

## Interview Details
- Position: {self.job_title}
- Job Description: {self.job_description}
{cv_context}

## Interview Structure
1. Greeting and introduction (brief, warm)
2. Technical/role-specific questions
3. Behavioral questions (STAR format)
4. Questions about their experience
5. Closing (thank them, explain next steps)

## Guidelines
- Speak naturally as if having a conversation
- If the candidate gives a short answer, probe deeper
- Be encouraging: "That's interesting", "Great example"
- Don't repeat what the candidate said back to them
- Keep track of questions asked and smoothly transition

## Current State
Questions asked so far: {self.questions_asked}/{self.num_questions}

When you've asked all questions, thank the candidate and end the interview naturally.
"""

    async def run(self):
        """Start the interview agent pipeline."""
        # Initialize services
        transport = LiveKitTransport(
            url=os.getenv("LIVEKIT_URL"),
            api_key=os.getenv("LIVEKIT_API_KEY"),
            api_secret=os.getenv("LIVEKIT_API_SECRET"),
            room_name=self.room_name,
            participant_identity="ai-interviewer",
            participant_name="AI Interviewer",
        )
        
        stt = DeepgramSTTService(
            api_key=os.getenv("DEEPGRAM_API_KEY"),
            language="es",  # Spanish for LATAM
        )
        
        llm = AnthropicLLMService(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            model="claude-sonnet-4-20250514",
        )
        
        tts = ElevenLabsTTSService(
            api_key=os.getenv("ELEVENLABS_API_KEY"),
            voice_id=os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
        )
        
        # Build pipeline: Audio → STT → LLM → TTS → Audio
        pipeline = Pipeline([
            transport.input(),   # Receive audio from candidate
            stt,                 # Speech to text
            llm,                 # Claude processes and responds
            tts,                 # Text to speech
            transport.output(),  # Send audio back to candidate
        ])
        
        # Set initial context
        messages = [
            {"role": "system", "content": self._build_system_prompt()},
            {"role": "assistant", "content": f"¡Hola {self.candidate_name}! Soy tu entrevistador virtual de TalentOS. Gracias por tomarte el tiempo para esta entrevista para el puesto de {self.job_title}. ¿Estás listo para comenzar?"}
        ]
        
        task = PipelineTask(pipeline)
        
        # Start with greeting
        await task.queue_frame(LLMMessagesFrame(messages))
        
        # Run until interview complete
        await task.run()
        
        return {
            "transcript": self.transcript,
            "questions_asked": self.questions_asked,
            "status": "completed"
        }
```

#### Verificación T27.3
- [ ] Archivo creado correctamente
- [ ] Sistema de prompts configurable
- [ ] Pipeline definido con todos los servicios

### T27.4: Backend - API Endpoints para Entrevistas

#### Archivo: `apps/api/app/routers/interviews.py`

```python
"""
API endpoints for video interviews.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

from app.database import get_db
from app.services.livekit_service import get_livekit_service
from app.services.interview_agent import InterviewAgent
from app.models import Interview, Application, Job, User
from app.auth import get_current_user

router = APIRouter(prefix="/interviews", tags=["interviews"])

# ============== Schemas ==============

class InterviewCreateRequest(BaseModel):
    application_id: int
    scheduled_at: Optional[datetime] = None

class InterviewCreateResponse(BaseModel):
    interview_id: int
    room_name: str
    candidate_token: str
    livekit_url: str
    status: str

class InterviewJoinResponse(BaseModel):
    token: str
    livekit_url: str
    room_name: str

class InterviewStatusResponse(BaseModel):
    interview_id: int
    status: str  # scheduled, in_progress, completed, cancelled
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    transcript_available: bool
    recording_available: bool

# ============== Endpoints ==============

@router.post("/", response_model=InterviewCreateResponse)
async def create_interview(
    request: InterviewCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new video interview for an application.
    Only employers/recruiters can create interviews.
    """
    # Verify user has permission
    if current_user.role not in ["employer", "recruiter", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to create interviews")
    
    # Get application with related data
    application = db.query(Application).filter(
        Application.id == request.application_id
    ).first()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Generate unique room name
    room_name = f"interview_{uuid.uuid4().hex[:12]}"
    
    # Create interview record
    interview = Interview(
        application_id=application.id,
        room_name=room_name,
        status="scheduled",
        scheduled_at=request.scheduled_at or datetime.utcnow(),
        created_by=current_user.id,
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    
    # Generate LiveKit room and token
    livekit = get_livekit_service()
    livekit.create_room(room_name)
    
    candidate_token = livekit.create_token(
        room_name=room_name,
        participant_identity=f"candidate_{application.candidate_id}",
        participant_name=application.candidate.full_name or "Candidate",
    )
    
    return InterviewCreateResponse(
        interview_id=interview.id,
        room_name=room_name,
        candidate_token=candidate_token,
        livekit_url=livekit.livekit_url,
        status="scheduled"
    )

@router.post("/{interview_id}/join", response_model=InterviewJoinResponse)
async def join_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a token to join an interview room.
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Verify user can join this interview
    application = interview.application
    is_candidate = current_user.id == application.candidate_id
    is_employer = current_user.role in ["employer", "recruiter", "admin"]
    
    if not (is_candidate or is_employer):
        raise HTTPException(status_code=403, detail="Not authorized to join this interview")
    
    livekit = get_livekit_service()
    
    if is_candidate:
        identity = f"candidate_{current_user.id}"
        name = current_user.full_name or "Candidate"
    else:
        identity = f"observer_{current_user.id}"
        name = f"{current_user.full_name} (Observer)"
    
    token = livekit.create_token(
        room_name=interview.room_name,
        participant_identity=identity,
        participant_name=name,
    )
    
    return InterviewJoinResponse(
        token=token,
        livekit_url=livekit.livekit_url,
        room_name=interview.room_name
    )

@router.post("/{interview_id}/start")
async def start_interview(
    interview_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start the AI interviewer agent.
    Called when candidate is ready to begin.
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    if interview.status not in ["scheduled", "ready"]:
        raise HTTPException(status_code=400, detail=f"Interview cannot be started (status: {interview.status})")
    
    # Get job and candidate info for the agent
    application = interview.application
    job = application.job
    candidate = application.candidate
    
    # Update status
    interview.status = "in_progress"
    interview.started_at = datetime.utcnow()
    db.commit()
    
    # Start AI agent in background
    agent = InterviewAgent(
        room_name=interview.room_name,
        job_title=job.title,
        job_description=job.description,
        candidate_name=candidate.full_name or "Candidato",
        candidate_cv_summary=application.cv_analysis.get("summary") if application.cv_analysis else None,
        num_questions=5,
    )
    
    background_tasks.add_task(run_interview_agent, agent, interview.id, db)
    
    return {"status": "started", "message": "AI interviewer is joining the room"}

async def run_interview_agent(agent: InterviewAgent, interview_id: int, db: Session):
    """Background task to run the interview agent."""
    try:
        result = await agent.run()
        
        # Update interview with results
        interview = db.query(Interview).filter(Interview.id == interview_id).first()
        if interview:
            interview.status = "completed"
            interview.ended_at = datetime.utcnow()
            interview.transcript = result.get("transcript", [])
            db.commit()
    except Exception as e:
        # Log error and update status
        interview = db.query(Interview).filter(Interview.id == interview_id).first()
        if interview:
            interview.status = "error"
            interview.error_message = str(e)
            db.commit()

@router.get("/{interview_id}/status", response_model=InterviewStatusResponse)
async def get_interview_status(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current status of an interview."""
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    return InterviewStatusResponse(
        interview_id=interview.id,
        status=interview.status,
        started_at=interview.started_at,
        ended_at=interview.ended_at,
        transcript_available=interview.transcript is not None,
        recording_available=interview.recording_url is not None,
    )
```

#### Verificación T27.4
- [ ] Router registrado en `main.py`
- [ ] Endpoints funcionan (test con curl/Postman)
- [ ] Modelo Interview existe en database (crear migración si no)

### T27.5: Modelo de Base de Datos - Interview

#### Archivo: `apps/api/app/models/interview.py` (o agregar a models existente)

```python
"""
Interview model for video interviews.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Interview(Base):
    __tablename__ = "interviews"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    room_name = Column(String(100), unique=True, nullable=False)
    status = Column(String(20), default="scheduled")  # scheduled, ready, in_progress, completed, cancelled, error
    
    # Timing
    scheduled_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    
    # Results
    transcript = Column(JSON, nullable=True)  # Array of {speaker, text, timestamp}
    recording_url = Column(String(500), nullable=True)
    
    # AI Analysis (populated after interview)
    ai_summary = Column(Text, nullable=True)
    ai_scores = Column(JSON, nullable=True)  # {communication: 8, technical: 7, ...}
    ai_recommendation = Column(Text, nullable=True)
    
    # Metadata
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    application = relationship("Application", back_populates="interviews")
    creator = relationship("User", foreign_keys=[created_by])
```

#### Migración Alembic
```bash
cd apps/api
alembic revision --autogenerate -m "add interviews table"
alembic upgrade head
```

### T27.6: Health Check para Servicios de Video

#### Agregar a health endpoint existente:

```python
@router.get("/health/video")
async def video_services_health():
    """Check video interview services availability."""
    status = {
        "livekit": "unknown",
        "deepgram": "unknown",
        "elevenlabs": "unknown",
    }
    
    # Check LiveKit
    try:
        livekit = get_livekit_service()
        # Simple token generation test
        livekit.create_token("test-room", "test-user", "Test")
        status["livekit"] = "healthy"
    except Exception as e:
        status["livekit"] = f"error: {str(e)}"
    
    # Check Deepgram (just verify API key exists)
    if os.getenv("DEEPGRAM_API_KEY"):
        status["deepgram"] = "configured"
    else:
        status["deepgram"] = "not_configured"
    
    # Check ElevenLabs
    if os.getenv("ELEVENLABS_API_KEY"):
        status["elevenlabs"] = "configured"
    else:
        status["elevenlabs"] = "not_configured"
    
    all_healthy = all(v in ["healthy", "configured"] for v in status.values())
    
    return {
        "status": "healthy" if all_healthy else "degraded",
        "services": status
    }
```

---

## ✅ Checklist Final Prompt 27

### Configuración
- [ ] Cuenta LiveKit Cloud creada y API keys obtenidas
- [ ] Cuenta Deepgram creada con API key
- [ ] Cuenta ElevenLabs creada con API key
- [ ] Variables de entorno configuradas en `.env` y Vercel

### Backend
- [ ] `livekit_service.py` - Token generation funciona
- [ ] `interview_agent.py` - Pipeline definido correctamente
- [ ] `routers/interviews.py` - Endpoints creados
- [ ] Modelo `Interview` agregado con migración
- [ ] Router registrado en `main.py`

### Verificación
- [ ] `GET /health/video` retorna servicios como "configured" o "healthy"
- [ ] `POST /interviews` crea una entrevista y retorna token
- [ ] Sin errores en logs al inicializar servicios

---

## 📝 Actualizar Documentación

### tasks/todo.md
```markdown
## Video Interviews - Infraestructura
- [x] T27.1: Configurar cuentas LiveKit, Deepgram, ElevenLabs
- [x] T27.2: Servicio de tokens LiveKit
- [x] T27.3: Pipecat AI Interview Agent
- [x] T27.4: API endpoints para entrevistas
- [x] T27.5: Modelo Interview en DB
- [x] T27.6: Health check para servicios de video
```

### tasks/lessons.md
Agregar cualquier lección aprendida durante la implementación.

---

## 💰 Estimación de Costos

| Servicio | Free Tier | Costo después |
|----------|-----------|---------------|
| LiveKit Cloud | 50 min/mes | $0.006/min |
| Deepgram | $200 crédito | $0.0043/min (Nova-2) |
| ElevenLabs | 10k chars/mes | $0.30/1k chars |
| **Total ~30min interview** | **Cubierto por free tier** | **~$2.50** |

---

## 🚀 Siguiente Prompt
Una vez completado, continuar con **Prompt 28: UI de Video Interviews**
