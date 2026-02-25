'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Users, UserCheck, UserX, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/brand/AppShell'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { CandidateMatchCard } from '@/components/matching/candidate-match-card'
import { matchingApi, type MatchResult } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { toast } from 'sonner'

export default function JobMatchesPage() {
  const { id: jobId } = useParams<{ id: string }>()
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [savedStatuses, setSavedStatuses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [minScore, setMinScore] = useState(0)

  const loadMatches = useCallback(async () => {
    if (!accessToken || !jobId) return
    setLoading(true)
    try {
      const data = await matchingApi.getCandidatesForJob(accessToken, jobId, {
        min_score: minScore || undefined,
        limit: 50,
      })
      setMatches(data)

      // Load saved match statuses
      try {
        const saved = await matchingApi.getMatchesForJob(accessToken, jobId)
        const statusMap: Record<string, string> = {}
        for (const m of saved) {
          statusMap[m.candidate_id] = m.status
        }
        setSavedStatuses(statusMap)
      } catch {
        // No saved matches yet
      }
    } catch (err) {
      console.error('Error loading matches:', err)
    } finally {
      setLoading(false)
    }
  }, [accessToken, jobId, minScore])

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadMatches()
  }, [isHydrated, isAuthenticated, loadMatches, router])

  const handleShortlist = async (candidateId: string, score: number) => {
    if (!accessToken || !jobId) return
    try {
      const saved = await matchingApi.saveMatch(accessToken, {
        candidate_id: candidateId,
        job_id: jobId,
        overall_score: score,
      })
      await matchingApi.updateMatchStatus(accessToken, saved.id, { status: 'shortlisted' })
      setSavedStatuses((prev) => ({ ...prev, [candidateId]: 'shortlisted' }))
      toast.success('Candidato agregado a shortlist')
    } catch (err) {
      toast.error('Error al agregar a shortlist')
    }
  }

  const handleReject = async (candidateId: string, score: number) => {
    if (!accessToken || !jobId) return
    try {
      const saved = await matchingApi.saveMatch(accessToken, {
        candidate_id: candidateId,
        job_id: jobId,
        overall_score: score,
      })
      await matchingApi.updateMatchStatus(accessToken, saved.id, { status: 'rejected' })
      setSavedStatuses((prev) => ({ ...prev, [candidateId]: 'rejected' }))
      toast.success('Candidato rechazado')
    } catch (err) {
      toast.error('Error al rechazar candidato')
    }
  }

  const getStatus = (candidateId: string) => savedStatuses[candidateId] || 'pending'

  const filteredMatches = matches.filter((m) => {
    const status = getStatus(m.candidate_id)
    if (activeTab === 'all') return status !== 'rejected'
    if (activeTab === 'shortlisted') return status === 'shortlisted'
    if (activeTab === 'rejected') return status === 'rejected'
    return true
  })

  const stats = {
    total: matches.length,
    shortlisted: matches.filter((m) => getStatus(m.candidate_id) === 'shortlisted').length,
    rejected: matches.filter((m) => getStatus(m.candidate_id) === 'rejected').length,
  }

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-bloque-navy900">
              Candidatos Recomendados
            </h1>
            <p className="text-gray-600">Candidatos que matchean con esta vacante</p>
          </div>
          <Button variant="outline" onClick={loadMatches} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-500">Total matches</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.shortlisted}</p>
                <p className="text-sm text-gray-500">En shortlist</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <UserX className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.rejected}</p>
                <p className="text-sm text-gray-500">Rechazados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Score filter */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Score minimo:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="border rounded-md px-3 py-1.5 text-sm bg-white"
            >
              <option value={0}>Todos</option>
              <option value={50}>50%+</option>
              <option value={70}>70%+</option>
              <option value={85}>85%+</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">
              Todos ({stats.total - stats.rejected})
            </TabsTrigger>
            <TabsTrigger value="shortlisted">
              Shortlist ({stats.shortlisted})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rechazados ({stats.rejected})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-bloque-navy900 mb-2">
                  No hay candidatos
                </h3>
                <p className="text-gray-500">
                  {activeTab === 'all'
                    ? 'No se encontraron candidatos que matcheen con esta vacante'
                    : 'No hay candidatos en esta categoria'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMatches.map((match) => (
                  <CandidateMatchCard
                    key={match.candidate_id}
                    candidateId={match.candidate_id}
                    candidateName={match.candidate_name}
                    score={match.overall_score}
                    semanticScore={match.semantic_score}
                    skillsScore={match.skills_score}
                    matchedSkills={match.matched_skills}
                    missingSkills={match.missing_skills}
                    status={getStatus(match.candidate_id)}
                    onShortlist={() => handleShortlist(match.candidate_id, match.overall_score)}
                    onReject={() => handleReject(match.candidate_id, match.overall_score)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
