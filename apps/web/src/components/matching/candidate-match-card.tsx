'use client'

import { User, Plus, X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MatchScoreBadge } from './match-score-badge'
import { cn } from '@/lib/utils'

interface CandidateMatchCardProps {
  candidateId: string
  candidateName: string | null
  score: number
  semanticScore: number
  skillsScore: number
  matchedSkills: string[]
  missingSkills: string[]
  status?: string
  onShortlist?: () => void
  onReject?: () => void
  onViewProfile?: () => void
}

export function CandidateMatchCard({
  candidateName,
  score,
  semanticScore,
  skillsScore,
  matchedSkills,
  missingSkills,
  status,
  onShortlist,
  onReject,
  onViewProfile,
}: CandidateMatchCardProps) {
  const initials = candidateName
    ? candidateName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  return (
    <div
      data-testid="candidate-match-card"
      className={cn(
        'group bg-white rounded-lg border p-4 hover:shadow-md transition-shadow',
        status === 'rejected' && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-medium text-bloque-navy900 truncate">
                {candidateName || 'Candidato'}
              </h3>
            </div>
            <MatchScoreBadge score={score} />
          </div>

          {matchedSkills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {matchedSkills.slice(0, 4).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {matchedSkills.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{matchedSkills.length - 4}
                </Badge>
              )}
            </div>
          )}

          {missingSkills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {missingSkills.slice(0, 3).map((skill) => (
                <Badge key={skill} variant="outline" className="text-xs text-red-500 border-red-200">
                  Falta: {skill}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span>Semantico: {Math.round(semanticScore)}%</span>
            <span>Skills: {Math.round(skillsScore)}%</span>
          </div>

          {status && status !== 'pending' && (
            <div className="mt-2">
              {status === 'shortlisted' && (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">En shortlist</Badge>
              )}
              {status === 'rejected' && (
                <Badge variant="secondary">Rechazado</Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {status !== 'shortlisted' && onShortlist && (
            <Button
              size="sm"
              variant="ghost"
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={onShortlist}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {status !== 'rejected' && onReject && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={onReject}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {onViewProfile && (
            <Button size="sm" variant="ghost" onClick={onViewProfile}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
