'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScoreDisplay } from '@/components/brand/ScoreDisplay'
import { useAuthStore, isEmployer } from '@/lib/auth'
import { employerApi } from '@/lib/api'
import { getErrorMessage } from '@/types'
import {
  Users,
  Briefcase,
  ChevronRight,
  AlertTriangle,
  Star,
  MapPin,
  Clock,
  FileText,
  Mail,
  Eye
} from 'lucide-react'

interface ShortlistItem {
  id: string
  candidate_id: string
  rank: number
  total_score: number
  final_score: number
  interview_status: string
  status: string
  candidate?: {
    id: string
    headline?: string
    location?: string
    skills?: string[]
    ai_summary?: string
  }
  report?: {
    overall_score: number
    summary?: string
  }
  top_reasons?: string[]
  risks?: string[]
}

interface JobWithShortlist {
  id: string
  title: string
  status: string
  location?: string
  shortlist_count: number
  shortlist?: ShortlistItem[]
}

export default function ShortlistsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [jobs, setJobs] = useState<JobWithShortlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [loadingShortlist, setLoadingShortlist] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isEmployer()) {
      router.push('/dashboard')
      return
    }

    loadJobs()
  }, [isHydrated, isAuthenticated, accessToken, router])

  const loadJobs = async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)

    try {
      const jobsData = await employerApi.getJobs(accessToken)
      const allJobs = (jobsData.items || []) as unknown as JobWithShortlist[]
      // Only show jobs that have shortlist candidates
      const jobsWithShortlists = allJobs.filter((j) => j.shortlist_count > 0)
      setJobs(jobsWithShortlists)

      // Auto-expand first job if available
      if (jobsWithShortlists.length > 0) {
        loadShortlistForJob(jobsWithShortlists[0].id)
      }
    } catch (err: unknown) {
      console.error('Error loading jobs:', err)
      setError(getErrorMessage(err) || 'Error al cargar las vacantes')
    } finally {
      setLoading(false)
    }
  }

  const loadShortlistForJob = async (jobId: string) => {
    if (!accessToken) return
    setLoadingShortlist(jobId)
    setExpandedJob(jobId)

    try {
      const shortlistData = await employerApi.getShortlist(accessToken, jobId)
      setJobs(prev => prev.map(job =>
        job.id === jobId
          ? { ...job, shortlist: shortlistData.items || [] }
          : job
      ))
    } catch (err: unknown) {
      console.error('Error loading shortlist:', err)
    } finally {
      setLoadingShortlist(null)
    }
  }

  const toggleJob = (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null)
    } else {
      const job = jobs.find(j => j.id === jobId)
      if (!job?.shortlist) {
        loadShortlistForJob(jobId)
      } else {
        setExpandedJob(jobId)
      }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline">Pendiente</Badge>
      case 'CONTACTED':
        return <Badge variant="success">Contactado</Badge>
      case 'INTERVIEW_SCHEDULED':
        return <Badge variant="warning">Entrevista</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Rechazado</Badge>
      case 'HIRED':
        return <Badge className="bg-green-600">Contratado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getInterviewStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success" className="text-xs">Entrevista OK</Badge>
      case 'IN_PROGRESS':
        return <Badge variant="warning" className="text-xs">En Progreso</Badge>
      case 'PENDING':
        return <Badge variant="outline" className="text-xs">Sin Entrevista</Badge>
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  if (!isHydrated || !isAuthenticated) return null

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Cargando shortlists...</div>
        </div>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadJobs} variant="outline">
            Reintentar
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <BrandHero
        title="Shortlists"
        subtitle="Candidatos preseleccionados por IA para tus vacantes"
        size="sm"
      />

      <div className="mt-6 space-y-4">
        {jobs.length === 0 ? (
          <BrandCard>
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold text-bloque-navy900 mb-2">
                No hay shortlists generados
              </h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Genera un shortlist desde la pagina de una vacante para ver
                los candidatos preseleccionados por la IA.
              </p>
              <Link href="/employer/jobs">
                <Button>Ver mis vacantes</Button>
              </Link>
            </div>
          </BrandCard>
        ) : (
          jobs.map((job) => (
            <BrandCard key={job.id}>
              {/* Job Header */}
              <button
                onClick={() => toggleJob(job.id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-bloque-gray50 rounded-lg">
                      <Briefcase className="h-5 w-5 text-bloque-navy900" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-bloque-navy900">{job.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {job.shortlist_count} candidatos
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      expandedJob === job.id ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Shortlist Items */}
              {expandedJob === job.id && (
                <div className="mt-4 pt-4 border-t">
                  {loadingShortlist === job.id ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="animate-pulse">Cargando candidatos...</div>
                    </div>
                  ) : !job.shortlist || job.shortlist.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        No hay candidatos en el shortlist
                      </p>
                      <Link href={`/employer/jobs/${job.id}`}>
                        <Button variant="outline" size="sm">
                          Generar shortlist
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {job.shortlist.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-lg border hover:border-bloque-navy900/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              {/* Rank */}
                              <div className="flex-shrink-0 w-8 h-8 bg-bloque-navy900 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                {item.rank}
                              </div>

                              {/* Candidate Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-bloque-navy900">
                                    {item.candidate?.headline || 'Candidato'}
                                  </h4>
                                  {getInterviewStatusBadge(item.interview_status)}
                                </div>

                                {item.candidate?.location && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                                    <MapPin className="h-3 w-3" />
                                    {item.candidate.location}
                                  </p>
                                )}

                                {/* Skills */}
                                {item.candidate?.skills && item.candidate.skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {item.candidate.skills.slice(0, 5).map((skill, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {skill}
                                      </Badge>
                                    ))}
                                    {item.candidate.skills.length > 5 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{item.candidate.skills.length - 5}
                                      </Badge>
                                    )}
                                  </div>
                                )}

                                {/* Top Reasons */}
                                {item.top_reasons && item.top_reasons.length > 0 && (
                                  <div className="text-xs text-green-600 flex items-start gap-1">
                                    <Star className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                    <span>{item.top_reasons[0]}</span>
                                  </div>
                                )}

                                {/* Risks */}
                                {item.risks && item.risks.length > 0 && (
                                  <div className="text-xs text-amber-600 flex items-start gap-1 mt-1">
                                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                    <span>{item.risks[0]}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Score & Actions */}
                            <div className="flex flex-col items-end gap-2">
                              <ScoreDisplay
                                score={item.report?.overall_score || item.total_score}
                                size="sm"
                              />
                              <div className="text-xs text-muted-foreground text-right">
                                Score: {item.final_score?.toFixed(0) || '-'}/100
                              </div>
                              {getStatusBadge(item.status)}

                              {/* Action Buttons */}
                              <div className="flex gap-1 mt-2">
                                <Link href={`/employer/jobs/${job.id}/candidates/${item.candidate_id}`}>
                                  <Button variant="outline" size="sm" className="text-xs px-2 py-1 h-7">
                                    <Eye className="h-3 w-3 mr-1" />
                                    Ver
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* View Full Shortlist */}
                      <Link href={`/employer/jobs/${job.id}`}>
                        <Button variant="outline" className="w-full mt-2">
                          Ver vacante completa
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </BrandCard>
          ))
        )}
      </div>
    </AppShell>
  )
}
