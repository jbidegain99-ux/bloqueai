'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { smooth } from '@/lib/animations'
import { Skeleton } from '@/components/ui/skeleton'

// ── Types ─────────────────────────────────────────────────

interface PipelineStage {
  key: string
  label: string
  count: number
  color: string
}

interface PipelineFunnelProps {
  stages?: PipelineStage[]
  onStageClick?: (stageKey: string) => void
  loading?: boolean
  className?: string
}

// ── Default stages ────────────────────────────────────────

const DEFAULT_STAGES: PipelineStage[] = [
  { key: 'applied', label: 'Aplicados', count: 0, color: 'from-brand-400 to-brand-500' },
  { key: 'screening', label: 'Screening', count: 0, color: 'from-info-400 to-info-500' },
  { key: 'interview', label: 'Entrevista', count: 0, color: 'from-warning-500 to-warning-600' },
  { key: 'offer', label: 'Oferta', count: 0, color: 'from-success-500 to-success-600' },
  { key: 'hired', label: 'Contratado', count: 0, color: 'from-success-600 to-success-700' },
]

// ── Loading skeleton ──────────────────────────────────────

function PipelineFunnelSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-soft">
      <Skeleton className="h-5 w-40 mb-6" />
      <div className="flex items-end gap-2">
        {[100, 80, 55, 35, 20].map((w, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-12 rounded-lg" style={{ width: `${w}%` }} />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────

function StageTooltip({
  stage,
  percentage,
  conversionFromPrev,
}: {
  stage: PipelineStage
  percentage: number
  conversionFromPrev: number | null
}) {
  return (
    <div className="absolute -top-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="bg-bloque-navy900 text-white text-xs rounded-lg px-3 py-2 shadow-elevated whitespace-nowrap">
        <p className="font-semibold">{stage.label}</p>
        <p className="text-neutral-300">
          {stage.count} candidato{stage.count !== 1 ? 's' : ''} ({percentage.toFixed(1)}%)
        </p>
        {conversionFromPrev !== null && (
          <p className="text-neutral-400 text-[10px] mt-0.5">
            Conversión: {conversionFromPrev.toFixed(1)}%
          </p>
        )}
        {/* Arrow */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-bloque-navy900 rotate-45" />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────

function PipelineFunnel({
  stages,
  onStageClick,
  loading = false,
  className,
}: PipelineFunnelProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

  if (loading) {
    return <PipelineFunnelSkeleton />
  }

  const data = stages ?? DEFAULT_STAGES
  const maxCount = Math.max(...data.map((s) => s.count), 1)
  const totalFirst = data[0]?.count || 1

  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200 bg-white p-6 shadow-soft',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-bloque-navy900">
          Pipeline de Reclutamiento
        </h3>
        <p className="text-xs text-neutral-400">
          {data.reduce((sum, s) => sum + s.count, 0)} total
        </p>
      </div>

      {/* Funnel bars */}
      <div className="flex items-end gap-3">
        {data.map((stage, i) => {
          const barHeight = maxCount > 0
            ? Math.max(20, (stage.count / maxCount) * 100)
            : 20
          const percentage = (stage.count / totalFirst) * 100
          const conversionFromPrev =
            i > 0 && data[i - 1].count > 0
              ? (stage.count / data[i - 1].count) * 100
              : null

          return (
            <div
              key={stage.key}
              className="flex-1 flex flex-col items-center gap-2 relative"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Tooltip */}
              {hoveredIndex === i && (
                <StageTooltip
                  stage={stage}
                  percentage={percentage}
                  conversionFromPrev={conversionFromPrev}
                />
              )}

              {/* Count */}
              <motion.span
                className="text-lg font-bold text-bloque-navy900 tabular-nums"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...smooth, delay: i * 0.08 }}
              >
                {stage.count}
              </motion.span>

              {/* Bar */}
              <motion.button
                onClick={() => onStageClick?.(stage.key)}
                className={cn(
                  'w-full rounded-lg bg-gradient-to-b cursor-pointer transition-all duration-200',
                  stage.color,
                  onStageClick
                    ? 'hover:shadow-medium hover:scale-[1.03] active:scale-[0.98]'
                    : 'cursor-default'
                )}
                style={{ minHeight: 16 }}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: barHeight, opacity: 1 }}
                transition={{
                  height: { duration: 0.5, delay: i * 0.1, ease: 'easeOut' },
                  opacity: { duration: 0.3, delay: i * 0.1 },
                }}
                aria-label={`${stage.label}: ${stage.count}`}
              />

              {/* Label + percentage */}
              <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                <p className="text-xs font-medium text-bloque-navy900">
                  {stage.label}
                </p>
                <p className="text-[10px] text-neutral-400 tabular-nums">
                  {percentage.toFixed(0)}%
                </p>
              </motion.div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { PipelineFunnel, DEFAULT_STAGES }
export type { PipelineStage, PipelineFunnelProps }
