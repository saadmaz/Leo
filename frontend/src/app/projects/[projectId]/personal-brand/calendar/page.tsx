'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Loader2, Calendar, Trash2, RefreshCw, XCircle, Clock, Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'
import { BackButton } from '@/components/layout/back-button'
import type { PublishedPost } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_COLORS: Record<string, string> = {
  linkedin:  'bg-blue-700',
  twitter:   'bg-neutral-700',
  instagram: 'bg-pink-600',
  facebook:  'bg-blue-600',
  tiktok:    'bg-neutral-900',
  youtube:   'bg-red-600',
  threads:   'bg-neutral-800',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function groupByDate(posts: PublishedPost[]): { date: string; posts: PublishedPost[] }[] {
  const map = new Map<string, PublishedPost[]>()
  for (const p of posts) {
    const key = p.scheduledAt
      ? new Date(p.scheduledAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
      : 'Published'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }
  return Array.from(map.entries()).map(([date, posts]) => ({ date, posts }))
}

// ---------------------------------------------------------------------------
// Post card
// ---------------------------------------------------------------------------

function PostCard({
  post,
  onCancel,
  cancelling,
}: {
  post: PublishedPost
  onCancel?: (id: string) => void
  cancelling: boolean
}) {
  const isPending = post.status === 'scheduled'

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Platforms + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {post.platforms.map((p) => (
            <span
              key={p}
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium text-white',
                PLATFORM_COLORS[p] ?? 'bg-muted',
              )}
            >
              {p}
            </span>
          ))}
        </div>
        <span className={cn(
          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
          post.status === 'published' ? 'bg-green-500/10 text-green-600' :
          post.status === 'scheduled' ? 'bg-amber-500/10 text-amber-600' :
          'bg-destructive/10 text-destructive',
        )}>
          {post.status}
        </span>
      </div>

      {/* Post text */}
      <p className="text-sm text-foreground line-clamp-4 whitespace-pre-wrap leading-relaxed">
        {post.post}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {isPending ? <Clock className="w-3 h-3" /> : <Send className="w-3 h-3" />}
          {isPending ? `Scheduled: ${formatDate(post.scheduledAt)}` : `Published: ${formatDate(post.scheduledAt ?? post.createdAt)}`}
        </span>
        {isPending && onCancel && post.ayrsharePostId && (
          <button
            onClick={() => onCancel(post.ayrsharePostId!)}
            disabled={cancelling}
            className="flex items-center gap-1 text-destructive hover:opacity-70 disabled:opacity-40 transition-opacity"
          >
            {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = 'scheduled' | 'history'

export default function CalendarPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId

  const [tab, setTab] = useState<Tab>('scheduled')
  const [scheduled, setScheduled] = useState<PublishedPost[]>([])
  const [history, setHistory] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [sched, hist] = await Promise.all([
        api.persona.listScheduled(projectId),
        api.persona.getPublishHistory(projectId),
      ])
      setScheduled(sched.posts ?? [])
      setHistory(hist.posts ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load posts')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function handleCancel(postId: string) {
    setCancelling(postId)
    try {
      await api.persona.cancelScheduled(projectId, postId)
      setScheduled((prev) => prev.filter((p) => p.ayrsharePostId !== postId))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not cancel post')
    } finally {
      setCancelling(null)
    }
  }

  const activeList = tab === 'scheduled' ? scheduled : history
  const groups = groupByDate(activeList)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <SidebarToggle />
        <BackButton />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-foreground leading-tight">Content Calendar</h1>
          <p className="text-xs text-muted-foreground">Scheduled and published posts</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); load() }}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-4">
        {([
          { value: 'scheduled' as Tab, label: 'Scheduled', count: scheduled.length },
          { value: 'history'   as Tab, label: 'History',   count: history.length },
        ] as const).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              tab === t.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === t.value ? <><Calendar className="w-3.5 h-3.5" /> {t.label}</> : t.label}
            {t.count > 0 && (
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                tab === t.value ? 'bg-white/20' : 'bg-muted-foreground/20',
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        ) : activeList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {tab === 'scheduled'
                ? 'No posts scheduled yet. Generate content and schedule it from the Content Engine.'
                : 'No published posts yet.'}
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.date}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {group.date}
              </h2>
              <div className="space-y-3">
                {group.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onCancel={tab === 'scheduled' ? handleCancel : undefined}
                    cancelling={cancelling === post.ayrsharePostId}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
