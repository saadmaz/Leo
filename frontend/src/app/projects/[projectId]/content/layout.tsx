'use client'

import { useParams, usePathname } from 'next/navigation'
import { TierGate } from '@/components/billing/TierGate'

/**
 * /content (hub page) → Free (3 generations/day credit-gated on the backend)
 * /content/*          → Pro
 */
export default function ContentLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>()
  const pathname = usePathname()

  const isRootPage = pathname === `/projects/${params.projectId}/content`

  if (isRootPage) {
    return <>{children}</>
  }

  return (
    <TierGate
      tier="pro"
      feature="Advanced content creation tools including case studies, gap analysis, headline optimisation, quality scoring, and translation."
    >
      {children}
    </TierGate>
  )
}
