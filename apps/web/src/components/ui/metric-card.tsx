'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { smooth } from '@/lib/animations'
import { Skeleton } from '@/components/ui/skeleton'

// ── Types ─────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: number
  previousValue?: number
  trend?: number[]
  icon?: React.ReactNode
  loading?: boolean
  className?: string
  format?: (value: number) => string
}

// ── Sparkline ─────────────────────────────────────────────

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const width = 80
  const height = 28
  const padding = 2

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = padding + (1 - (val - min) / range) * (height - padding * 2)
    return { x, y }
  })

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  // Area fill path (closed shape)
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`

  // Determine color based on trend direction
  const isUp = data[data.length - 1] >= data[0]
  const strokeColor = isUp ? '#16a34a' : '#dc2626' // green-600 / red-600
  const fillColor = isUp ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)'

  return (
    <motion.svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('flex-shrink-0', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.4 }}
    >
      <path d={areaD} fill={fillColor} />
      <motion.path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
      />
      {/* End dot */}
      <motion.circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2}
        fill={strokeColor}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, duration: 0.2 }}
      />
    </motion.svg>
  )
}

// ── Change indicator ──────────────────────────────────────

function ChangeIndicator({
  value,
  previousValue,
}: {
  value: number
  previousValue: number
}) {
  if (previousValue === 0 && value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-neutral-400">
        <Minus className="h-3 w-3" />
        0%
      </span>
    )
  }

  const pct =
    previousValue === 0
      ? 100
      : ((value - previousValue) / Math.abs(previousValue)) * 100

  const isUp = pct > 0
  const isFlat = pct === 0

  if (isFlat) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-neutral-400">
        <Minus className="h-3 w-3" />
        0%
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isUp ? 'text-success-600' : 'text-error-500'
      )}
    >
      {isUp ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isUp ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  )
}

// ── Loading skeleton ──────────────────────────────────────

function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────

function MetricCard({
  label,
  value,
  previousValue,
  trend,
  icon,
  loading = false,
  className,
  format,
}: MetricCardProps) {
  if (loading) {
    return <MetricCardSkeleton />
  }

  const formattedValue = format ? format(value) : value.toLocaleString('es-ES')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={smooth}
      className={cn(
        'group rounded-xl border border-neutral-200 bg-white p-5 shadow-soft transition-shadow duration-200 hover:shadow-medium',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: label + value + change */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 truncate">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-bloque-navy900 tabular-nums">
            {formattedValue}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            {previousValue !== undefined && (
              <ChangeIndicator value={value} previousValue={previousValue} />
            )}
            {trend && trend.length >= 2 && <Sparkline data={trend} />}
          </div>
        </div>

        {/* Right: icon */}
        {icon && (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 transition-colors duration-200 group-hover:bg-brand-100">
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export { MetricCard }
export type { MetricCardProps }
