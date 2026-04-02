'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  CalendarDays, ChevronLeft, ChevronRight, Loader2, Sparkles, X, Check,
  Plus, Clock, Pencil, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { SidebarToggle } from '@/components/layout/sidebar'
import { BackButton } from '@/components/layout/back-button'
import type { CalendarEntry } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'X', 'Email']

const CONTENT_TYPES = ['Post', 'Blog', 'Video', 'Carousel', 'Story', 'Reel']

const TYPE_FORMAT_MAP: Record<string, string> = {
  Post: 'post', Blog: 'post', Video: 'reel', Carousel: 'carousel', Story: 'story', Reel: 'reel',
}

const PLATFORM_DOT: Record<string, string> = {
  Instagram: 'bg-pink-500',
  Facebook:  'bg-blue-600',
  TikTok:    'bg-slate-700',
  LinkedIn:  'bg-sky-700',
  X:         'bg-slate-600',
  Email:     'bg-orange-500',
}

const PLATFORM_PILL: Record<string, string> = {
  Instagram: 'bg-pink-500/10 border-l-2 border-pink-500 text-pink-700 dark:text-pink-400',
  Facebook:  'bg-blue-600/10 border-l-2 border-blue-600 text-blue-700 dark:text-blue-400',
  TikTok:    'bg-slate-700/10 border-l-2 border-slate-600 text-slate-700 dark:text-slate-300',
  LinkedIn:  'bg-sky-700/10 border-l-2 border-sky-700 text-sky-700 dark:text-sky-400',
  X:         'bg-slate-600/10 border-l-2 border-slate-500 text-slate-600 dark:text-slate-400',
  Email:     'bg-orange-500/10 border-l-2 border-orange-500 text-orange-700 dark:text-orange-400',
}

const PLATFORM_BADGE: Record<string, string> = {
  Instagram: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  Facebook:  'bg-blue-600/15 text-blue-700 dark:text-blue-300',
  TikTok:    'bg-slate-700/15 text-slate-700 dark:text-slate-300',
  LinkedIn:  'bg-sky-700/15 text-sky-700 dark:text-sky-300',
  X:         'bg-slate-600/15 text-slate-600 dark:text-slate-300',
  Email:     'bg-orange-500/15 text-orange-700 dark:text-orange-300',
}

const STATUS_DOT: Record<string, string> = {
  planned:   'bg-muted-foreground/40',
  drafted:   'bg-blue-500',
  approved:  'bg-green-500',
  scheduled: 'bg-amber-500',
  posted:    'bg-purple-500',
}

const STATUS_PILL: Record<string, string> = {
  planned:   'bg-muted text-muted-foreground',
  drafted:   'bg-blue-500/10 text-blue-600',
  approved:  'bg-green-500/10 text-green-600',
  scheduled: 'bg-amber-500/10 text-amber-600',
  posted:    'bg-purple-500/10 text-purple-600',
}

const PLATFORM_ABBR: Record<string, string> = {
  Instagram: 'IG', Facebook: 'FB', TikTok: 'TT', LinkedIn: 'LI', X: 'X', Email: 'EM',
}

const STATUSES = ['planned', 'drafted', 'approved', 'scheduled', 'posted']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function parseHashtags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, '').trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const params = useParams<{ projectId: string }>()
  const { activeProject, calendarCache, setCalendarCache, invalidateCalendarCache } = useAppStore()

  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [entries, setEntries]             = useState<CalendarEntry[]>([])
  const [loading, setLoading]             = useState(true)
  const [generating, setGenerating]       = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null)
  const [showGenerateForm, setShowGenerateForm] = useState(false)
  // "Add entry" modal — null = closed, string = pre-filled date
  const [addDate, setAddDate] = useState<string | null>(null)
  // Overflow popover
  const [overflowDay, setOverflowDay] = useState<string | null>(null)

  const cacheKey = `${params.projectId}-${year}-${String(month + 1).padStart(2, '0')}`

  const loadEntries = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const start   = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = daysInMonth(year, month)
      const end     = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
      const data    = await api.calendar.get(params.projectId, start, end)
      setEntries(data.entries)
      setCalendarCache(cacheKey, data.entries)
    } catch (err) {
      console.error(err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [params.projectId, year, month, cacheKey, setCalendarCache])

  useEffect(() => {
    const cached = calendarCache[cacheKey]
    if (cached) {
      setEntries(cached)
      setLoading(false)
      loadEntries(true)
    } else {
      loadEntries(false)
    }
    setSelectedEntry(null)
    setOverflowDay(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) } else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) } else setMonth((m) => m + 1)
  }

  const days     = daysInMonth(year, month)
  const startDay = firstDayOfMonth(year, month)

  const entriesByDate: Record<string, CalendarEntry[]> = {}
  for (const e of entries) {
    if (!entriesByDate[e.date]) entriesByDate[e.date] = []
    entriesByDate[e.date].push(e)
  }

  const presentPlatforms = Array.from(new Set(entries.map((e) => e.platform))).filter(
    (p) => PLATFORM_DOT[p],
  )

  // ---- handlers ----

  function handleEntryAdded(entry: CalendarEntry) {
    setEntries((prev) => {
      const next = [...prev, entry].sort((a, b) => a.date.localeCompare(b.date))
      setCalendarCache(cacheKey, next)
      return next
    })
    setAddDate(null)
  }

  async function handleStatusChange(entry: CalendarEntry, newStatus: string) {
    try {
      await api.calendar.updateEntry(params.projectId, entry.id, { status: newStatus })
      setEntries((prev) => {
        const next = prev.map((e) => e.id === entry.id ? { ...e, status: newStatus } : e)
        setCalendarCache(cacheKey, next)
        return next
      })
      setSelectedEntry((e) => e?.id === entry.id ? { ...e, status: newStatus } : e)
    } catch {
      toast.error('Failed to update status')
    }
  }

  async function handleContentSave(entry: CalendarEntry, content: string, hashtags: string[]) {
    try {
      await api.calendar.updateEntry(params.projectId, entry.id, { content })
      setEntries((prev) => {
        const next = prev.map((e) => e.id === entry.id ? { ...e, content, hashtags } : e)
        setCalendarCache(cacheKey, next)
        return next
      })
      setSelectedEntry((e) => e?.id === entry.id ? { ...e, content, hashtags } : e)
    } catch {
      toast.error('Failed to save')
    }
  }

  async function handleDeleteEntry(entry: CalendarEntry) {
    try {
      await api.calendar.deleteEntry(params.projectId, entry.id)
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== entry.id)
        setCalendarCache(cacheKey, next)
        return next
      })
      setSelectedEntry(null)
      toast.success('Entry removed')
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden" onClick={() => setOverflowDay(null)}>
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

      {/* Platform legend */}
      {presentPlatforms.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background shrink-0 flex-wrap">
          {presentPlatforms.map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', PLATFORM_DOT[p])} />
              <span className="text-[11px] text-muted-foreground">{p}</span>
            </div>
          ))}
        </div>
      )}

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
        <div className="grid grid-cols-7 auto-rows-[minmax(100px,1fr)]">
          {/* Skeleton or real cells */}
          {loading ? (
            // Skeleton grid — shows layout immediately
            Array.from({ length: 35 }).map((_, i) => (
              <div key={`sk-${i}`} className={cn('border-b border-r border-border p-1.5', i % 7 === 6 && 'border-r-0')}>
                <div className="w-5 h-5 rounded-full bg-muted animate-pulse mb-1" />
                <div className="space-y-1">
                  <div className="h-4 rounded bg-muted animate-pulse w-full" />
                  <div className="h-4 rounded bg-muted animate-pulse w-3/4" />
                </div>
              </div>
            ))
          ) : (
            <>
              {/* Empty cells before month start */}
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} className="border-b border-r border-border bg-muted/10" />
              ))}

              {/* Day cells */}
              {Array.from({ length: days }).map((_, i) => {
                const day      = i + 1
                const dateStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayEntries = entriesByDate[dateStr] ?? []
                const isToday  = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                const isLast   = (i + startDay) % 7 === 6
                const hasSelected = selectedEntry && dayEntries.some((e) => e.id === selectedEntry.id)
                const isOverflow = overflowDay === dateStr

                return (
                  <div
                    key={day}
                    className={cn(
                      'group border-b border-r border-border p-1.5 overflow-visible relative',
                      isLast && 'border-r-0',
                      isToday && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
                      hasSelected && 'ring-2 ring-inset ring-primary',
                    )}
                  >
                    {/* Date number + add button */}
                    <div className="flex items-center justify-between mb-1">
                      <div className={cn(
                        'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full',
                        isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                      )}>
                        {day}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setAddDate(dateStr) }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all text-muted-foreground hover:text-foreground"
                        title="Add entry"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Entry chips */}
                    <div className="space-y-0.5">
                      {dayEntries.slice(0, 3).map((entry) => (
                        <EntryChip
                          key={entry.id}
                          entry={entry}
                          onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry) }}
                        />
                      ))}
                      {dayEntries.length > 3 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setOverflowDay(isOverflow ? null : dateStr) }}
                          className="text-[9px] text-primary/70 hover:text-primary pl-1 font-medium transition-colors"
                        >
                          +{dayEntries.length - 3} more
                        </button>
                      )}
                    </div>

                    {/* Overflow popover */}
                    {isOverflow && (
                      <OverflowPopover
                        entries={dayEntries}
                        onSelect={(entry) => { setSelectedEntry(entry); setOverflowDay(null) }}
                        onClose={() => setOverflowDay(null)}
                      />
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Entry detail modal */}
      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onStatusChange={(s) => handleStatusChange(selectedEntry, s)}
          onSaveContent={(content, hashtags) => handleContentSave(selectedEntry, content, hashtags)}
          onDelete={() => handleDeleteEntry(selectedEntry)}
        />
      )}

      {/* Add entry modal */}
      {addDate !== null && (
        <AddEntryModal
          projectId={params.projectId}
          defaultDate={addDate}
          onClose={() => setAddDate(null)}
          onCreated={handleEntryAdded}
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
          onDone={() => {
            setShowGenerateForm(false)
            invalidateCalendarCache(cacheKey)
            loadEntries(false)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Entry chip (day cell pill)
// ---------------------------------------------------------------------------

function EntryChip({ entry, onClick }: { entry: CalendarEntry; onClick: (e: React.MouseEvent) => void }) {
  const pillClass = PLATFORM_PILL[entry.platform] ?? 'bg-muted border-l-2 border-muted-foreground text-muted-foreground'
  const abbr      = PLATFORM_ABBR[entry.platform] ?? entry.platform.slice(0, 2).toUpperCase()
  const dotClass  = STATUS_DOT[entry.status] ?? 'bg-muted-foreground/40'

  return (
    <button onClick={onClick} className="w-full text-left">
      <div className={cn('flex items-center gap-1 rounded-sm px-1 py-0.5 hover:brightness-95 transition-all', pillClass)}>
        <span className="text-[9px] font-bold shrink-0 opacity-70">{abbr}</span>
        <span className="text-[10px] truncate leading-tight flex-1">{entry.content.slice(0, 28)}</span>
        <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClass)} />
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Overflow popover
// ---------------------------------------------------------------------------

function OverflowPopover({ entries, onSelect, onClose }: {
  entries: CalendarEntry[]
  onSelect: (entry: CalendarEntry) => void
  onClose: () => void
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute top-0 left-full z-30 ml-1 w-56 bg-card border border-border rounded-lg shadow-xl p-2 space-y-1"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">All entries</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>
      {entries.map((entry) => (
        <EntryChip key={entry.id} entry={entry} onClick={() => onSelect(entry)} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Entry detail modal
// ---------------------------------------------------------------------------

function EntryDetailModal({ entry, onClose, onStatusChange, onSaveContent, onDelete }: {
  entry: CalendarEntry
  onClose: () => void
  onStatusChange: (s: string) => void
  onSaveContent: (content: string, hashtags: string[]) => Promise<void>
  onDelete: () => void
}) {
  const [editing, setEditing]       = useState(false)
  const [editContent, setEditContent] = useState(entry.content)
  const [editTags, setEditTags]       = useState(entry.hashtags.join(' '))
  const [saving, setSaving]           = useState(false)

  async function save() {
    setSaving(true)
    try {
      await onSaveContent(editContent, parseHashtags(editTags))
      setEditing(false)
      toast.success('Saved')
    } finally {
      setSaving(false)
    }
  }

  const badgeClass = PLATFORM_BADGE[entry.platform] ?? 'bg-muted text-muted-foreground'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className={cn('w-2.5 h-2.5 rounded-full', PLATFORM_DOT[entry.platform] ?? 'bg-muted-foreground')} />
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', badgeClass)}>{entry.platform}</span>
            <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            {entry.time && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                <Clock className="w-3 h-3" />
                {entry.time}
              </div>
            )}
            {entry.type && (
              <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground capitalize">{entry.type}</span>
            )}
            {entry.content_format && entry.content_format !== entry.type && (
              <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground capitalize">{entry.content_format}</span>
            )}
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Content</span>
              {!editing && (
                <button
                  onClick={() => { setEditContent(entry.content); setEditTags(entry.hashtags.join(' ')); setEditing(true) }}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
            {editing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</p>
            )}
          </div>

          {/* Hashtags */}
          <div>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Hashtags</span>
            {editing ? (
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="summer sale launch tips"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            ) : entry.hashtags.length > 0 ? (
              <p className="text-sm text-primary/70 leading-relaxed">
                {entry.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">No hashtags</p>
            )}
          </div>

          {/* Status */}
          <div>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium capitalize transition-colors border',
                    entry.status === s
                      ? STATUS_PILL[s] + ' border-current/20'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {entry.status === s && <Check className="w-2.5 h-2.5" />}
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save changes
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove from calendar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Entry modal
// ---------------------------------------------------------------------------

function AddEntryModal({ projectId, defaultDate, onClose, onCreated }: {
  projectId: string
  defaultDate: string
  onClose: () => void
  onCreated: (entry: CalendarEntry) => void
}) {
  const [platform, setPlatform]       = useState('Instagram')
  const [contentType, setContentType] = useState('Post')
  const [date, setDate]               = useState(defaultDate)
  const [time, setTime]               = useState('')
  const [content, setContent]         = useState('')
  const [hashtags, setHashtags]       = useState('')
  const [status, setStatus]           = useState('planned')
  const [saving, setSaving]           = useState(false)

  async function handleSubmit() {
    if (!content.trim()) { toast.error('Content is required'); return }
    setSaving(true)
    try {
      const entry = await api.calendar.createEntry(projectId, {
        date,
        platform,
        content: content.trim(),
        time: time.trim() || undefined,
        hashtags: parseHashtags(hashtags),
        type: contentType.toLowerCase(),
        content_format: TYPE_FORMAT_MAP[contentType] ?? 'post',
        status,
      })
      toast.success('Entry added to calendar')
      onCreated(entry)
    } catch (err) {
      toast.error('Failed to add entry')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Add to Calendar</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Platform */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Platform</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    platform === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {platform === p && <div className={cn('w-1.5 h-1.5 rounded-full', PLATFORM_DOT[p])} />}
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Content type */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Content type</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setContentType(t)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    contentType === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Time <span className="font-normal normal-case">(optional)</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Write your post, blog excerpt, video script..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Hashtags */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Hashtags <span className="font-normal normal-case">(optional, space-separated)</span>
            </label>
            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="marketing socialmedia launch"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[10px] font-medium capitalize border transition-colors',
                    status === s
                      ? STATUS_PILL[s] + ' border-current/20'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={handleSubmit}
            disabled={saving || !content.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Adding…' : 'Add to calendar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generate form modal
// ---------------------------------------------------------------------------

function GenerateForm({ projectId, year, month, generating, setGenerating, onClose, onDone }: {
  projectId: string
  year: number
  month: number
  generating: boolean
  setGenerating: (v: boolean) => void
  onClose: () => void
  onDone: () => void
}) {
  const [platforms, setPlatforms]       = useState(['Instagram', 'Facebook'])
  const [postsPerWeek, setPostsPerWeek] = useState(3)
  const [themes, setThemes]             = useState('')

  function toggle(p: string) {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  async function handleGenerate() {
    if (platforms.length === 0) { toast.error('Select at least one platform'); return }
    setGenerating(true)
    try {
      await api.calendar.generate(projectId, {
        platforms,
        period: `${MONTH_NAMES[month]} ${year}`,
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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Platforms</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => toggle(p)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    platforms.includes(p) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {platforms.includes(p) && <div className={cn('w-1.5 h-1.5 rounded-full', PLATFORM_DOT[p])} />}
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Posts per week</label>
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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
