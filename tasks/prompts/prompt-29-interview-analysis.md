# Prompt 29: Video Interviews - Análisis Post-Entrevista con IA

## 🎯 Objetivo
Implementar el análisis automático de entrevistas completadas, incluyendo transcripción estructurada, scoring por competencias, generación de resumen ejecutivo y recomendaciones para el reclutador.

## 📚 Antes de Comenzar
```bash
# OBLIGATORIO: Revisar documentación del proyecto
cat tasks/todo.md
cat tasks/lessons.md
```

## 🏗️ Arquitectura de Análisis

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Interview     │────▶│    Analysis      │────▶│    Results      │
│   Completed     │     │    Pipeline      │     │    Dashboard    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
   ┌──────────┐         ┌──────────┐         ┌──────────┐
   │Transcript│         │  Claude  │         │  Report  │
   │Structurer│         │  Scorer  │         │Generator │
   └──────────┘         └──────────┘         └──────────┘
```

## 📋 Tareas

### T29.1: Servicio de Análisis de Entrevistas

#### Archivo: `apps/api/app/services/interview_analysis.py`

```python
"""
Interview analysis service using Claude for intelligent scoring and feedback.
"""
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from anthropic import Anthropic
import os

class InterviewAnalysisService:
    """
    Analyzes completed interviews to generate:
    1. Structured transcript with speaker labels and timestamps
    2. Competency scores (1-10) with justifications
    3. Executive summary for recruiters
    4. Hiring recommendation with confidence level
    """
    
    SCORING_RUBRIC = {
        "communication": {
            "name": "Comunicación",
            "description": "Claridad, articulación, capacidad de explicar ideas complejas",
            "weight": 0.20,
        },
        "technical": {
            "name": "Competencia Técnica",
            "description": "Conocimiento del rol, habilidades específicas, experiencia relevante",
            "weight": 0.25,
        },
        "problem_solving": {
            "name": "Resolución de Problemas",
            "description": "Pensamiento estructurado, creatividad, análisis",
            "weight": 0.20,
        },
        "cultural_fit": {
            "name": "Ajuste Cultural",
            "description": "Valores, actitud, colaboración, motivación",
            "weight": 0.15,
        },
        "experience": {
            "name": "Experiencia Relevante",
            "description": "Background aplicable al puesto, logros demostrables",
            "weight": 0.20,
        },
    }
    
    def __init__(self):
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-sonnet-4-20250514"
    
    async def analyze_interview(
        self,
        transcript: List[Dict[str, Any]],
        job_title: str,
        job_description: str,
        job_requirements: List[str],
        candidate_name: str,
        candidate_cv_summary: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Perform comprehensive analysis of an interview.
        
        Args:
            transcript: List of {speaker, text, timestamp} entries
            job_title: Title of the position
            job_description: Full job description
            job_requirements: List of key requirements
            candidate_name: Candidate's name
            candidate_cv_summary: Optional CV summary for context
        
        Returns:
            Complete analysis with scores, summary, and recommendation
        """
        # Format transcript for analysis
        formatted_transcript = self._format_transcript(transcript)
        
        # Build analysis prompt
        analysis_prompt = self._build_analysis_prompt(
            formatted_transcript,
            job_title,
            job_description,
            job_requirements,
            candidate_name,
            candidate_cv_summary,
        )
        
        # Get Claude's analysis
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            messages=[
                {"role": "user", "content": analysis_prompt}
            ],
            system=self._get_system_prompt(),
        )
        
        # Parse the structured response
        analysis = self._parse_analysis_response(response.content[0].text)
        
        # Calculate overall score
        analysis["overall_score"] = self._calculate_overall_score(analysis["scores"])
        
        # Add metadata
        analysis["analyzed_at"] = datetime.utcnow().isoformat()
        analysis["model_used"] = self.model
        analysis["transcript_length"] = len(transcript)
        
        return analysis
    
    def _format_transcript(self, transcript: List[Dict]) -> str:
        """Format transcript for Claude analysis."""
        lines = []
        for entry in transcript:
            speaker = "🤖 Entrevistador" if entry["speaker"] == "ai" else "👤 Candidato"
            timestamp = entry.get("timestamp", "")
            lines.append(f"[{timestamp}] {speaker}: {entry['text']}")
        return "\n\n".join(lines)
    
    def _get_system_prompt(self) -> str:
        return """Eres un experto en evaluación de talento y reclutamiento para empresas en Latinoamérica.
Tu rol es analizar entrevistas de video y proporcionar evaluaciones objetivas, justas y accionables.

Principios de evaluación:
1. Sé objetivo y evita sesgos basados en género, edad, origen, o acentos
2. Evalúa basándote únicamente en las respuestas y su relevancia al puesto
3. Proporciona justificaciones específicas citando respuestas del candidato
4. Sé constructivo en la retroalimentación
5. Considera el contexto cultural latinoamericano

Tu análisis debe ser profesional, detallado y útil para la toma de decisiones de contratación."""

    def _build_analysis_prompt(
        self,
        transcript: str,
        job_title: str,
        job_description: str,
        job_requirements: List[str],
        candidate_name: str,
        cv_summary: Optional[str],
    ) -> str:
        requirements_list = "\n".join(f"- {req}" for req in job_requirements)
        
        cv_context = ""
        if cv_summary:
            cv_context = f"""
## Contexto del CV del Candidato
{cv_summary}
"""
        
        rubric_text = "\n".join(
            f"- **{v['name']}** ({k}): {v['description']} - Peso: {v['weight']*100:.0f}%"
            for k, v in self.SCORING_RUBRIC.items()
        )
        
        return f"""Analiza la siguiente entrevista de video y proporciona una evaluación completa.

## Puesto: {job_title}

## Descripción del Trabajo
{job_description}

## Requisitos Clave
{requirements_list}

## Candidato: {candidate_name}
{cv_context}

## Rúbrica de Evaluación
{rubric_text}

## Transcripción de la Entrevista
{transcript}

---

## Instrucciones de Análisis

Proporciona tu análisis en el siguiente formato JSON estructurado:

```json
{{
  "scores": {{
    "communication": {{
      "score": <1-10>,
      "justification": "<2-3 oraciones citando ejemplos específicos de la entrevista>"
    }},
    "technical": {{
      "score": <1-10>,
      "justification": "<2-3 oraciones citando ejemplos específicos>"
    }},
    "problem_solving": {{
      "score": <1-10>,
      "justification": "<2-3 oraciones citando ejemplos específicos>"
    }},
    "cultural_fit": {{
      "score": <1-10>,
      "justification": "<2-3 oraciones citando ejemplos específicos>"
    }},
    "experience": {{
      "score": <1-10>,
      "justification": "<2-3 oraciones citando ejemplos específicos>"
    }}
  }},
  "strengths": [
    "<fortaleza específica 1>",
    "<fortaleza específica 2>",
    "<fortaleza específica 3>"
  ],
  "areas_for_improvement": [
    "<área de mejora 1>",
    "<área de mejora 2>"
  ],
  "red_flags": [
    "<señal de alerta si hay alguna, o array vacío>"
  ],
  "executive_summary": "<Resumen de 3-4 oraciones para el reclutador>",
  "recommendation": {{
    "decision": "<STRONGLY_RECOMMEND | RECOMMEND | NEUTRAL | NOT_RECOMMEND | STRONGLY_NOT_RECOMMEND>",
    "confidence": <0.0-1.0>,
    "rationale": "<1-2 oraciones explicando la recomendación>"
  }},
  "suggested_next_steps": [
    "<siguiente paso sugerido 1>",
    "<siguiente paso sugerido 2>"
  ],
  "interview_quality": {{
    "completeness": <1-10>,
    "depth_of_answers": <1-10>,
    "notes": "<observaciones sobre la calidad de la entrevista>"
  }}
}}
```

Responde ÚNICAMENTE con el JSON, sin texto adicional antes o después."""

    def _parse_analysis_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Claude's JSON response."""
        # Clean up the response (remove markdown code blocks if present)
        cleaned = response_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        
        try:
            return json.loads(cleaned.strip())
        except json.JSONDecodeError as e:
            # Return a structured error response
            return {
                "error": f"Failed to parse analysis: {str(e)}",
                "raw_response": response_text[:500],
                "scores": {},
                "executive_summary": "Error al analizar la entrevista",
                "recommendation": {
                    "decision": "NEUTRAL",
                    "confidence": 0.0,
                    "rationale": "No se pudo completar el análisis automático"
                }
            }
    
    def _calculate_overall_score(self, scores: Dict[str, Any]) -> float:
        """Calculate weighted overall score."""
        total = 0.0
        total_weight = 0.0
        
        for key, config in self.SCORING_RUBRIC.items():
            if key in scores and isinstance(scores[key], dict):
                score = scores[key].get("score", 0)
                weight = config["weight"]
                total += score * weight
                total_weight += weight
        
        if total_weight == 0:
            return 0.0
        
        return round(total / total_weight, 1)


# Singleton instance
_analysis_service = None

def get_analysis_service() -> InterviewAnalysisService:
    global _analysis_service
    if _analysis_service is None:
        _analysis_service = InterviewAnalysisService()
    return _analysis_service
```

### T29.2: Endpoint de Análisis

#### Agregar a `apps/api/app/routers/interviews.py`

```python
from app.services.interview_analysis import get_analysis_service

# ============== Analysis Schemas ==============

class CompetencyScore(BaseModel):
    score: int
    justification: str

class AnalysisScores(BaseModel):
    communication: CompetencyScore
    technical: CompetencyScore
    problem_solving: CompetencyScore
    cultural_fit: CompetencyScore
    experience: CompetencyScore

class Recommendation(BaseModel):
    decision: str  # STRONGLY_RECOMMEND, RECOMMEND, NEUTRAL, NOT_RECOMMEND, STRONGLY_NOT_RECOMMEND
    confidence: float
    rationale: str

class InterviewAnalysisResponse(BaseModel):
    interview_id: int
    overall_score: float
    scores: AnalysisScores
    strengths: List[str]
    areas_for_improvement: List[str]
    red_flags: List[str]
    executive_summary: str
    recommendation: Recommendation
    suggested_next_steps: List[str]
    analyzed_at: str

# ============== Analysis Endpoints ==============

@router.post("/{interview_id}/analyze", response_model=InterviewAnalysisResponse)
async def analyze_interview(
    interview_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Trigger AI analysis of a completed interview.
    Only employers/recruiters can request analysis.
    """
    if current_user.role not in ["employer", "recruiter", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to analyze interviews")
    
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    if interview.status != "completed":
        raise HTTPException(status_code=400, detail="Interview must be completed before analysis")
    
    if not interview.transcript:
        raise HTTPException(status_code=400, detail="No transcript available for analysis")
    
    # Check if already analyzed
    if interview.ai_scores and interview.ai_summary:
        return _build_analysis_response(interview)
    
    # Get job and candidate info
    application = interview.application
    job = application.job
    candidate = application.candidate
    
    # Perform analysis
    analysis_service = get_analysis_service()
    analysis = await analysis_service.analyze_interview(
        transcript=interview.transcript,
        job_title=job.title,
        job_description=job.description,
        job_requirements=job.requirements or [],
        candidate_name=candidate.full_name or "Candidato",
        candidate_cv_summary=application.cv_analysis.get("summary") if application.cv_analysis else None,
    )
    
    # Store analysis results
    interview.ai_scores = analysis.get("scores", {})
    interview.ai_summary = analysis.get("executive_summary", "")
    interview.ai_recommendation = json.dumps(analysis.get("recommendation", {}))
    interview.overall_score = analysis.get("overall_score", 0)
    interview.strengths = analysis.get("strengths", [])
    interview.areas_for_improvement = analysis.get("areas_for_improvement", [])
    interview.red_flags = analysis.get("red_flags", [])
    interview.suggested_next_steps = analysis.get("suggested_next_steps", [])
    
    db.commit()
    db.refresh(interview)
    
    return _build_analysis_response(interview)

def _build_analysis_response(interview: Interview) -> InterviewAnalysisResponse:
    """Build response from stored interview analysis."""
    recommendation = json.loads(interview.ai_recommendation) if interview.ai_recommendation else {}
    
    return InterviewAnalysisResponse(
        interview_id=interview.id,
        overall_score=interview.overall_score or 0.0,
        scores=interview.ai_scores or {},
        strengths=interview.strengths or [],
        areas_for_improvement=interview.areas_for_improvement or [],
        red_flags=interview.red_flags or [],
        executive_summary=interview.ai_summary or "",
        recommendation=Recommendation(**recommendation) if recommendation else None,
        suggested_next_steps=interview.suggested_next_steps or [],
        analyzed_at=interview.updated_at.isoformat() if interview.updated_at else "",
    )

@router.get("/{interview_id}/results")
async def get_interview_results(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get full interview results including transcript and analysis.
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Verify access
    application = interview.application
    is_employer = current_user.role in ["employer", "recruiter", "admin"]
    is_candidate = current_user.id == application.candidate_id
    
    if not (is_employer or is_candidate):
        raise HTTPException(status_code=403, detail="Not authorized to view results")
    
    # Build response
    result = {
        "interview_id": interview.id,
        "status": interview.status,
        "job_title": application.job.title,
        "company_name": application.job.company.name if application.job.company else "N/A",
        "candidate_name": application.candidate.full_name,
        "started_at": interview.started_at.isoformat() if interview.started_at else None,
        "ended_at": interview.ended_at.isoformat() if interview.ended_at else None,
        "duration_minutes": None,
    }
    
    # Calculate duration
    if interview.started_at and interview.ended_at:
        delta = interview.ended_at - interview.started_at
        result["duration_minutes"] = round(delta.total_seconds() / 60, 1)
    
    # Include transcript for both
    result["transcript"] = interview.transcript
    
    # Include full analysis only for employers
    if is_employer and interview.ai_scores:
        result["analysis"] = {
            "overall_score": interview.overall_score,
            "scores": interview.ai_scores,
            "strengths": interview.strengths,
            "areas_for_improvement": interview.areas_for_improvement,
            "red_flags": interview.red_flags,
            "executive_summary": interview.ai_summary,
            "recommendation": json.loads(interview.ai_recommendation) if interview.ai_recommendation else None,
            "suggested_next_steps": interview.suggested_next_steps,
        }
    
    # For candidates, only show limited feedback
    if is_candidate and interview.ai_scores:
        result["feedback"] = {
            "overall_impression": "positive" if interview.overall_score >= 7 else "neutral" if interview.overall_score >= 5 else "needs_improvement",
            "strengths_highlighted": interview.strengths[:2] if interview.strengths else [],
            "tip": interview.areas_for_improvement[0] if interview.areas_for_improvement else None,
        }
    
    return result
```

### T29.3: Actualizar Modelo Interview

#### Agregar campos a `apps/api/app/models/interview.py`

```python
# Agregar estos campos al modelo Interview existente

# Analysis results (extended)
overall_score = Column(Float, nullable=True)
strengths = Column(JSON, nullable=True)  # List of strings
areas_for_improvement = Column(JSON, nullable=True)  # List of strings
red_flags = Column(JSON, nullable=True)  # List of strings
suggested_next_steps = Column(JSON, nullable=True)  # List of strings
```

#### Migración
```bash
cd apps/api
alembic revision --autogenerate -m "add interview analysis fields"
alembic upgrade head
```

### T29.4: UI - Results Page for Employer

#### Archivo: `apps/web/app/(authenticated)/employer/interviews/[id]/results/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  User,
  Briefcase,
  Clock,
  Calendar,
  Star,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Minus,
  RefreshCw,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InterviewResults {
  interview_id: number;
  status: string;
  job_title: string;
  company_name: string;
  candidate_name: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  transcript: Array<{
    speaker: string;
    text: string;
    timestamp: string;
  }>;
  analysis?: {
    overall_score: number;
    scores: Record<string, { score: number; justification: string }>;
    strengths: string[];
    areas_for_improvement: string[];
    red_flags: string[];
    executive_summary: string;
    recommendation: {
      decision: string;
      confidence: number;
      rationale: string;
    };
    suggested_next_steps: string[];
  };
}

export default function InterviewResultsPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = Number(params.id);

  const [results, setResults] = useState<InterviewResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
  }, [interviewId]);

  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/interviews/${interviewId}/results`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch results');
      
      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerAnalysis = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/interviews/${interviewId}/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Analysis failed');
      
      // Refresh results
      await fetchResults();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Error: {error || 'No se encontraron resultados'}</p>
        <Button onClick={() => router.back()} className="mt-4">
          Volver
        </Button>
      </div>
    );
  }

  const { analysis } = results;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Volver a entrevistas
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Resultados de Entrevista</h1>
            <div className="flex items-center gap-4 mt-2 text-gray-600">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {results.candidate_name}
              </span>
              <span className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {results.job_title}
              </span>
              {results.duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {results.duration_minutes} min
                </span>
              )}
            </div>
          </div>
          
          {!analysis && (
            <Button onClick={triggerAnalysis} disabled={analyzing}>
              {analyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Analizar con IA
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Scores & Analysis */}
        <div className="lg:col-span-2 space-y-6">
          {analysis ? (
            <>
              {/* Overall Score Card */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Puntuación General</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-indigo-600">
                          {analysis.overall_score.toFixed(1)}
                        </span>
                        <span className="text-gray-400">/ 10</span>
                      </div>
                    </div>
                    <RecommendationBadge recommendation={analysis.recommendation} />
                  </div>
                  
                  <p className="mt-4 text-gray-700">{analysis.executive_summary}</p>
                </CardContent>
              </Card>

              {/* Competency Scores */}
              <Card>
                <CardHeader>
                  <CardTitle>Evaluación por Competencias</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(analysis.scores).map(([key, data]) => (
                    <CompetencyScoreBar
                      key={key}
                      name={getCompetencyName(key)}
                      score={data.score}
                      justification={data.justification}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* Strengths & Areas for Improvement */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Fortalezas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.strengths.map((strength, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Star className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      Áreas de Mejora
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.areas_for_improvement.map((area, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center mt-0.5 flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm">{area}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Red Flags */}
              {analysis.red_flags.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="w-5 h-5" />
                      Señales de Alerta
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.red_flags.map((flag, i) => (
                        <li key={i} className="text-sm text-red-700">{flag}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Next Steps */}
              <Card>
                <CardHeader>
                  <CardTitle>Próximos Pasos Sugeridos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2">
                    {analysis.suggested_next_steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-sm flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm">{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Análisis no disponible</h3>
                <p className="text-gray-500 mb-4">
                  Haz clic en "Analizar con IA" para obtener evaluación detallada
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Transcript */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Transcripción
              </CardTitle>
              <CardDescription>
                {results.transcript?.length || 0} intercambios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {results.transcript?.map((entry, i) => (
                  <div key={i} className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-medium ${
                          entry.speaker === 'ai'
                            ? 'text-indigo-600'
                            : 'text-green-600'
                        }`}
                      >
                        {entry.speaker === 'ai' ? '🤖 Entrevistador' : '👤 Candidato'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {entry.timestamp}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{entry.text}</p>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function RecommendationBadge({ recommendation }: { recommendation: any }) {
  const configs: Record<string, { color: string; icon: any; text: string }> = {
    STRONGLY_RECOMMEND: {
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: ThumbsUp,
      text: 'Altamente Recomendado',
    },
    RECOMMEND: {
      color: 'bg-green-50 text-green-600 border-green-100',
      icon: ThumbsUp,
      text: 'Recomendado',
    },
    NEUTRAL: {
      color: 'bg-gray-100 text-gray-600 border-gray-200',
      icon: Minus,
      text: 'Neutral',
    },
    NOT_RECOMMEND: {
      color: 'bg-red-50 text-red-600 border-red-100',
      icon: ThumbsDown,
      text: 'No Recomendado',
    },
    STRONGLY_NOT_RECOMMEND: {
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: ThumbsDown,
      text: 'No Recomendado',
    },
  };

  const config = configs[recommendation.decision] || configs.NEUTRAL;
  const Icon = config.icon;

  return (
    <div className={`px-4 py-2 rounded-lg border ${config.color}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5" />
        <span className="font-medium">{config.text}</span>
      </div>
      <p className="text-xs mt-1 opacity-80">
        Confianza: {Math.round(recommendation.confidence * 100)}%
      </p>
    </div>
  );
}

function CompetencyScoreBar({
  name,
  score,
  justification,
}: {
  name: string;
  score: number;
  justification: string;
}) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 6) return 'bg-blue-500';
    if (score >= 4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-sm font-bold">{score}/10</span>
      </div>
      <Progress value={score * 10} className="h-2 mb-2" />
      <p className="text-xs text-gray-500">{justification}</p>
    </div>
  );
}

function getCompetencyName(key: string): string {
  const names: Record<string, string> = {
    communication: 'Comunicación',
    technical: 'Competencia Técnica',
    problem_solving: 'Resolución de Problemas',
    cultural_fit: 'Ajuste Cultural',
    experience: 'Experiencia Relevante',
  };
  return names[key] || key;
}
```

### T29.5: UI - Candidate Feedback Page (Limited View)

#### Archivo: `apps/web/app/(authenticated)/candidate/interviews/[id]/complete/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, Star, Lightbulb, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface CandidateFeedback {
  interview_id: number;
  job_title: string;
  company_name: string;
  duration_minutes: number | null;
  feedback?: {
    overall_impression: 'positive' | 'neutral' | 'needs_improvement';
    strengths_highlighted: string[];
    tip: string | null;
  };
}

export default function InterviewCompletePage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = Number(params.id);

  const [data, setData] = useState<CandidateFeedback | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedback();
  }, [interviewId]);

  const fetchFeedback = async () => {
    try {
      const response = await fetch(`/api/interviews/${interviewId}/results`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const impressionConfig = {
    positive: {
      emoji: '🎉',
      title: '¡Excelente entrevista!',
      message: 'Tu desempeño fue muy positivo. El equipo de reclutamiento revisará los resultados pronto.',
      color: 'text-green-600',
    },
    neutral: {
      emoji: '👍',
      title: '¡Entrevista completada!',
      message: 'Gracias por tu tiempo. El equipo evaluará tu perfil y te contactará.',
      color: 'text-blue-600',
    },
    needs_improvement: {
      emoji: '💪',
      title: '¡Gracias por participar!',
      message: 'Apreciamos tu interés. Sigue preparándote y mejorando tus habilidades.',
      color: 'text-gray-600',
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const impression = data?.feedback?.overall_impression || 'neutral';
  const config = impressionConfig[impression];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">{config.emoji}</span>
            </div>
            <h1 className={`text-2xl font-bold ${config.color}`}>
              {config.title}
            </h1>
            <p className="text-gray-600 mt-2">{config.message}</p>
          </div>

          {/* Interview Summary */}
          {data && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Entrevista para</p>
                  <p className="font-semibold text-lg">{data.job_title}</p>
                  <p className="text-gray-600">{data.company_name}</p>
                  {data.duration_minutes && (
                    <p className="text-sm text-gray-500 mt-2">
                      Duración: {data.duration_minutes} minutos
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feedback (if available) */}
          {data?.feedback && (
            <div className="space-y-4 mb-8">
              {/* Strengths */}
              {data.feedback.strengths_highlighted.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-5 h-5 text-yellow-500" />
                      <h3 className="font-medium">Puntos destacados</h3>
                    </div>
                    <ul className="space-y-2">
                      {data.feedback.strengths_highlighted.map((strength, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Tip */}
              {data.feedback.tip && (
                <Card className="bg-blue-50 border-blue-100">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="w-5 h-5 text-blue-600" />
                      <h3 className="font-medium text-blue-900">Consejo para mejorar</h3>
                    </div>
                    <p className="text-sm text-blue-800">{data.feedback.tip}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Next Steps */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-3">¿Qué sigue?</h3>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <span>El equipo de reclutamiento revisará tu entrevista</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <span>Recibirás una notificación con el resultado</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    3
                  </span>
                  <span>Si avanzas, te contactarán para la siguiente etapa</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="mt-8 space-y-3">
            <Link href="/candidate/applications" className="block">
              <Button className="w-full">
                Ver mis aplicaciones
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/candidate/jobs" className="block">
              <Button variant="outline" className="w-full">
                Explorar más trabajos
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
```

---

## ✅ Checklist Final Prompt 29

### Backend
- [ ] `interview_analysis.py` - Servicio de análisis con Claude
- [ ] Endpoints `/analyze` y `/results` agregados
- [ ] Modelo Interview con campos de análisis adicionales
- [ ] Migración ejecutada

### Frontend
- [ ] Results page para employer con visualización completa
- [ ] Complete page para candidate con feedback limitado
- [ ] Componentes de visualización (scores, badges, progress)

### Verificación
- [ ] Análisis se ejecuta correctamente en entrevista completada
- [ ] Scores se calculan y almacenan
- [ ] Recomendación se genera correctamente
- [ ] UI muestra todos los datos del análisis
- [ ] Candidato solo ve feedback limitado

---

## 📝 Actualizar Documentación

### tasks/todo.md
```markdown
## Video Interviews - Análisis Post-Entrevista
- [x] T29.1: Servicio de análisis con Claude
- [x] T29.2: Endpoints de análisis
- [x] T29.3: Campos de análisis en modelo Interview
- [x] T29.4: UI Results Page (Employer)
- [x] T29.5: UI Complete Page (Candidate)
```

### tasks/lessons.md
Agregar cualquier lección aprendida durante la implementación.

---

## 💰 Estimación de Costos de Análisis

| Componente | Tokens estimados | Costo |
|------------|------------------|-------|
| Input (transcript 30 min) | ~8,000 tokens | $0.024 |
| Output (análisis completo) | ~2,000 tokens | $0.030 |
| **Total por análisis** | ~10,000 tokens | **~$0.054** |

---

## 🚀 Próximos Pasos

Con los Prompts 27-29 completados, el módulo de Video Interviews estará funcional:

1. **Infraestructura** (Prompt 27): LiveKit + Pipecat configurados
2. **UI** (Prompt 28): Sala de video, pre-join, transcripción
3. **Análisis** (Prompt 29): Scoring con IA, recomendaciones

### Posibles mejoras futuras:
- Grabación de video en cloud storage (S3/R2)
- Resumen de video con screenshots clave
- Comparación entre candidatos
- Dashboard de métricas de entrevistas
- Integración con calendario (Google Calendar)
