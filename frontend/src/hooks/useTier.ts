'use client'

import { useAppStore } from '@/stores/app-store'

export type Tier = 'free' | 'pro' | 'agency'

const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, agency: 2 }

export interface TierState {
  /** The user's current tier. Defaults to 'free' while loading. */
  tier: Tier
  /** True until at least one of billingStatus or credits has loaded. */
  isLoading: boolean
  isPro: boolean
  isAgency: boolean
  /** Returns true when the user's tier satisfies `required`. */
  meetsRequirement: (required: Tier) => boolean
}

/**
 * Returns the current user's billing tier and convenience booleans.
 *
 * Derives the tier from the Zustand store's `credits.plan` (populated by the
 * sidebar on mount via /credits/balance) and falls back to `billingStatus.plan`
 * from /billing/status.  Both sources return 'free' for unauthenticated users.
 */
export function useTier(): TierState {
  const { billingStatus, credits } = useAppStore()

  const isLoading = billingStatus === null && credits === null
  const tier = ((credits?.plan ?? billingStatus?.plan) || 'free') as Tier

  return {
    tier,
    isLoading,
    isPro: TIER_RANK[tier] >= TIER_RANK.pro,
    isAgency: TIER_RANK[tier] >= TIER_RANK.agency,
    meetsRequirement: (required: Tier) =>
      TIER_RANK[tier] >= TIER_RANK[required],
  }
}
