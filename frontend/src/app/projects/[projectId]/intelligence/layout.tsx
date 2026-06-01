'use client'

import { useParams, usePathname } from 'next/navigation'
import { TierGate } from '@/components/billing/TierGate'

/**
 * /intelligence, /intelligence/monitoring, /intelligence/profiles,
 * /intelligence/alerts → Pro
 *
 * /intelligence/deep-research → Agency
 */
export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>()
  const pathname = usePathname()

  const base = `/projects/${params.projectId}/intelligence`
  const sub = pathname.replace(base, '').replace(/^\//, '').split('/')[0]

  const isDeepResearch = sub === 'deep-research'
  const tier = isDeepResearch ? 'agency' : 'pro'
  const feature = isDeepResearch
    ? 'AI-powered deep research that autonomously searches, scrapes, and synthesises web sources into structured intelligence reports.'
    : 'Competitive intelligence including competitor monitoring, profile tracking, and real-time alerts on competitor activity.'

  return (
    <TierGate tier={tier} feature={feature}>
      {children}
    </TierGate>
  )
}
