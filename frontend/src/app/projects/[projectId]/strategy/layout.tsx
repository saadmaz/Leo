'use client'

import { useParams, usePathname } from 'next/navigation'
import { TierGate } from '@/components/billing/TierGate'

/**
 * Strategy tier map:
 *
 *   /strategy               → Pro  (hub page)
 *   /strategy/icp           → Pro
 *   /strategy/gtm           → Pro
 *   /strategy/personas      → Pro
 *   /strategy/*  (all else) → Agency
 */
const PRO_SUBS = new Set(['', 'icp', 'gtm', 'personas'])

export default function StrategyLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>()
  const pathname = usePathname()

  const base = `/projects/${params.projectId}/strategy`
  const sub = pathname.replace(base, '').replace(/^\//, '').split('/')[0]

  const tier = PRO_SUBS.has(sub) ? 'pro' : 'agency'
  const feature = tier === 'pro'
    ? 'Brand strategy tools including ICP definition, go-to-market planning, and audience persona generation.'
    : 'Full strategy suite with competitive mapping, market sizing, OKRs, budget planning, risk analysis, and launch playbooks.'

  return (
    <TierGate tier={tier} feature={feature}>
      {children}
    </TierGate>
  )
}
