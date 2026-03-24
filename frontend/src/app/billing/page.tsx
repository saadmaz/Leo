'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, Zap, Building2, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import type { BillingStatus } from '@/types'

// ---------------------------------------------------------------------------
// Plan card data
// ---------------------------------------------------------------------------

const PLANS = [
  {
    key: 'free' as const,
    label: 'Free',
    price: 0,
    icon: Sparkles,
    color: 'text-muted-foreground',
    borderColor: 'border-border',
    credits: '100 credits / day',
    features: [
      '1 project',
      '1 seat',
      '1 brand ingestion',
      '100 AI credits / day',
      'Chat, Bulk Generate, Library',
      'Community support',
    ],
  },
  {
    key: 'pro' as const,
    label: 'Pro',
    price: 49,
    icon: Zap,
    color: 'text-violet-400',
    borderColor: 'border-violet-500/50',
    popular: true,
    credits: '3,000 credits / month',
    features: [
      '5 projects',
      '3 seats',
      'Unlimited brand ingestions',
      '3,000 AI credits / month',
      'Campaigns, Content Planner, Image Studio',
      'Deep Search (SerpAPI + Firecrawl)',
      'Analytics & Insights',
      'Priority support',
    ],
  },
  {
    key: 'agency' as const,
    label: 'Agency',
    price: 149,
    icon: Building2,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/50',
    credits: '15,000 credits / month',
    features: [
      '25 projects',
      '5 seats',
      'Unlimited ingestions',
      '15,000 AI credits / month',
      'Everything in Pro',
      'Bulk Schedule to Calendar',
      'White-label ready',
      'Client portal & PDF exports',
      'Dedicated support',
    ],
  },
]

// ---------------------------------------------------------------------------
// UsageBar component
// ---------------------------------------------------------------------------

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const danger = pct >= 90
  const warning = pct >= 70

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className={danger ? 'text-red-400' : warning ? 'text-amber-400' : ''}>
          {used} / {limit >= 999 ? '∞' : limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            danger ? 'bg-red-500' : warning ? 'bg-amber-500' : 'bg-primary'
          }`}
          style={{ width: `${limit >= 999 ? 5 : pct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const router = useRouter()
  const { user } = useAppStore()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState('')

  // Check URL params for Stripe redirect feedback
  const searchParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : null
  const justSucceeded = searchParams?.get('success') === '1'
  const justCancelled = searchParams?.get('cancelled') === '1'

  useEffect(() => {
    if (!user) { router.replace('/login'); return }
    api.billing.status()
      .then(setStatus)
      .catch(() => setError('Failed to load billing info.'))
      .finally(() => setLoading(false))
  }, [user, router])

  async function handleUpgrade(plan: 'pro' | 'agency') {
    setUpgrading(plan)
    setError('')
    try {
      const { url } = await api.billing.checkout(plan)
      window.location.href = url
    } catch (err) {
      setError(String(err))
      setUpgrading(null)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    setError('')
    try {
      const { url } = await api.billing.portal()
      window.location.href = url
    } catch (err) {
      setError(String(err))
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    )
  }

  const currentPlan = status?.plan ?? 'free'

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Plans & Billing</h1>
          <p className="mt-2 text-muted-foreground">
            You are on the <span className="font-medium text-foreground capitalize">{currentPlan}</span> plan.
          </p>
        </div>

        {/* Banners */}
        {justSucceeded && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            <CheckCircle2 size={16} /> Subscription activated! Welcome to {currentPlan}.
          </div>
        )}
        {justCancelled && (
          <div className="mb-6 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Checkout cancelled. Your plan has not changed.
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Usage summary (only shown when on a paid plan or near limits) */}
        {status && (
          <div className="mb-8 rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              This month&apos;s usage
            </h2>
            <UsageBar
              label="Projects"
              used={status.projects.used}
              limit={status.projects.limit}
            />
            <UsageBar
              label="Messages"
              used={status.messages.used}
              limit={status.messages.limit}
            />
            <UsageBar
              label="Brand ingestions"
              used={status.ingestions.used}
              limit={status.ingestions.limit}
            />
          </div>
        )}

        {/* Plan cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon
            const isCurrent = plan.key === currentPlan
            const isPaid = currentPlan !== 'free'

            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative rounded-xl border bg-card p-6 flex flex-col gap-4 ${plan.borderColor} ${
                  isCurrent ? 'ring-1 ring-primary/40' : ''
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <Icon size={18} className={plan.color} />
                  <span className="font-semibold">{plan.label}</span>
                  {isCurrent && (
                    <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      Current
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div>
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{plan.credits}</p>
                </div>

                <ul className="flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.key === 'free' ? (
                  <button
                    disabled
                    className="w-full rounded-lg border border-border py-2 text-sm text-muted-foreground cursor-default"
                  >
                    {isCurrent ? 'Current plan' : 'Downgrade'}
                  </button>
                ) : isCurrent ? (
                  <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    className="w-full rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {portalLoading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Manage subscription'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.key as 'pro' | 'agency')}
                    disabled={!!upgrading || (isPaid && plan.key === 'pro' && currentPlan === 'agency')}
                    className={`w-full rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                      plan.key === 'pro'
                        ? 'bg-violet-600 hover:bg-violet-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {upgrading === plan.key ? (
                      <Loader2 size={14} className="animate-spin mx-auto" />
                    ) : (
                      `Upgrade to ${plan.label}`
                    )}
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Back link */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <button onClick={() => router.back()} className="hover:text-foreground underline-offset-2 hover:underline">
            ← Back
          </button>
        </p>
      </div>
    </div>
  )
}
