'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { ScoreDisplay, CompetencyScores } from '@/components/brand/ScoreDisplay'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth'
import { candidateApi, applicationsApi } from '@/lib/api'
import { MapPin, Briefcase, GraduationCap, Star, AlertCircle, FileText, MessageSquare, Upload, ArrowRight, CheckCircle, Play } from 'lucide-react'

interface ApplicationForGating {
  id: string
  status: string
  match_score: number | null
  job_id: string
  job?: {
    id: string
    title: string
  } | null
}

export default function CandidateProfilePage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, user } = useAuthStore()
  const [profile, setProfile] = useState<any>(null)
  const [report, setReport] = useState<any>(null)
  const [applications, setApplications] = useState<ApplicationForGating[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    const loadData = async () => {
      if (!accessToken) return

      try {
        const [profileData, reportData, appsData] = await Promise.all([
          candidateApi.getProfile(accessToken),
          candidateApi.getReport(accessToken).catch(() => null),
          applicationsApi.list(accessToken).catch(() => []),
        ])
        setProfile(profileData)
        setReport(reportData)
        setApplications(appsData || [])
      } catch (err) {
        console.error('Error loading profile:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [accessToken, isAuthenticated, router])

  if (!isAuthenticated) return null

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Cargando perfil...</div>
        </div>
      </AppShell>
    )
  }

  const hasCV = profile?.skills?.length > 0 || profile?.experience?.length > 0

  // Check for actual completed interview report (not just any report)
  const hasCompletedInterview = report?.overall_score !== undefined && report?.overall_score !== null
  const hasCompetencies = report?.competency_scores && Object.keys(report.competency_scores).length > 0

  // Gating: Check if candidate has an approved application to enable interview
  const approvedStatuses = ['MATCH_PASSED', 'INTERVIEW_STARTED', 'INTERVIEW_COMPLETED']
  const approvedApplication = applications.find(app => approvedStatuses.includes(app.status))
  const canAccessInterview = !!approvedApplication

  // Find application that's ready for interview (MATCH_PASSED but not yet started)
  const interviewReadyApp = applications.find(app => app.status === 'MATCH_PASSED')
  // Find application with interview in progress
  const interviewInProgressApp = applications.find(app => app.status === 'INTERVIEW_STARTED')

  return (
    <AppShell>
      <BrandHero
        title={user?.full_name || 'Mi Perfil'}
        subtitle={profile?.headline || 'Completa tu CV y entrevista para ver tu perfil generado por IA'}
        size="sm"
      />

      {/* Status Cards */}
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <BrandCard className={hasCV ? 'border-green-200 bg-green-50/50' : 'border-yellow-200 bg-yellow-50/50'}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${hasCV ? 'bg-green-100' : 'bg-yellow-100'}`}>
                {hasCV ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <FileText className="h-5 w-5 text-yellow-600" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-bloque-navy900">CV / Resume</h3>
                <p className="text-sm text-muted-foreground">
                  {hasCV ? 'CV procesado correctamente' : 'Sube tu CV para extraer tu experiencia'}
                </p>
              </div>
            </div>
            {!hasCV && (
              <Link href="/candidate/resume">
                <Button size="sm" variant="outline">
                  <Upload className="h-4 w-4 mr-1" />
                  Subir CV
                </Button>
              </Link>
            )}
          </div>
        </BrandCard>

        {/* Interview Card - Only show if candidate has an approved application (gating) */}
        {canAccessInterview ? (
          <BrandCard className={hasCompletedInterview ? 'border-green-200 bg-green-50/50' : 'border-blue-200 bg-blue-50/50'}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${hasCompletedInterview ? 'bg-green-100' : 'bg-blue-100'}`}>
                  {hasCompletedInterview ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Play className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-bloque-navy900">Entrevista IA</h3>
                  <p className="text-sm text-muted-foreground">
                    {hasCompletedInterview
                      ? 'Entrevista completada'
                      : interviewInProgressApp
                        ? 'Entrevista en progreso - continua donde lo dejaste'
                        : `Tienes una aplicacion aprobada${interviewReadyApp?.job?.title ? ` para ${interviewReadyApp.job.title}` : ''}`
                    }
                  </p>
                </div>
              </div>
              {!hasCompletedInterview && interviewReadyApp && (
                <Link href={`/candidate/apply/${interviewReadyApp.job_id}`}>
                  <Button size="sm" variant="outline">
                    <Play className="h-4 w-4 mr-1" />
                    Iniciar entrevista
                  </Button>
                </Link>
              )}
              {!hasCompletedInterview && interviewInProgressApp && (
                <Link href={`/candidate/apply/${interviewInProgressApp.job_id}`}>
                  <Button size="sm" variant="outline">
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Continuar
                  </Button>
                </Link>
              )}
            </div>
          </BrandCard>
        ) : (
          <BrandCard className="border-gray-200 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-gray-100">
                  <MessageSquare className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <h3 className="font-medium text-bloque-navy900">Entrevista IA</h3>
                  <p className="text-sm text-muted-foreground">
                    Aplica a un puesto y alcanza el umbral de match para acceder a la entrevista
                  </p>
                </div>
              </div>
              <Link href="/candidate/jobs">
                <Button size="sm" variant="outline">
                  <Briefcase className="h-4 w-4 mr-1" />
                  Ver puestos
                </Button>
              </Link>
            </div>
          </BrandCard>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Summary */}
          {(report?.summary || profile?.ai_summary) && (
            <BrandCard>
              <BrandCardHeader
                title="Resumen generado por IA"
                description="Analisis basado en tu CV y entrevista"
              />
              <p className="text-muted-foreground">
                {report?.summary || profile?.ai_summary}
              </p>
            </BrandCard>
          )}

          {/* No CV Message */}
          {!hasCV && (
            <BrandCard>
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-bloque-slate200 mx-auto mb-4" />
                <h3 className="font-medium text-bloque-navy900 mb-2">
                  Sube tu CV para comenzar
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Nuestra IA extraera automaticamente tu experiencia, habilidades y educacion
                </p>
                <Link href="/candidate/resume">
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Subir mi CV
                  </Button>
                </Link>
              </div>
            </BrandCard>
          )}

          {/* Skills */}
          {profile?.skills?.length > 0 && (
            <BrandCard>
              <BrandCardHeader title="Habilidades" />
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill: string, idx: number) => (
                  <Badge key={idx} variant="outline">
                    {skill}
                  </Badge>
                ))}
              </div>
            </BrandCard>
          )}

          {/* Experience */}
          {profile?.experience?.length > 0 && (
            <BrandCard>
              <BrandCardHeader title="Experiencia" />
              <div className="space-y-4">
                {profile.experience.map((exp: any, idx: number) => (
                  <div key={idx} className="flex gap-4">
                    <div className="p-2 bg-bloque-gray50 rounded h-fit">
                      <Briefcase className="h-5 w-5 text-bloque-navy900" />
                    </div>
                    <div>
                      <h4 className="font-medium text-bloque-navy900">{exp.title}</h4>
                      <p className="text-sm text-muted-foreground">{exp.company}</p>
                      <p className="text-xs text-muted-foreground">
                        {exp.start_date} - {exp.end_date || 'Presente'}
                      </p>
                      {exp.description && (
                        <p className="text-sm mt-2">{exp.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </BrandCard>
          )}

          {/* Education */}
          {profile?.education?.length > 0 && (
            <BrandCard>
              <BrandCardHeader title="Educacion" />
              <div className="space-y-4">
                {profile.education.map((edu: any, idx: number) => (
                  <div key={idx} className="flex gap-4">
                    <div className="p-2 bg-bloque-gray50 rounded h-fit">
                      <GraduationCap className="h-5 w-5 text-bloque-navy900" />
                    </div>
                    <div>
                      <h4 className="font-medium text-bloque-navy900">{edu.degree}</h4>
                      <p className="text-sm text-muted-foreground">{edu.institution}</p>
                      <p className="text-xs text-muted-foreground">{edu.year}</p>
                    </div>
                  </div>
                ))}
              </div>
            </BrandCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Overall Score */}
          {hasCompletedInterview && (
            <BrandCard className="text-center">
              <h3 className="text-lg font-semibold text-bloque-navy900 mb-4">
                Puntuacion General
              </h3>
              <ScoreDisplay score={report.overall_score} size="lg" />
              <p className="text-sm text-muted-foreground mt-2">
                de 5.0 puntos
              </p>
            </BrandCard>
          )}

          {/* Interview CTA - Only show if CV uploaded but interview not completed, and has approved application */}
          {!hasCompletedInterview && hasCV && canAccessInterview && interviewReadyApp && (
            <BrandCard className="text-center">
              <Play className="h-10 w-10 text-blue-500 mx-auto mb-3" />
              <h3 className="font-medium text-bloque-navy900 mb-2">
                Listo para tu entrevista
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Tu aplicacion fue aprobada. Completa la entrevista con IA para avanzar en el proceso.
              </p>
              <Link href={`/candidate/apply/${interviewReadyApp.job_id}`}>
                <Button size="sm">Iniciar entrevista</Button>
              </Link>
            </BrandCard>
          )}

          {/* No approved application - guide to apply */}
          {!hasCompletedInterview && hasCV && !canAccessInterview && (
            <BrandCard className="text-center">
              <Briefcase className="h-10 w-10 text-bloque-slate200 mx-auto mb-3" />
              <h3 className="font-medium text-bloque-navy900 mb-2">
                Aplica a un puesto
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Explora puestos disponibles y aplica para acceder a la entrevista con IA
              </p>
              <Link href="/candidate/jobs">
                <Button size="sm">Ver puestos</Button>
              </Link>
            </BrandCard>
          )}

          {/* Competency Scores */}
          {hasCompetencies && (
            <BrandCard>
              <BrandCardHeader title="Competencias" />
              <CompetencyScores
                scores={report.competency_scores}
              />
            </BrandCard>
          )}

          {/* Strengths */}
          {report?.strengths?.length > 0 && (
            <BrandCard>
              <BrandCardHeader title="Fortalezas" />
              <ul className="space-y-2">
                {report.strengths.map((strength: string, idx: number) => (
                  <li key={idx} className="flex gap-2 text-sm">
                    <Star className="h-4 w-4 text-bloque-gold500 shrink-0 mt-0.5" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </BrandCard>
          )}

          {/* Areas for improvement */}
          {report?.weaknesses?.length > 0 && (
            <BrandCard>
              <BrandCardHeader title="Areas de mejora" />
              <ul className="space-y-2">
                {report.weaknesses.map((weakness: string, idx: number) => (
                  <li key={idx} className="flex gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                    <span>{weakness}</span>
                  </li>
                ))}
              </ul>
            </BrandCard>
          )}

          {/* Location */}
          {profile?.location && (
            <BrandCard>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-bloque-navy900" />
                <span>{profile.location}</span>
              </div>
            </BrandCard>
          )}

          {/* Languages */}
          {profile?.languages?.length > 0 && (
            <BrandCard>
              <BrandCardHeader title="Idiomas" />
              <div className="space-y-2">
                {profile.languages.map((lang: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{lang.language}</span>
                    <Badge variant="outline">{lang.level}</Badge>
                  </div>
                ))}
              </div>
            </BrandCard>
          )}
        </div>
      </div>
    </AppShell>
  )
}
