'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  CalendarDays, ChevronLeft, ChevronRight, Loader2, Sparkles, X, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { SidebarToggle } from '@/components/layout/sidebar'
import { BackButton } from '@/components/layout/back-button'
import type { CalendarEntry } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0=Sun
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-muted text-muted-foreground',
  drafted: 'bg-blue-500/10 text-blue-600',
  approved: 'bg-green-500/10 text-green-600',
  scheduled: 'bg-amber-500/10 text-amber-600',
  posted: 'bg-purple-500/10 text-purple-600',
}

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: 'bg-pink-500',
  Facebook: 'bg-blue-600',
  TikTok: 'bg-slate-800',
  LinkedIn: 'bg-sky-700',
  X: 'bg-slate-700',
  Email: 'bg-orange-500',
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const params = useParams<{ projectId: string }>()
  const { activeProject } = useAppStore()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null)
  const [showGenerateForm, setShowGenerateForm] = useState(false)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = daysInMonth(year, month)
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
      const data = await api.calendar.get(params.projectId, start, end)
      setEntries(data.entries)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [params.projectId, year, month])

  useEffect(() => { loadEntries() }, [loadEntries])

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) } else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) } else setMonth((m) => m + 1)
  }

  const days = daysInMonth(year, month)
  const startDay = firstDayOfMonth(year, month)

  // Map date string → entries
  const entriesByDate: Record<string, CalendarEntry[]> = {}
  for (const e of entries) {
    if (!entriesByDate[e.date]) entriesByDate[e.date] = []
    entriesByDate[e.date].push(e)
  }

  async function handleStatusChange(entry: CalendarEntry, newStatus: string) {
    try {
      await api.calendar.updateEntry(params.projectId, entry.id, { status: newStatus })
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: newStatus } : e))
      setSelectedEntry((e) => e?.id === entry.id ? { ...e, status: newStatus } : e)
    } catch {
      toast.error('Failed to update status')
    }
  }

  async function handleDeleteEntry(entry: CalendarEntry) {
    try {
      await api.calendar.deleteEntry(params.projectId, entry.id)
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))
      setSelectedEntry(null)
      toast.success('Entry removed')
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <SidebarToggle />
        <BackButton />
        <CalendarDays className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Content Calendar</span>
        {activeProject && <span className="text-xs text-muted-foreground">— {activeProject.name}</span>}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowGenerateForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate month
          </button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-border bg-muted/20 shrink-0">
        <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold">{MONTH_NAMES[month]} {year}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-2 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-7 auto-rows-[minmax(80px,1fr)]">
            {/* Empty cells before month start */}
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`empty-${i}`} className="border-b border-r border-border bg-muted/10" />
            ))}
            {/* Day cells */}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEntries = entriesByDate[dateStr] ?? []
              const isToday =
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear()

              return (
                <div
                  key={day}
                  className={cn(
                    'border-b border-r border-border p-1.5 overflow-hidden',
                    (i + startDay) % 7 === 6 && 'border-r-0',
                    isToday && 'bg-primary/5',
                  )}
                >
                  <div className={cn(
                    'text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full',
                    isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                  )}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEntries.slice(0, 3).map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => setSelectedEntry(entry)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted transition-colors">
                          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', PLATFORM_COLORS[entry.platform] ?? 'bg-muted-foreground')} />
                          <span className="text-[10px] truncate leading-tight">{entry.content.slice(0, 30)}</span>
                        </div>
                      </button>
                    ))}
                    {dayEntries.length > 3 && (
                      <div className="text-[9px] text-muted-foreground pl-1">+{dayEntries.length - 3} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Entry detail panel */}
      {selectedEntry && (
        <EntryPanel
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onStatusChange={(s) => handleStatusChange(selectedEntry, s)}
          onDelete={() => handleDeleteEntry(selectedEntry)}
        />
      )}

      {/* Generate form */}
      {showGenerateForm && (
        <GenerateForm
          projectId={params.projectId}
          year={year}
          month={month}
          generating={generating}
          setGenerating={setGenerating}
          onClose={() => setShowGenerateForm(false)}
          onDone={() => { setShowGenerateForm(false); loadEntries() }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Entry detail panel
// ---------------------------------------------------------------------------

function EntryPanel({
  entry, onClose, onStatusChange, onDelete,
}: {
  entry: CalendarEntry
  onClose: () => void
  onStatusChange: (s: string) => void
  onDelete: () => void
}) {
  const statuses = ['planned', 'drafted', 'approved', 'scheduled', 'posted']

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-80 bg-card border-l border-border shadow-2xl z-40 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', PLATFORM_COLORS[entry.platform] ?? 'bg-muted-foreground')} />
          <span className="text-sm font-semibold">{entry.platform}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Date</div>
          <div className="text-sm">{new Date(entry.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>

        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Content</div>
          <p className="text-sm leading-relaxed">{entry.content}</p>
        </div>

        {entry.hashtags.length > 0 && (
          <div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Hashtags</div>
            <p className="text-xs text-primary/70">{entry.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}</p>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{entry.type}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{entry.content_format}</span>
        </div>

        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium capitalize transition-colors border',
                  entry.status === s ? STATUS_COLORS[s] + ' border-current/20' : 'bg-background border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {entry.status === s && <Check className="w-2.5 h-2.5" />}
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border">
        <button
          onClick={onDelete}
          className="w-full py-2 text-xs font-medium text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/5 transition-colors"
        >
          Remove from calendar
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generate form modal
// ---------------------------------------------------------------------------

function GenerateForm({
  projectId, year, month, generating, setGenerating, onClose, onDone,
}: {
  projectId: string
  year: number
  month: number
  generating: boolean
  setGenerating: (v: boolean) => void
  onClose: () => void
  onDone: () => void
}) {
  const [platforms, setPlatforms] = useState(['Instagram', 'Facebook'])
  const [postsPerWeek, setPostsPerWeek] = useState(3)
  const [themes, setThemes] = useState('')

  const PLATFORM_OPTIONS = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'X', 'Email']

  function toggle(p: string) {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  async function handleGenerate() {
    if (platforms.length === 0) { toast.error('Select at least one platform'); return }
    setGenerating(true)
    try {
      const period = `${MONTH_NAMES[month]} ${year}`
      await api.calendar.generate(projectId, {
        platforms,
        period,
        posts_per_week: postsPerWeek,
        goals: themes.trim() || undefined,
      })
      toast.success('Calendar generated!')
      onDone()
    } catch (err) {
      toast.error('Generation failed')
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Generate {MONTH_NAMES[month]} Calendar</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Platforms</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => toggle(p)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    platforms.includes(p) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Posts per week</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 5, 7].map((n) => (
                <button
                  key={n}
                  onClick={() => setPostsPerWeek(n)}
                  className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
                    postsPerWeek === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Goals / Themes <span className="normal-case font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              value={themes}
              onChange={(e) => setThemes(e.target.value)}
              placeholder="e.g. summer sale, product launch, tips & tricks"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Generating calendar…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
