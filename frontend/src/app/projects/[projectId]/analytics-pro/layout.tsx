'use client'

import { useParams, usePathname } from 'next/navigation'
import { TierGate } from '@/components/billing/TierGate'

/**
 * /analytics-pro (unified dashboard) → Pro
 * /analytics-pro/* (all other sub-pages)  → Agency
 *
 * The parent Pro gate is implicit: if a user reaches any analytics-pro
 * page they already have at least Pro from this layout. Sub-pages that
 * need Agency simply hit the Agency gate next.
 */
const PRO_PATHS = new Set(['', 'unified-dashboard'])

export default function AnalyticsProLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>()
  const pathname = usePathname()

  const base = `/projects/${params.projectId}/analytics-pro`
  const sub = pathname.replace(base, '').replace(/^\//, '').split('/')[0]

  const tier = PRO_PATHS.has(sub) ? 'pro' : 'agency'
  const feature = tier === 'pro'
    ? 'Analytics Pro unified dashboard with cross-channel performance overview and key metric summaries.'
    : 'Advanced analytics including cohort analysis, funnel tracking, CAC/LTV modelling, anomaly detection, and board reports.'

  return (
    <TierGate tier={tier} feature={feature}>
      {children}
    </TierGate>
  )
}
