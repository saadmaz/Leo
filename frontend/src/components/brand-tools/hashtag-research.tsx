'use client'

import { useState } from 'react'
import { Hash, Loader2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { HashtagResult, HashtagTier } from '@/types'

const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'X']

const TIER_CONFIG: Record<keyof HashtagResult['tiers'], { label: string; color: string; desc: string }> = {
  mega:   { label: 'Mega',   color: 'text-red-500 bg-red-500/10 border-red-500/20',    desc: '10M+ posts' },
  large:  { label: 'Large',  color: 'text-orange-500 bg-orange-500/10 border-orange-500/20', desc: '500k–10M' },
  medium: { label: 'Medium', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',    desc: '50k–500k' },
  niche:  { label: 'Niche',  color: 'text-green-600 bg-green-500/10 border-green-500/20',    desc: '<50k posts' },
}

interface Props {
  projectId: string
  initialContent?: string
  initialPlatform?: string
}

export function HashtagResearch({ projectId, initialContent = '', initialPlatform = 'Instagram' }: Props) {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState(initialPlatform)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<HashtagResult | null>(null)
  const [expandedTier, setExpandedTier] = useState<string | null>('medium')
  const [copiedTier, setCopiedTier] = useState<string | null>(null)

  async function handleResearch() {
    if (!topic.trim()) {
      toast.error('Enter a topic to research hashtags for.')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const data = await api.hashtags.suggest(
        projectId,
        topic.trim(),
        platform,
        initialContent || undefined,
      )
      setResult(data)
      setExpandedTier('medium')
    } catch (err) {
      console.error(err)
      toast.error('Hashtag research failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function copyTier(tier: keyof HashtagResult['tiers']) {
    if (!result) return
    const tags = result.tiers[tier].map((t) => t.tag).join(' ')
    navigator.clipboard.writeText(tags)
    setCopiedTier(tier)
    toast.success(`${TIER_CONFIG[tier].label} hashtags copied!`)
    setTimeout(() => setCopiedTier(null), 2000)
  }

  function copyAll() {
    if (!result) return
    const all = (Object.keys(result.tiers) as (keyof HashtagResult['tiers'])[])
      .flatMap((tier) => result.tiers[tier].map((t) => t.tag))
      .join(' ')
    navigator.clipboard.writeText(all)
    toast.success('All hashtags copied!')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Input */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1.5">Topic / Content</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
            placeholder="e.g. sustainable fashion, morning routine, B2B sales tips"
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5">Platform</label>
          <div className="flex gap-1.5 flex-wrap">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                  platform === p
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleResearch}
          disabled={loading || !topic.trim()}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
          {loading ? 'Researching…' : 'Research Hashtags'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Strategy note */}
          {result.strategy && (
            <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs text-foreground/70">
              {result.strategy}
            </div>
          )}

          {/* Recommended mix */}
          {result.recommended_mix && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{result.recommended_mix}</span>
              <button
                onClick={copyAll}
                className="text-xs text-primary hover:opacity-80 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Copy all
              </button>
            </div>
          )}

          {/* Tier sections */}
          {(Object.keys(TIER_CONFIG) as (keyof HashtagResult['tiers'])[]).map((tier) => {
            const tags = result.tiers[tier] ?? []
            if (tags.length === 0) return null
            const config = TIER_CONFIG[tier]
            const isExpanded = expandedTier === tier

            return (
              <div key={tier} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedTier(isExpanded ? null : tier)}
                  className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', config.color)}>
                      {config.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{config.desc}</span>
                    <span className="text-xs text-muted-foreground">· {tags.length} tags</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); copyTier(tier) }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedTier === tier ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                    {tags.map((t: HashtagTier, i: number) => (
                      <button
                        key={i}
                        onClick={() => {
                          navigator.clipboard.writeText(t.tag)
                          toast.success('Copied!')
                        }}
                        title={`~${t.approx_posts} posts`}
                        className="group relative text-xs px-2 py-0.5 rounded-md bg-muted hover:bg-primary hover:text-primary-foreground border border-border transition-colors font-mono"
                      >
                        {t.tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
