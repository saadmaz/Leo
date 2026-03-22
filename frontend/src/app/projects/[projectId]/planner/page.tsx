'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import {
  CalendarRange, Loader2, Sparkles, Check, ChevronDown, ChevronUp, Library,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { SidebarToggle } from '@/components/layout/sidebar'
import { BackButton } from '@/components/layout/back-button'
import type { ContentPlanItem } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DURATIONS = [
  { value: '1_week',  label: '1 Week',   posts: 5 },
  { value: '2_weeks', label: '2 Weeks',  posts: 10 },
  { value: '1_month', label: '1 Month',  posts: 20 },
]

const ALL_PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'X', 'Email']

const TYPE_COLORS: Record<string, string> = {
  caption:       'bg-pink-500/10 text-pink-600',
  video_script:  'bg-purple-500/10 text-purple-600',
  ad_copy:       'bg-amber-500/10 text-amber-600',
  email:         'bg-blue-500/10 text-blue-600',
  image_prompt:  'bg-green-500/10 text-green-600',
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlannerPage() {
  const params = useParams<{ projectId: string }>()
  const { activeProject } = useAppStore()

  const [duration, setDuration] = useState('2_weeks')
  const [platforms, setPlatforms] = useState<string[]>(['Instagram', 'LinkedIn'])
  const [goal, setGoal] = useState('')
  const [postsPerWeek, setPostsPerWeek] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [plan, setPlan] = useState<ContentPlanItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [applying, setApplying] = useState(false)

  function togglePlatform(p: string) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  }

  function toggleSelect(idx: number) {
    setSelectedIds((prev) => {
      const s = new Set(prev)
      if (s.has(idx)) { s.delete(idx) } else { s.add(idx) }
      return s
    })
  }

  function selectAll() {
    if (selectedIds.size === plan.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(plan.map((_, i) => i)))
    }
  }

  async function handleGenerate() {
    if (platforms.length === 0) { toast.error('Select at least one platform'); return }
    setGenerating(true)
    setPlan([])
    setSelectedIds(new Set())
    try {
      const data = await api.planner.generate(params.projectId, {
        duration,
        platforms,
        goal: goal.trim(),
        postsPerWeek,
      })
      setPlan(data.items)
      setSelectedIds(new Set(data.items.map((_, i) => i)))
      toast.success(`${data.count} posts planned`)
    } catch {
      toast.error('Failed to generate plan')
    } finally {
      setGenerating(false)
    }
  }

  async function handleApply() {
    const selected = plan.filter((_, i) => selectedIds.has(i))
    if (selected.length === 0) { toast.error('Select at least one post'); return }
    setApplying(true)
    try {
      const data = await api.planner.apply(params.projectId, selected)
      toast.success(`${data.saved} posts added to Content Library`)
      setSelectedIds(new Set())
    } catch {
      toast.error('Failed to apply plan')
    } finally {
      setApplying(false)
    }
  }

  // Group by date
  const grouped = plan.reduce<Record<string, { item: ContentPlanItem; idx: number }[]>>((acc, item, idx) => {
    const key = item.date
    if (!acc[key]) acc[key] = []
    acc[key].push({ item, idx })
    return acc
  }, {})

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <SidebarToggle />
        <BackButton />
        <CalendarRange className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">AI Content Planner</span>
        {activeProject && <span className="text-xs text-muted-foreground">— {activeProject.name}</span>}
        {plan.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selectedIds.size}/{plan.length} selected</span>
            <button
              onClick={handleApply}
              disabled={applying || selectedIds.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Library className="w-3.5 h-3.5" />}
              Add to Library
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Config panel */}
        <div className="border-b border-border bg-muted/20 px-4 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Duration */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Duration</label>
                <div className="flex flex-col gap-1">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => { setDuration(d.value); setPostsPerWeek(Math.round(d.posts / (d.value === '1_month' ? 4 : d.value === '2_weeks' ? 2 : 1))) }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg border text-xs text-left transition-colors',
                        duration === d.value ? 'border-primary bg-primary/5 text-foreground font-medium' : 'border-border bg-background text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Platforms */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Platforms</label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_PLATFORMS.map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-xs transition-colors',
                        platforms.includes(p) ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="mt-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Posts per week</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min={2} max={14} value={postsPerWeek}
                      onChange={(e) => setPostsPerWeek(Number(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-xs font-semibold w-4 text-center">{postsPerWeek}</span>
                  </div>
                </div>
              </div>

              {/* Goal */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Campaign Goal <span className="font-normal">(optional)</span></label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Launch new product, Drive holiday sales, Build brand awareness…"
                  rows={4}
                  className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating || platforms.length === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'Planning…' : 'Generate Content Plan'}
              </button>
              {plan.length > 0 && (
                <button onClick={selectAll} className="text-xs text-primary hover:opacity-80">
                  {selectedIds.size === plan.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Plan results */}
        <div className="p-4">
          {generating ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">AI is crafting your content plan…</p>
            </div>
          ) : plan.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <CalendarRange className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h2 className="text-lg font-semibold mb-2">No plan yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Configure your settings above and click <strong>Generate Content Plan</strong> to get an AI-crafted posting schedule.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {Object.entries(grouped).map(([date, entries]) => (
                <div key={date}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  <div className="space-y-2">
                    {entries.map(({ item, idx }) => (
                      <PlanCard
                        key={idx}
                        item={item}
                        selected={selectedIds.has(idx)}
                        onToggle={() => toggleSelect(idx)}
                      />
                    ))}
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

// ---------------------------------------------------------------------------
// PlanCard
// ---------------------------------------------------------------------------

function PlanCard({ item, selected, onToggle }: {
  item: ContentPlanItem
  selected: boolean
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const typeStyle = TYPE_COLORS[item.contentType] ?? 'bg-muted text-muted-foreground'

  return (
    <div className={cn(
      'rounded-xl border bg-card overflow-hidden transition-all',
      selected ? 'border-primary ring-1 ring-primary/20' : 'border-border',
    )}>
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={cn(
            'mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
            selected ? 'bg-primary border-primary' : 'border-border',
          )}
        >
          {selected && <Check className="w-2.5 h-2.5 text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', typeStyle)}>
              {item.contentType.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{item.platform}</span>
            {item.postingTime && (
              <span className="text-[10px] text-muted-foreground">{item.postingTime}</span>
            )}
          </div>
          <p className="text-sm font-medium mt-1">{item.topic}</p>
          {item.contentAngle && (
            <p className="text-xs text-muted-foreground mt-0.5 italic">{item.contentAngle}</p>
          )}
        </div>

        <button onClick={() => setExpanded(!expanded)} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-border/50 pt-2 space-y-2">
          <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{item.suggestedContent}</p>
          {item.hashtags?.length > 0 && (
            <p className="text-xs text-primary/70">
              {item.hashtags.slice(0, 8).map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
