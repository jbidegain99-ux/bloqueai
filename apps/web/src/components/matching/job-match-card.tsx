'use client'

import { Building2, MapPin, DollarSign, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MatchScoreBadge } from './match-score-badge'

interface JobMatchCardProps {
  jobId: string
  jobTitle: string | null
  score: number
  semanticScore: number
  skillsScore: number
  matchedSkills: string[]
  missingSkills: string[]
  metadata: Record<string, unknown>
  onApply?: () => void
  onViewDetails?: () => void
}

export function JobMatchCard({
  jobTitle,
  score,
  semanticScore,
  skillsScore,
  matchedSkills,
  missingSkills,
  metadata,
  onApply,
  onViewDetails,
}: JobMatchCardProps) {
  const modality = metadata?.modality as string | undefined
  const salaryRange = metadata?.salary_range as { min: number | null; max: number | null } | undefined

  const getModalityLabel = (m?: string) => {
    if (!m) return null
    const labels: Record<string, string> = { REMOTE: 'Remoto', HYBRID: 'Hibrido', ONSITE: 'Presencial' }
    return labels[m.toUpperCase()] || m
  }

  const formatSalary = (range?: { min: number | null; max: number | null }) => {
    if (!range) return null
    if (range.min && range.max) return `$${(range.min / 1000).toFixed(0)}k - $${(range.max / 1000).toFixed(0)}k`
    if (range.min) return `Desde $${(range.min / 1000).toFixed(0)}k`
    if (range.max) return `Hasta $${(range.max / 1000).toFixed(0)}k`
    return null
  }

  return (
    <div
      data-testid="job-match-card"
      className="group bg-white rounded-lg border p-5 hover:shadow-lg transition-all cursor-pointer"
      onClick={onViewDetails}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="w-12 h-12 bg-bloque-gray50 rounded-lg flex items-center justify-center shrink-0">
          <Building2 className="w-6 h-6 text-gray-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-bloque-navy900">
                {jobTitle || 'Puesto'}
              </h3>
              <p className="text-sm text-gray-500">Bloque Internacional</p>
            </div>
            <MatchScoreBadge score={score} />
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-500">
            {modality && (
              <Badge variant="outline" className="text-xs">
                {getModalityLabel(modality)}
              </Badge>
            )}
            {formatSalary(salaryRange) && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                {formatSalary(salaryRange)}
              </span>
            )}
          </div>

          {matchedSkills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {matchedSkills.slice(0, 4).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span>Match semantico: {Math.round(semanticScore)}%</span>
            <span>Match skills: {Math.round(skillsScore)}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onApply?.()
          }}
        >
          Aplicar
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
