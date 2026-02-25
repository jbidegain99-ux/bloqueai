'use client'

import { useState, useEffect, ReactNode, createElement } from 'react'

// ── Types ───────────────────────────────────────────────────────

interface FeatureCheckResult {
  feature: string
  has_access: boolean
  plan_tier: string
  message: string | null
}

interface LimitCheckResult {
  limit_type: string
  current_usage: number
  max_allowed: number
  has_capacity: boolean
  plan_tier: string
}

interface UseFeatureReturn {
  hasAccess: boolean
  loading: boolean
  planTier: string | null
  message: string | null
}

interface UseLimitReturn {
  hasCapacity: boolean
  loading: boolean
  currentUsage: number
  maxAllowed: number
  planTier: string | null
  percentUsed: number
}

// ── Hooks ───────────────────────────────────────────────────────

/**
 * Check if the current company has access to a feature.
 */
export function useFeature(feature: string): UseFeatureReturn {
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [planTier, setPlanTier] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }

    fetch(`/api/billing/check-feature?feature=${encodeURIComponent(feature)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data: FeatureCheckResult) => {
        setHasAccess(data.has_access)
        setPlanTier(data.plan_tier)
        setMessage(data.message)
      })
      .catch(() => {
        setHasAccess(false)
      })
      .finally(() => setLoading(false))
  }, [feature])

  return { hasAccess, loading, planTier, message }
}

/**
 * Check if the current company is within its plan limit.
 */
export function useLimit(limitType: string, currentCount: number): UseLimitReturn {
  const [hasCapacity, setHasCapacity] = useState(true)
  const [loading, setLoading] = useState(true)
  const [maxAllowed, setMaxAllowed] = useState(0)
  const [planTier, setPlanTier] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }

    const params = new URLSearchParams({
      limit_type: limitType,
      current_count: String(currentCount),
    })

    fetch(`/api/billing/check-limit?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data: LimitCheckResult) => {
        setHasCapacity(data.has_capacity)
        setMaxAllowed(data.max_allowed)
        setPlanTier(data.plan_tier)
      })
      .catch(() => {
        setHasCapacity(true) // Default to allowing on error
      })
      .finally(() => setLoading(false))
  }, [limitType, currentCount])

  const percentUsed = maxAllowed > 0 ? Math.round((currentCount / maxAllowed) * 100) : 0

  return { hasCapacity, loading, currentUsage: currentCount, maxAllowed, planTier, percentUsed }
}

// ── Components ──────────────────────────────────────────────────

interface FeatureGateProps {
  feature: string
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Conditionally render children based on feature access.
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { hasAccess, loading } = useFeature(feature)

  if (loading) return null
  if (!hasAccess) return fallback ?? null

  return createElement('div', null, children)
}

interface UpgradePromptProps {
  feature: string
  title?: string
  description?: string
}

/**
 * Show an upgrade prompt when a feature is not available.
 */
export function UpgradePrompt({
  feature,
  title = 'Función premium',
  description = 'Actualice su plan para acceder a esta función.',
}: UpgradePromptProps) {
  const { hasAccess, loading, planTier } = useFeature(feature)

  if (loading || hasAccess) return null

  return createElement(
    'div',
    {
      className:
        'rounded-lg border border-amber-500/20 bg-amber-500/5 p-6 text-center',
    },
    createElement(
      'div',
      {
        className:
          'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10',
      },
      createElement(
        'svg',
        {
          className: 'h-6 w-6 text-amber-500',
          fill: 'none',
          viewBox: '0 0 24 24',
          strokeWidth: 1.5,
          stroke: 'currentColor',
        },
        createElement('path', {
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          d: 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z',
        })
      )
    ),
    createElement('h3', { className: 'text-lg font-semibold text-gray-900 dark:text-white' }, title),
    createElement(
      'p',
      { className: 'mt-1 text-sm text-gray-500 dark:text-gray-400' },
      description
    ),
    planTier &&
      createElement(
        'p',
        { className: 'mt-2 text-xs text-gray-400 dark:text-gray-500' },
        `Plan actual: ${planTier}`
      ),
    createElement(
      'a',
      {
        href: '/pricing',
        className:
          'mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors',
      },
      'Ver planes'
    )
  )
}
