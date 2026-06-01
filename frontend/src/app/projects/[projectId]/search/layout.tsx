'use client'

import { useParams, usePathname } from 'next/navigation'
import { TierGate } from '@/components/billing/TierGate'

/**
 * The /search root page is Free (basic SEO hub).
 * All sub-pages (/search/keywords, /search/rank-tracker, etc.) require Pro.
 * Note: /seo-pro/* redirects to /search/* via next.config.mjs.
 */
export default function SearchLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>()
  const pathname = usePathname()

  const isRootPage = pathname === `/projects/${params.projectId}/search`

  if (isRootPage) {
    return <>{children}</>
  }

  return (
    <TierGate
      tier="pro"
      feature="Advanced SEO tools including keyword research, rank tracking, technical audits, blog briefs, and SERP intent analysis."
    >
      {children}
    </TierGate>
  )
}
