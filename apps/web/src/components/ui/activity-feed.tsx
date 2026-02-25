'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  FileText,
  MessageSquare,
  Gift,
  UserCheck,
  StickyNote,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/lib/animations'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

// ── Types ─────────────────────────────────────────────────

type ActivityType = 'application' | 'interview' | 'offer' | 'hire' | 'note'

interface Activity {
  id: string
  type: ActivityType
  title: string
  description: string
  timestamp: string
  link?: string
}

interface ActivityFeedProps {
  activities: Activity[]
  loading?: boolean
  className?: string
}

// ── Config per type ───────────────────────────────────────

interface ActivityTypeConfig {
  icon: React.ReactNode
  bgColor: string
  iconColor: string
}

const typeConfig: Record<ActivityType, ActivityTypeConfig> = {
  application: {
    icon: <FileText className="h-4 w-4" />,
    bgColor: 'bg-brand-50',
    iconColor: 'text-brand-500',
  },
  interview: {
    icon: <MessageSquare className="h-4 w-4" />,
    bgColor: 'bg-info-50',
    iconColor: 'text-info-500',
  },
  offer: {
    icon: <Gift className="h-4 w-4" />,
    bgColor: 'bg-warning-50',
    iconColor: 'text-warning-600',
  },
  hire: {
    icon: <UserCheck className="h-4 w-4" />,
    bgColor: 'bg-success-50',
    iconColor: 'text-success-600',
  },
  note: {
    icon: <StickyNote className="h-4 w-4" />,
    bgColor: 'bg-neutral-100',
    iconColor: 'text-neutral-500',
  },
}

// ── Relative time (Spanish) ──────────────────────────────

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then

  if (diffMs < 0) return 'ahora'

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'ahora'
  if (minutes === 1) return 'hace 1 min'
  if (minutes < 60) return `hace ${minutes} min`
  if (hours === 1) return 'hace 1 h'
  if (hours < 24) return `hace ${hours} h`
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`

  const months = Math.floor(days / 30)
  if (months === 1) return 'hace 1 mes'
  if (months < 12) return `hace ${months} meses`

  const years = Math.floor(months / 12)
  if (years === 1) return 'hace 1 año'
  return `hace ${years} años`
}

// ── Skeleton ─────────────────────────────────────────────

function ActivityFeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3">
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Item ─────────────────────────────────────────────────

function ActivityItem({ activity }: { activity: Activity }) {
  const config = typeConfig[activity.type]

  const content = (
    <motion.div
      variants={staggerItem}
      className={cn(
        'flex items-start gap-3 rounded-lg p-3 transition-colors duration-150',
        activity.link && 'cursor-pointer hover:bg-neutral-50'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
          config.bgColor,
          config.iconColor
        )}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900 truncate">
          {activity.title}
        </p>
        <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
          {activity.description}
        </p>
        <p className="text-xs text-neutral-400 mt-1">
          {formatRelativeTime(activity.timestamp)}
        </p>
      </div>
    </motion.div>
  )

  if (activity.link) {
    return <Link href={activity.link}>{content}</Link>
  }

  return content
}

// ── Main component ───────────────────────────────────────

function ActivityFeed({ activities, loading = false, className }: ActivityFeedProps) {
  if (loading) {
    return <ActivityFeedSkeleton />
  }

  if (activities.length === 0) {
    return <EmptyState variant="generic" className={className} />
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={cn('divide-y divide-neutral-100', className)}
    >
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </motion.div>
  )
}

export { ActivityFeed, ActivityFeedSkeleton, formatRelativeTime }
export type { Activity, ActivityType, ActivityFeedProps }
