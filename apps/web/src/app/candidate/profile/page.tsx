'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { ScoreDisplay, CompetencyScores } from '@/components/brand/ScoreDisplay'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth'
import { candidateApi } from '@/lib/api'
import { MapPin, Briefcase, GraduationCap, Languages, Award, Star, AlertCircle } from 'lucide-react'

export default function CandidateProfilePage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, user } = useAuthStore()
  const [profile, setProfile] = useState<any>(null)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    const loadData = async () => {
      if (!accessToken) return

      try {
        const [profileData, reportData] = await Promise.all([
          candidateApi.getProfile(accessToken),
          candidateApi.getReport(accessToken).catch(() => null),
        ])
        setProfile(profileData)
        setReport(reportData)
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

  return (
    <AppShell>
      <BrandHero
        title={user?.full_name || 'Mi Perfil'}
        subtitle={profile?.headline || 'Completa tu entrevista para ver tu perfil generado por IA'}
        size="sm"
      />

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Summary */}
          {(report?.summary || profile?.ai_summary) && (
            <BrandCard>
              <BrandCardHeader
                title="Resumen generado por IA"
                description="Análisis basado en tu CV y entrevista"
              />
              <p className="text-muted-foreground">
                {report?.summary || profile?.ai_summary}
              </p>
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
              <BrandCardHeader title="Educación" />
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
          {report?.overall_score && (
            <BrandCard className="text-center">
              <h3 className="text-lg font-semibold text-bloque-navy900 mb-4">
                Puntuación General
              </h3>
              <ScoreDisplay score={report.overall_score} size="lg" />
              <p className="text-sm text-muted-foreground mt-2">
                de 5.0 puntos
              </p>
            </BrandCard>
          )}

          {/* Competency Scores */}
          {(report?.competency_scores || profile?.competency_scores) && (
            <BrandCard>
              <BrandCardHeader title="Competencias" />
              <CompetencyScores
                scores={report?.competency_scores || profile?.competency_scores}
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
              <BrandCardHeader title="Áreas de mejora" />
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
