'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import {
  CreditCard,
  Crown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  ArrowUpRight,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react'

// ── Interfaces ──────────────────────────────────────────────

interface PlanLimit {
  label: string
  used: number
  max: number
}

interface Subscription {
  id: string
  plan_id: string
  plan_name: string
  tier: 'free' | 'starter' | 'professional' | 'enterprise'
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  price: number
  currency: string
  period: 'monthly' | 'yearly'
  trial_end: string | null
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  limits: PlanLimit[]
}

interface Plan {
  id: string
  name: string
  tier: 'free' | 'starter' | 'professional' | 'enterprise'
  price_monthly: number
  price_yearly: number
  currency: string
  features: string[]
}

interface Invoice {
  id: string
  date: string
  amount: number
  currency: string
  status: 'paid' | 'open' | 'void' | 'draft' | 'uncollectible'
  description: string
  pdf_url: string | null
}

interface BillingState {
  subscription: Subscription | null
  plans: Plan[]
  invoices: Invoice[]
  loading: boolean
  error: string | null
}

// ── Helpers ─────────────────────────────────────────────────

const API_BASE = '/api'

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateStr))
}

function getDaysRemaining(dateStr: string): number {
  const now = new Date()
  const end = new Date(dateStr)
  const diff = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function getUsagePercentage(used: number, max: number): number {
  if (max === 0) return 0
  return Math.min(100, Math.round((used / max) * 100))
}

function getUsageColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500'
  if (percentage >= 70) return 'bg-amber-500'
  return 'bg-blue-500'
}

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'active':
      return { label: 'Active', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
    case 'trialing':
      return { label: 'Trial', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
    case 'past_due':
      return { label: 'Past Due', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
    case 'canceled':
      return { label: 'Canceled', className: 'bg-red-500/20 text-red-400 border-red-500/30' }
    case 'unpaid':
      return { label: 'Unpaid', className: 'bg-red-500/20 text-red-400 border-red-500/30' }
    default:
      return { label: status, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
  }
}

function getInvoiceStatusIcon(status: string) {
  switch (status) {
    case 'paid':
      return <CheckCircle className="h-4 w-4 text-emerald-400" />
    case 'open':
      return <Clock className="h-4 w-4 text-amber-400" />
    case 'void':
      return <XCircle className="h-4 w-4 text-slate-500" />
    default:
      return <FileText className="h-4 w-4 text-slate-400" />
  }
}

const TIER_ICONS: Record<string, typeof Crown> = {
  free: Zap,
  starter: Zap,
  professional: Crown,
  enterprise: Crown,
}

// ── Skeleton Components ─────────────────────────────────────

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-700/50 rounded ${className}`} />
}

function BillingPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <SkeletonBlock className="h-8 w-48 mb-2" />
        <SkeletonBlock className="h-5 w-72 mb-8" />

        {/* Plan card skeleton */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <SkeletonBlock className="h-10 w-10 rounded-lg" />
            <div>
              <SkeletonBlock className="h-6 w-40 mb-1" />
              <SkeletonBlock className="h-4 w-24" />
            </div>
          </div>
          <SkeletonBlock className="h-8 w-32 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <SkeletonBlock className="h-4 w-32 mb-2" />
                <SkeletonBlock className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Invoice table skeleton */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <SkeletonBlock className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────

export default function BillingSettingsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()

  const [state, setState] = useState<BillingState>({
    subscription: null,
    plans: [],
    invoices: [],
    loading: true,
    error: null,
  })
  const [cancelLoading, setCancelLoading] = useState(false)

  const fetchBillingData = useCallback(async () => {
    if (!accessToken) return

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const headers = { Authorization: `Bearer ${accessToken}` }

      const [subRes, plansRes, invoicesRes] = await Promise.allSettled([
        fetch(`${API_BASE}/billing/subscription`, { headers }),
        fetch(`${API_BASE}/billing/plans`),
        fetch(`${API_BASE}/billing/invoices`, { headers }),
      ])

      let subscription: Subscription | null = null
      let plans: Plan[] = []
      let invoices: Invoice[] = []

      if (subRes.status === 'fulfilled' && subRes.value.ok) {
        subscription = await subRes.value.json()
      }

      if (plansRes.status === 'fulfilled' && plansRes.value.ok) {
        plans = await plansRes.value.json()
      }

      if (invoicesRes.status === 'fulfilled' && invoicesRes.value.ok) {
        invoices = await invoicesRes.value.json()
      }

      setState({ subscription, plans, invoices, loading: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load billing data'
      setState((prev) => ({ ...prev, loading: false, error: message }))
    }
  }, [accessToken])

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    fetchBillingData()
  }, [isHydrated, isAuthenticated, router, fetchBillingData])

  const handleCancelSubscription = async () => {
    if (!accessToken || !state.subscription) return

    const confirmed = window.confirm(
      'Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period.'
    )
    if (!confirmed) return

    setCancelLoading(true)
    try {
      const res = await fetch(`${API_BASE}/billing/subscription/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      if (!res.ok) throw new Error('Failed to cancel subscription')
      await fetchBillingData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error canceling subscription'
      setState((prev) => ({ ...prev, error: message }))
    } finally {
      setCancelLoading(false)
    }
  }

  // ── Auth guard ──────────────────────────────────────────
  if (!isHydrated || !isAuthenticated) return null

  // ── Loading ─────────────────────────────────────────────
  if (state.loading) return <BillingPageSkeleton />

  // ── Error ───────────────────────────────────────────────
  if (state.error && !state.subscription) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-red-300 mb-1">Unable to load billing information</h2>
            <p className="text-sm text-red-400/80 mb-4">{state.error}</p>
            <button
              onClick={fetchBillingData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { subscription, plans, invoices } = state

  // ── No subscription ─────────────────────────────────────
  if (!subscription) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-2xl font-bold mb-2">Billing & Subscription</h1>
          <p className="text-slate-400 mb-8">Manage your plan, usage, and invoices</p>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-blue-600/20 flex items-center justify-center mb-4">
              <CreditCard className="h-7 w-7 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No active subscription</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
              Choose a plan to unlock premium features, increase your usage limits, and get the most out of the platform.
            </p>

            {plans.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 max-w-3xl mx-auto">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-5 text-left hover:border-blue-600/50 transition-colors"
                  >
                    <h3 className="font-semibold text-white mb-1">{plan.name}</h3>
                    <p className="text-2xl font-bold text-white mb-1">
                      {formatCurrency(plan.price_monthly, plan.currency)}
                      <span className="text-sm font-normal text-slate-400">/mo</span>
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {plan.features.slice(0, 4).map((feature, idx) => (
                        <li key={idx} className="text-xs text-slate-400 flex items-start gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => router.push('/pricing')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Choose a Plan
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Active subscription view ────────────────────────────

  const statusBadge = getStatusBadge(subscription.status)
  const TierIcon = TIER_ICONS[subscription.tier] || Zap
  const isTrialing = subscription.status === 'trialing' && subscription.trial_end
  const trialDaysLeft = isTrialing && subscription.trial_end ? getDaysRemaining(subscription.trial_end) : 0

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Billing & Subscription</h1>
          <p className="text-slate-400 text-sm">Manage your plan, usage, and invoices</p>
        </div>

        {/* Error banner (inline, non-blocking) */}
        {state.error && (
          <div className="mb-6 bg-red-950/30 border border-red-800/50 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {state.error}
          </div>
        )}

        {/* Trial Banner */}
        {isTrialing && (
          <div className="mb-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-white">
                  {trialDaysLeft > 0
                    ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining in your trial`
                    : 'Your trial has ended'}
                </p>
                <p className="text-xs text-slate-400">
                  Trial ends on {formatDate(subscription.trial_end as string)}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/pricing')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              Upgrade Now
            </button>
          </div>
        )}

        {/* Current Plan Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <TierIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{subscription.plan_name}</h2>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge.className}`}>
                    {statusBadge.label}
                  </span>
                </div>
                <p className="text-sm text-slate-400 capitalize">{subscription.tier} tier</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-2xl font-bold">
                {formatCurrency(subscription.price, subscription.currency)}
                <span className="text-sm font-normal text-slate-400">
                  /{subscription.period === 'yearly' ? 'yr' : 'mo'}
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {subscription.cancel_at_period_end
                  ? `Cancels on ${formatDate(subscription.current_period_end)}`
                  : `Renews ${formatDate(subscription.current_period_end)}`}
              </p>
            </div>
          </div>

          {/* Usage Bars */}
          {subscription.limits.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">Usage this period</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {subscription.limits.map((limit) => {
                  const pct = getUsagePercentage(limit.used, limit.max)
                  const barColor = getUsageColor(pct)
                  return (
                    <div key={limit.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-400">{limit.label}</span>
                        <span className="text-sm font-medium text-slate-300">
                          {limit.used.toLocaleString()}{' '}
                          <span className="text-slate-500">/ {limit.max.toLocaleString()}</span>
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {pct >= 90 && (
                        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Approaching limit
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-slate-800">
            <button
              onClick={() => router.push('/pricing')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-sm"
            >
              <ArrowUpRight className="h-4 w-4" />
              Upgrade Plan
            </button>
            {subscription.status !== 'canceled' && !subscription.cancel_at_period_end && (
              <button
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium rounded-lg transition-colors text-sm border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Cancel Subscription
              </button>
            )}
            {subscription.cancel_at_period_end && (
              <span className="inline-flex items-center gap-2 px-4 py-2.5 text-sm text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                Subscription will end on {formatDate(subscription.current_period_end)}
              </span>
            )}
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Invoices</h3>

          {invoices.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="h-10 w-10 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No invoices yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="text-left py-3 pr-4 font-medium">Date</th>
                    <th className="text-left py-3 pr-4 font-medium">Description</th>
                    <th className="text-right py-3 pr-4 font-medium">Amount</th>
                    <th className="text-left py-3 pr-4 font-medium">Status</th>
                    <th className="text-right py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-4 text-slate-300 whitespace-nowrap">
                        {formatDate(invoice.date)}
                      </td>
                      <td className="py-3 pr-4 text-slate-400 max-w-xs truncate">
                        {invoice.description}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium text-white whitespace-nowrap">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 capitalize">
                          {getInvoiceStatusIcon(invoice.status)}
                          <span className="text-slate-300">{invoice.status}</span>
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {invoice.pdf_url && (
                          <a
                            href={invoice.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                          >
                            Download
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
