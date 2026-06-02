'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft, Layers, Loader2, Copy, Check,
  BookmarkPlus, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'
import { cn } from '@/lib/utils'
import type { Campaign } from '@/types'

// ---------------------------------------------------------------------------
// Channel labels
// ---------------------------------------------------------------------------

const CHANNEL_LABELS: Record<string, string> = {
  instagram: 'Instagram', linkedin: 'LinkedIn', twitter: 'X / Twitter',
  tiktok: 'TikTok', meta_ads: 'Meta Ads', google_ads: 'Google Ads', email: 'Email',
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Channel panel
// ---------------------------------------------------------------------------

function ChannelPanel({
  channel, pack, onSave,
}: {
  channel: string
  pack: { captions?: { text: string; hashtags: string[] }[]; adCopy?: { headline: string; body: string; cta?: string }[] }
  projectId: string
  onSave: (platform: string, content: string, hashtags: string[]) => Promise<void>
}) {
  const [open, setOpen] = useState(true)
  const label = CHANNEL_LABELS[channel] ?? channel

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <span className="text-sm font-semibold">{label}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {((pack.captions?.length ?? 0) + (pack.adCopy?.length ?? 0))} pieces
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border">
          {pack.captions?.map((cap, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Caption {i + 1}</span>
                <div className="flex items-center gap-1">
                  <CopyBtn text={cap.text} />
                  <button
                    onClick={() => onSave(label, cap.text, cap.hashtags)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Save to library"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{cap.text}</p>
              {cap.hashtags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cap.hashtags.map((h, j) => (
                    <span key={j} className="text-[10px] text-primary/70">#{h.replace(/^#/, '')}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {pack.adCopy?.map((ad, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Ad Variant {i + 1}</span>
                <CopyBtn text={`${ad.headline}\n\n${ad.body}${ad.cta ? `\n\nCTA: ${ad.cta}` : ''}`} />
              </div>
              <p className="text-sm font-semibold">{ad.headline}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{ad.body}</p>
              {ad.cta && (
                <span className="inline-block text-xs px-3 py-1 bg-primary/10 text-primary rounded-full">{ad.cta}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CampaignAssetsPage() {
  const { projectId, campaignId } = useParams<{ projectId: string; campaignId: string }>()
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.campaigns.get(projectId, campaignId)
      .then(setCampaign)
      .catch(() => toast.error('Failed to load campaign'))
      .finally(() => setLoading(false))
  }, [projectId, campaignId])

  async function saveToLibrary(platform: string, content: string, hashtags: string[]) {
    try {
      await api.contentLibrary.save(projectId, {
        platform: platform as Parameters<typeof api.contentLibrary.save>[1]['platform'],
        type: 'ad_copy',
        content,
        hashtags,
        metadata: { campaign_id: campaignId, campaign_name: campaign?.name },
      })
      toast.success(`Saved to library`)
    } catch {
      toast.error('Failed to save to library')
    }
  }

  const packs = campaign?.contentPacks ?? {}
  const channelsWithContent = Object.entries(packs).filter(
    ([, pack]) => (pack?.captions?.length ?? 0) > 0 || (pack?.adCopy?.length ?? 0) > 0
  )
  const totalPieces = channelsWithContent.reduce(
    (sum, [, pack]) => sum + (pack?.captions?.length ?? 0) + (pack?.adCopy?.length ?? 0), 0
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <button onClick={() => router.push(`/projects/${projectId}/campaigns`)}
          className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Layers className="w-4 h-4 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{campaign?.name ?? '…'}</p>
          <p className="text-xs text-muted-foreground">{totalPieces} content pieces across {channelsWithContent.length} channels</p>
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
                tab.path === 'assets' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
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
        ) : channelsWithContent.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Layers className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No content generated yet.</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {channelsWithContent.map(([ch, pack]) => (
              <ChannelPanel
                key={ch}
                channel={ch}
                pack={pack}
                projectId={projectId}
                onSave={saveToLibrary}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
