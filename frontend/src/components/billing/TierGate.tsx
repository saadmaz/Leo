'use client'

import { Loader2 } from 'lucide-react'
import { useTier, type Tier } from '@/hooks/useTier'
import { UpgradePrompt } from './UpgradePrompt'

interface TierGateProps {
  /**
   * Minimum tier required to see `children`.
   * 'pro'    — visible to Pro and Agency users
   * 'agency' — visible to Agency users only
   */
  tier: Tier
  /**
   * One-sentence description of what the feature does, shown in the
   * UpgradePrompt when the user doesn't meet the requirement.
   */
  feature?: string
  children: React.ReactNode
}

/**
 * Soft gate for premium features.
 *
 * - Renders `children` if the user meets `tier`.
 * - Renders `<UpgradePrompt>` if they don't.
 * - Shows a loading spinner while billing state is still being fetched,
 *   preventing false-positive upgrade walls on first page load.
 *
 * Always wrap at the layout level, not inside individual page components,
 * so the Nav remains visible and navigable regardless of tier.
 *
 * Example (layout.tsx):
 *
 *   import { TierGate } from '@/components/billing/TierGate'
 *
 *   export default function Layout({ children }) {
 *     return (
 *       <TierGate tier="pro" feature="Advanced email marketing automation.">
 *         {children}
 *       </TierGate>
 *     )
 *   }
 */
export function TierGate({ tier, feature, children }: TierGateProps) {
  const { meetsRequirement, isLoading } = useTier()

  // Billing state not yet fetched — show a neutral spinner rather than
  // flashing the upgrade prompt for users who do have access.
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (meetsRequirement(tier)) {
    return <>{children}</>
  }

  return <UpgradePrompt requiredTier={tier} feature={feature} />
}
