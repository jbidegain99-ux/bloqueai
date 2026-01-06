'use client'

import React from 'react'
import { cn, formatScore, getScoreColor, getScoreBgColor } from '@/lib/utils'

interface ScoreDisplayProps {
  score: number | null | undefined
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  label?: string
  className?: string
}

export function ScoreDisplay({
  score,
  size = 'md',
  showLabel = false,
  label,
  className,
}: ScoreDisplayProps) {
  const sizeClasses = {
    sm: 'text-lg font-semibold w-10 h-10',
    md: 'text-2xl font-bold w-14 h-14',
    lg: 'text-4xl font-bold w-20 h-20',
  }

  const displayScore = score ?? 0

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-full',
          sizeClasses[size],
          score !== null && score !== undefined
            ? getScoreBgColor(displayScore)
            : 'bg-gray-100'
        )}
      >
        <span
          className={cn(
            score !== null && score !== undefined
              ? getScoreColor(displayScore)
              : 'text-gray-400'
          )}
        >
          {formatScore(score)}
        </span>
      </div>
      {showLabel && label && (
        <span className="text-xs text-muted-foreground mt-1 text-center">
          {label}
        </span>
      )}
    </div>
  )
}

interface CompetencyScoresProps {
  scores: Record<string, { score: number; notes?: string }> | Record<string, number>
  className?: string
}

export function CompetencyScores({ scores, className }: CompetencyScoresProps) {
  const competencyLabels: Record<string, string> = {
    technical_skills: 'Habilidades Técnicas',
    communication: 'Comunicación',
    problem_solving: 'Resolución de Problemas',
    teamwork: 'Trabajo en Equipo',
    leadership: 'Liderazgo',
    adaptability: 'Adaptabilidad',
    cultural_fit: 'Fit Cultural',
  }

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4', className)}>
      {Object.entries(scores).map(([key, value]) => {
        const score = typeof value === 'number' ? value : value?.score ?? 0
        return (
          <div key={key} className="text-center">
            <ScoreDisplay score={score} size="sm" />
            <p className="text-xs text-muted-foreground mt-1">
              {competencyLabels[key] || key}
            </p>
          </div>
        )
      })}
    </div>
  )
}
