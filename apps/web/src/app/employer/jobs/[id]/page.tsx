'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { ScoreDisplay, CompetencyScores } from '@/components/brand/ScoreDisplay'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/lib/auth'
import { employerApi } from '@/lib/api'
import { ArrowLeft, Users, Download, RefreshCw, MapPin, Star, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function JobDetailPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string
  const { accessToken, isAuthenticated } = useAuthStore()
  const [job, setJob] = useState<any>(null)
  const [shortlist, setShortlist] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    loadData()
  }, [isAuthenticated, accessToken, jobId, router])

  const loadData = async () => {
    if (!accessToken || !jobId) return
    try {
      const [jobData, shortlistData] = await Promise.all([
        employerApi.getJob(accessToken, jobId),
        employerApi.getShortlist(accessToken, jobId).catch(() => null),
      ])
      setJob(jobData)
      setShortlist(shortlistData)
    } catch (err) {
      console.error('Error loading job:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateShortlist = async () => {
    if (!accessToken) return
    setGenerating(true)
    try {
      const data = await employerApi.generateShortlist(accessToken, jobId) as any
      setShortlist(data)
    } catch (err) {
      console.error('Error generating shortlist:', err)
    } finally {
      setGenerating(false)
    }
  }

  const exportCsv = () => {
    if (accessToken) {
      employerApi.exportShortlist(accessToken, jobId)
    }
  }

  const publishJob = async () => {
    if (!accessToken) return
    try {
      await employerApi.publishJob(accessToken, jobId)
      loadData()
    } catch (err) {
      console.error('Error publishing job:', err)
    }
  }

  if (!isAuthenticated) return null

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Cargando...</div>
        </div>
      </AppShell>
    )
  }

  if (!job) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Trabajo no encontrado</p>
          <Link href="/employer/jobs">
            <Button variant="outline">Volver a trabajos</Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/employer/jobs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-bloque-navy900">{job.title}</h1>
            <Badge variant={job.status === 'ACTIVE' ? 'success' : 'outline'}>
              {job.status}
            </Badge>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {job.location}
              </span>
            )}
            <span>{job.seniority}</span>
            <span>{job.modality}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {job.status === 'DRAFT' && (
            <Button onClick={publishJob}>Publicar</Button>
          )}
          <Button variant="outline" onClick={generateShortlist} disabled={generating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generando...' : 'Generar Shortlist'}
          </Button>
          {shortlist?.items?.length > 0 && (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="shortlist" className="space-y-4">
        <TabsList>
          <TabsTrigger value="shortlist">
            <Users className="h-4 w-4 mr-2" />
            Shortlist ({shortlist?.items?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="details">Detalles</TabsTrigger>
        </TabsList>

        <TabsContent value="shortlist" className="space-y-4">
          {!shortlist?.items?.length ? (
            <BrandCard>
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  No hay candidatos en el shortlist aún
                </p>
                <Button onClick={generateShortlist} disabled={generating}>
                  {generating ? 'Generando...' : 'Generar Shortlist con IA'}
                </Button>
              </div>
            </BrandCard>
          ) : (
            shortlist.items.map((item: any) => (
              <BrandCard key={item.id} hover>
                <div className="flex gap-6">
                  {/* Score */}
                  <div className="flex flex-col items-center">
                    <div className="text-sm text-muted-foreground mb-1">
                      #{item.rank}
                    </div>
                    <ScoreDisplay score={item.total_score} size="md" />
                  </div>

                  {/* Candidate Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-bloque-navy900">
                          {item.candidate?.headline || 'Candidato'}
                        </h3>
                        {item.candidate?.location && (
                          <p className="text-sm text-muted-foreground">
                            {item.candidate.location}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">{item.status}</Badge>
                    </div>

                    {/* Skills */}
                    {item.candidate?.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {item.candidate.skills.slice(0, 6).map((skill: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Summary */}
                    {item.report?.summary && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {item.report.summary}
                      </p>
                    )}

                    {/* Reasons and Risks */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {item.top_reasons?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-bloque-navy900 mb-1">
                            Razones principales:
                          </p>
                          <ul className="space-y-1">
                            {item.top_reasons.map((reason: string, idx: number) => (
                              <li key={idx} className="text-xs text-muted-foreground flex gap-1">
                                <Star className="h-3 w-3 text-bloque-gold500 shrink-0 mt-0.5" />
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {item.risks?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-bloque-navy900 mb-1">
                            Riesgos potenciales:
                          </p>
                          <ul className="space-y-1">
                            {item.risks.map((risk: string, idx: number) => (
                              <li key={idx} className="text-xs text-muted-foreground flex gap-1">
                                <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0 mt-0.5" />
                                {risk}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Competency Scores */}
                    {item.candidate?.competency_scores && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-medium text-bloque-navy900 mb-2">
                          Competencias:
                        </p>
                        <CompetencyScores scores={item.candidate.competency_scores} />
                      </div>
                    )}
                  </div>
                </div>
              </BrandCard>
            ))
          )}
        </TabsContent>

        <TabsContent value="details">
          <div className="grid md:grid-cols-2 gap-6">
            <BrandCard>
              <BrandCardHeader title="Descripción" />
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {job.description}
              </p>
            </BrandCard>

            <div className="space-y-6">
              {job.must_haves?.length > 0 && (
                <BrandCard>
                  <BrandCardHeader title="Requisitos obligatorios" />
                  <ul className="space-y-1">
                    {job.must_haves.map((req: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground">
                        • {req}
                      </li>
                    ))}
                  </ul>
                </BrandCard>
              )}

              {job.nice_to_haves?.length > 0 && (
                <BrandCard>
                  <BrandCardHeader title="Requisitos deseables" />
                  <ul className="space-y-1">
                    {job.nice_to_haves.map((req: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground">
                        • {req}
                      </li>
                    ))}
                  </ul>
                </BrandCard>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
