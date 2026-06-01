'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Repeat2, Copy, Check, Loader2, BookmarkPlus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type Mode = 'variants' | 'transform'

const PLATFORMS = ['Instagram', 'LinkedIn', 'Twitter/X', 'Facebook', 'TikTok', 'Email', 'YouTube', 'Website']

const TRANSFORM_PLATFORMS = ['LinkedIn', 'Twitter/X', 'Instagram', 'Facebook', 'TikTok', 'Email']

const MODE_CONFIG: Record<Mode, { label: string; description: string }> = {
  variants: {
    label: 'Multiple Variants',
    description: 'Generate 3 different takes on the same content — different hooks, angles, and formats for the same platform.',
  },
  transform: {
    label: 'Cross-Platform',
    description: 'Transform one piece of content into optimised versions for every platform simultaneously.',
  },
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RepurposePage() {
  const { projectId } = useParams<{ projectId: string }>()

  const [mode, setMode] = useState<Mode>('variants')
  const [content, setContent] = useState('')
  const [platform, setPlatform] = useState('Instagram')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['LinkedIn', 'Twitter/X', 'Instagram'])
  const [loading, setLoading] = useState(false)

  // Results
  const [variants, setVariants] = useState<{ content: string; hashtags: string[]; angle: string; hook: string }[]>([])
  const [transformResults, setTransformResults] = useState<Record<string, { content: string; hashtags: string[]; notes: string }>>({})

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  async function handleGenerate() {
    if (!content.trim()) { toast.error('Paste content to repurpose'); return }
    if (mode === 'transform' && selectedPlatforms.length === 0) { toast.error('Select at least one platform'); return }

    setLoading(true)
    setVariants([])
    setTransformResults({})

    try {
      if (mode === 'variants') {
        const result = await api.contentOps.recycle(projectId, content.trim(), platform, 3)
        setVariants(result.variants)
      } else {
        const result = await api.contentOps.transform(projectId, content.trim(), selectedPlatforms)
        setTransformResults(result.results)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  async function saveVariantToLibrary(variantContent: string, hashtags: string[]) {
    try {
      await api.contentLibrary.save(projectId, {
        platform: platform as Parameters<typeof api.contentLibrary.save>[1]['platform'],
        type: 'ad_copy',
        content: variantContent,
        hashtags,
        metadata: { repurposedFrom: content.slice(0, 100), mode: 'variant' },
      })
      toast.success('Saved to library')
    } catch {
      toast.error('Failed to save')
    }
  }

  async function savePlatformToLibrary(plt: string, result: { content: string; hashtags: string[] }) {
    try {
      await api.contentLibrary.save(projectId, {
        platform: plt as Parameters<typeof api.contentLibrary.save>[1]['platform'],
        type: 'ad_copy',
        content: result.content,
        hashtags: result.hashtags ?? [],
        metadata: { repurposedFrom: content.slice(0, 100), mode: 'transform', targetPlatform: plt },
      })
      toast.success(`Saved to library for ${plt}`)
    } catch {
      toast.error('Failed to save')
    }
  }

  const hasResults = variants.length > 0 || Object.keys(transformResults).length > 0

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <div className="text-primary"><Repeat2 className="w-5 h-5" /></div>
        <div>
          <h1 className="font-semibold text-sm">Repurpose Content</h1>
          <p className="text-xs text-muted-foreground">Turn one piece into many — variants or cross-platform</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className={cn('mx-auto gap-6', hasResults ? 'max-w-5xl grid grid-cols-[400px_1fr]' : 'max-w-xl space-y-4')}>

          {/* Left: Input */}
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex rounded-xl border border-border overflow-hidden">
              {(Object.keys(MODE_CONFIG) as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={cn('flex-1 py-2.5 px-3 text-xs font-medium transition-colors',
                    mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                  {MODE_CONFIG[m].label}
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">{MODE_CONFIG[mode].description}</p>

            {/* Content input */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content to Repurpose *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder="Paste a blog excerpt, email, social post, video transcript, or any content you want to adapt…"
                className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{content.length} characters</p>
            </div>

            {/* Mode-specific options */}
            {mode === 'variants' ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Platform</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary">
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target Platforms *</label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TRANSFORM_PLATFORMS.map((p) => (
                    <button key={p} onClick={() => togglePlatform(p)}
                      className={cn('px-3 py-1.5 text-xs rounded-lg border transition-colors',
                        selectedPlatforms.includes(p) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50')}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || !content.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Sparkles className="w-4 h-4" /> {mode === 'variants' ? 'Generate 3 Variants' : `Transform to ${selectedPlatforms.length} Platform${selectedPlatforms.length !== 1 ? 's' : ''}`}</>
              }
            </button>
          </div>

          {/* Right: Results */}
          {hasResults && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {mode === 'variants' ? `${variants.length} Variants` : `${Object.keys(transformResults).length} Platforms`}
              </p>

              {/* Variants */}
              {mode === 'variants' && variants.map((v, i) => (
                <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
                    <span className="text-xs font-semibold">Variant {i + 1}</span>
                    {v.angle && (
                      <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full ml-auto">{v.angle}</span>
                    )}
                    <CopyBtn text={v.content} />
                    <button
                      onClick={() => saveVariantToLibrary(v.content, v.hashtags)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Save to library"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-2">
                    {v.hook && (
                      <p className="text-xs font-medium text-primary border-l-2 border-primary pl-2">{v.hook}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{v.content}</p>
                    {v.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {v.hashtags.map((h, j) => (
                          <span key={j} className="text-[10px] text-primary/70">#{h.replace(/^#/, '')}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Transform */}
              {mode === 'transform' && Object.entries(transformResults).map(([plt, result]) => (
                <div key={plt} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
                    <span className="text-xs font-semibold">{plt}</span>
                    {result.notes && (
                      <span className="text-[10px] text-muted-foreground ml-1 truncate flex-1">{result.notes}</span>
                    )}
                    <CopyBtn text={result.content} />
                    <button
                      onClick={() => savePlatformToLibrary(plt, result)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Save to library"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{result.content}</p>
                    {result.hashtags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {result.hashtags.map((h, j) => (
                          <span key={j} className="text-[10px] text-primary/70">#{h.replace(/^#/, '')}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
