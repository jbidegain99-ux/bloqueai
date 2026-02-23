'use client'

import { cn } from '@/lib/utils'

interface MatchScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function MatchScoreBadge({ score, size = 'md', showLabel = true }: MatchScoreBadgeProps) {
  const getScoreColor = (s: number) => {
    if (s >= 85) return 'text-green-700 bg-green-50 border-green-200'
    if (s >= 70) return 'text-blue-700 bg-blue-50 border-blue-200'
    if (s >= 50) return 'text-amber-700 bg-amber-50 border-amber-200'
    return 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const getScoreLabel = (s: number) => {
    if (s >= 85) return 'Excelente'
    if (s >= 70) return 'Muy bueno'
    if (s >= 50) return 'Bueno'
    return 'Regular'
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }

  return (
    <span
      data-testid="match-score-badge"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        getScoreColor(score),
        sizeClasses[size]
      )}
    >
      <span className="font-bold">{Math.round(score)}%</span>
      {showLabel && <span className="opacity-80">{getScoreLabel(score)}</span>}
    </span>
  )
}
