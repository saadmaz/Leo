'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Zap, X, Crown } from 'lucide-react'
import type { Tier } from '@/hooks/useTier'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  pro: 'Pro',
  agency: 'Agency',
}

const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function dismissKey(tier: Tier, feature?: string) {
  const slug = feature
    ? feature.toLowerCase().replace(/\W+/g, '-').slice(0, 40)
    : 'generic'
  return `upgrade_prompt_dismissed_${tier}_${slug}`
}

function isDismissed(tier: Tier, feature?: string): boolean {
  if (typeof window === 'undefined') return false
  const raw = localStorage.getItem(dismissKey(tier, feature))
  if (!raw) return false
  return Date.now() < parseInt(raw, 10)
}

function setDismissed(tier: Tier, feature?: string) {
  localStorage.setItem(dismissKey(tier, feature), String(Date.now() + DISMISS_TTL_MS))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface UpgradePromptProps {
  /** The minimum tier required to access this feature. */
  requiredTier: Tier
  /**
   * One-sentence description of what the feature does.
   * Shown below the tier badge.
   */
  feature?: string
  /** Optional extra class names for the outer wrapper. */
  className?: string
}

/**
 * Full-height upgrade wall shown when a user's tier is below `requiredTier`.
 *
 * Behaviours:
 * - "Upgrade" CTA navigates to /billing
 * - "Remind me later" sets a localStorage flag that suppresses the prompt
 *   for 7 days (keyed by tier + feature slug to allow per-feature dismissal)
 */
export function UpgradePrompt({ requiredTier, feature, className }: UpgradePromptProps) {
  const router = useRouter()
  const [dismissed, setDismissedState] = useState(false)

  useEffect(() => {
    setDismissedState(isDismissed(requiredTier, feature))
  }, [requiredTier, feature])

  if (dismissed) return null

  const tierLabel = TIER_LABELS[requiredTier]
  const icon = requiredTier === 'agency'
    ? <Crown className="w-8 h-8 text-amber-500" />
    : <Lock className="w-8 h-8 text-primary" />
  const badgeCls = requiredTier === 'agency'
    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
    : 'bg-primary/10 text-primary border-primary/20'

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[400px] h-full w-full text-center px-8 py-12',
        className,
      )}
    >
      <div className={cn('p-4 rounded-full mb-4', requiredTier === 'agency' ? 'bg-amber-500/10' : 'bg-primary/10')}>
        {icon}
      </div>

      <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full border mb-3', badgeCls)}>
        <Zap className="w-3 h-3" />
        {tierLabel} feature
      </span>

      <h2 className="text-lg font-semibold text-foreground mb-2">
        Upgrade to {tierLabel} to unlock this
      </h2>

      {feature ? (
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-8">
          {feature}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground max-w-sm mb-8">
          This feature is available on the {tierLabel} plan and above.
        </p>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={() => router.push('/billing')}
          className={cn(
            'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors',
            requiredTier === 'agency'
              ? 'bg-amber-500 text-white hover:bg-amber-500/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          <Zap className="w-4 h-4" />
          Upgrade to {tierLabel}
        </button>

        <button
          onClick={() => {
            setDismissed(requiredTier, feature)
            setDismissedState(true)
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Remind me later
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground mt-4">
        Prompt suppressed for 7 days after dismissal
      </p>
    </div>
  )
}
