'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Briefcase, MapPin, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/brand/AppShell'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { JobMatchCard } from '@/components/matching/job-match-card'
import { matchingApi, candidateApi, type MatchResult } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { toast } from 'sonner'

interface CandidateProfile {
  id: string
  user_id: string
  skills: string[]
  [key: string]: unknown
}

export default function RecommendedJobsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [jobs, setJobs] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [candidateId, setCandidateId] = useState<string | null>(null)
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [minScore, setMinScore] = useState(50)

  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      // Get candidate profile to get candidate ID
      const profile = await candidateApi.getProfile(accessToken) as CandidateProfile
      if (!profile?.id) {
        setLoading(false)
        return
      }
      setCandidateId(profile.id)

      // Fetch recommended jobs
      const data = await matchingApi.getJobsForCandidate(accessToken, profile.id, {
        min_score: minScore || undefined,
        limit: 20,
        modality: remoteOnly ? 'REMOTE' : undefined,
      })
      setJobs(data)
    } catch (err) {
      console.error('Error loading recommendations:', err)
    } finally {
      setLoading(false)
    }
  }, [accessToken, minScore, remoteOnly])

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadData()
  }, [isHydrated, isAuthenticated, loadData, router])

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-bloque-gold100 rounded-lg">
              <Sparkles className="w-6 h-6 text-bloque-gold600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-bloque-navy900">
                Trabajos Recomendados
              </h1>
              <p className="text-gray-600">
                Vacantes que matchean con tu perfil
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-6 mb-6 p-4 bg-white rounded-lg border">
          <div className="flex items-center gap-2">
            <Switch
              id="remote"
              checked={remoteOnly}
              onCheckedChange={setRemoteOnly}
            />
            <Label htmlFor="remote" className="flex items-center gap-1 cursor-pointer">
              <MapPin className="w-4 h-4" />
              Solo remoto
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-500">Match minimo:</Label>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="border rounded-md px-3 py-1.5 text-sm bg-white"
            >
              <option value={0}>Todos</option>
              <option value={50}>50%+ (Bueno)</option>
              <option value={70}>70%+ (Recomendado)</option>
              <option value={85}>85%+ (Excelente)</option>
            </select>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-bloque-navy900 mb-2">
              No hay vacantes recomendadas
            </h3>
            <p className="text-gray-500 mb-4">
              Completa tu perfil para recibir mejores recomendaciones
            </p>
            <Button onClick={() => router.push('/candidate/profile')}>
              Completar perfil
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((match) => (
              <JobMatchCard
                key={match.job_id}
                jobId={match.job_id}
                jobTitle={match.job_title}
                score={match.overall_score}
                semanticScore={match.semantic_score}
                skillsScore={match.skills_score}
                matchedSkills={match.matched_skills}
                missingSkills={match.missing_skills}
                metadata={match.metadata as Record<string, unknown>}
                onApply={() => {
                  router.push(`/candidate/jobs/${match.job_id}`)
                }}
                onViewDetails={() => {
                  router.push(`/candidate/jobs/${match.job_id}`)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
