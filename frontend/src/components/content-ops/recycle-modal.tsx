'use client'

import { useState } from 'react'
import { X, RotateCcw, Loader2, BookmarkPlus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { ContentLibraryItem } from '@/types'

interface RecycleModalProps {
  item: ContentLibraryItem
  projectId: string
  onClose: () => void
  onSaved: () => void
}

export function RecycleModal({ item, projectId, onClose, onSaved }: RecycleModalProps) {
  const [loading, setLoading] = useState(false)
  const [variants, setVariants] = useState<{ content: string; hashtags: string[]; angle: string; hook: string }[]>([])
  const [saving, setSaving] = useState<Set<number>>(new Set())
  const [saved, setSaved] = useState<Set<number>>(new Set())
  const [count, setCount] = useState(3)

  async function handleRecycle() {
    setLoading(true)
    setVariants([])
    try {
      const result = await api.contentOps.recycle(projectId, item.content, item.platform, count)
      setVariants(result.variants)
    } catch (err) {
      toast.error('Recycling failed. Try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveVariant(variant: typeof variants[0], idx: number) {
    setSaving((s) => new Set(s).add(idx))
    try {
      await api.contentLibrary.save(projectId, {
        platform: item.platform,
        type: item.type,
        content: variant.content,
        hashtags: variant.hashtags,
        metadata: { hook: variant.hook, angle: variant.angle, recycledFrom: item.id },
      })
      setSaved((s) => new Set(s).add(idx))
      toast.success('Saved to library')
      onSaved()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(idx); return n })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Content Recycler</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Original */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Original ({item.platform})</div>
            <div className="bg-muted/40 rounded-lg p-3 text-sm text-foreground/80 line-clamp-3">{item.content}</div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Variants to generate:</span>
              {[2, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${count === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={handleRecycle}
              disabled={loading}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              {loading ? 'Generating…' : 'Generate variants'}
            </button>
          </div>

          {/* Variants */}
          {variants.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Generated Variants</div>
              {variants.map((v, i) => (
                <div key={i} className="rounded-xl border border-border bg-background p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      {v.angle && (
                        <div className="text-[10px] font-medium text-primary uppercase tracking-wide">{v.angle}</div>
                      )}
                      <p className="text-sm leading-relaxed">{v.content}</p>
                      {v.hashtags.length > 0 && (
                        <p className="text-xs text-primary/70">{v.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleSaveVariant(v, i)}
                      disabled={saving.has(i) || saved.has(i)}
                      className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${saved.has(i) ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    >
                      {saving.has(i) ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkPlus className="w-3 h-3" />}
                      {saved.has(i) ? 'Saved' : 'Save'}
                    </button>
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
