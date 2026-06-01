'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft, BarChart2, Loader2, TrendingUp, ExternalLink,
  BookOpen, CheckCircle2, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'
import { cn } from '@/lib/utils'
import type { Campaign, ContentLibraryItem } from '@/types'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    posted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    draft: 'bg-muted text-muted-foreground',
    in_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  }
  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize', styles[status] ?? styles.draft)}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CampaignPerformancePage() {
  const { projectId, campaignId } = useParams<{ projectId: string; campaignId: string }>()
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [libraryItems, setLibraryItems] = useState<ContentLibraryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.campaigns.get(projectId, campaignId),
      api.contentLibrary.list(projectId, { limit: 500 }),
    ]).then(([camp, libData]) => {
      setCampaign(camp)
      const linked = libData.items.filter(
        (item) => item.metadata?.campaign_id === campaignId
      )
      setLibraryItems(linked)
    }).catch(() => toast.error('Failed to load performance data'))
      .finally(() => setLoading(false))
  }, [projectId, campaignId])

  // Aggregate stats from linked library items
  const posted = libraryItems.filter((i) => i.status === 'posted')
  const scheduled = libraryItems.filter((i) => i.status === 'scheduled')
  const avgScore = libraryItems.filter((i) => i.voice_score != null).reduce(
    (sum, i, _, arr) => (arr.length ? sum + (i.voice_score ?? 0) / arr.length : sum), 0
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <button onClick={() => router.push(`/projects/${projectId}/campaigns`)}
          className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <BarChart2 className="w-4 h-4 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{campaign?.name ?? '…'}</p>
          <p className="text-xs text-muted-foreground">Performance</p>
        </div>

        <div className="flex items-center gap-1">
          {([
            { label: 'Brief', path: 'brief' },
            { label: 'Assets', path: 'assets' },
            { label: 'Performance', path: 'performance' },
          ] as const).map((tab) => (
            <button key={tab.path}
              onClick={() => router.push(`/projects/${projectId}/campaigns/${campaignId}/${tab.path}`)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                tab.path === 'performance' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-border bg-card text-center">
                <p className="text-2xl font-bold">{libraryItems.length}</p>
                <p className="text-xs text-muted-foreground">Library items linked</p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card text-center">
                <p className="text-2xl font-bold text-green-500">{posted.length}</p>
                <p className="text-xs text-muted-foreground">Published</p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card text-center">
                <p className="text-2xl font-bold">{avgScore > 0 ? Math.round(avgScore) : '—'}</p>
                <p className="text-xs text-muted-foreground">Avg performance score</p>
              </div>
            </div>

            {/* Objective reminder */}
            {campaign?.brief?.objective && (
              <div className="p-4 rounded-xl border border-border bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Campaign Objective</p>
                <p className="text-sm">{campaign.brief.objective}</p>
                {campaign.brief.kpis?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {campaign.brief.kpis.map((kpi, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">{kpi}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Linked library items */}
            {libraryItems.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Published Content</p>
                {libraryItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full capitalize">{item.platform}</span>
                        <StatusBadge status={item.status} />
                        {item.voice_score != null && (
                          <span className="text-[10px] text-muted-foreground">Score: {item.voice_score}</span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/80 line-clamp-2">{item.content}</p>
                    </div>
                    {item.status === 'posted' && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    )}
                    {item.status === 'scheduled' && (
                      <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 space-y-3">
                <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No library items linked to this campaign yet.</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Save assets from the Assets tab to your library — they&apos;ll appear here with their performance data.
                </p>
                <button
                  onClick={() => router.push(`/projects/${projectId}/campaigns/${campaignId}/assets`)}
                  className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
                >
                  <ExternalLink className="w-3 h-3" /> Go to Assets
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
