'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Bell, RefreshCw, Loader2, CheckCheck, ExternalLink,
  TrendingUp, TrendingDown, Minus, Filter, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'
import { cn } from '@/lib/utils'
import type { MonitorAlert, MonitorChangeAlert, CompetitorMonitor } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertType = 'brand' | 'competitor'
type SentimentFilter = 'all' | 'positive' | 'negative' | 'neutral'

interface UnifiedAlert {
  id: string
  type: AlertType
  title: string
  snippet?: string
  url?: string
  source?: string
  subject?: string
  sentiment: 'positive' | 'negative' | 'neutral'
  isSignificant?: boolean
  read: boolean
  timestamp: string
  raw: MonitorAlert | MonitorChangeAlert
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function SentimentIcon({ s }: { s: UnifiedAlert['sentiment'] }) {
  if (s === 'positive') return <TrendingUp className="w-3 h-3 text-emerald-500" />
  if (s === 'negative') return <TrendingDown className="w-3 h-3 text-rose-500" />
  return <Minus className="w-3 h-3 text-muted-foreground" />
}

const SENTIMENT_STYLE: Record<UnifiedAlert['sentiment'], string> = {
  positive: 'bg-emerald-500/10 text-emerald-600',
  negative: 'bg-rose-500/10 text-rose-600',
  neutral: 'bg-muted text-muted-foreground',
}

function normaliseBrandAlert(a: MonitorAlert): UnifiedAlert {
  return {
    id: `brand-${a.id}`,
    type: 'brand',
    title: a.title,
    snippet: a.snippet,
    url: a.url,
    source: a.source,
    subject: a.subject,
    sentiment: a.sentiment,
    read: a.read,
    timestamp: a.publishedAt ?? a.savedAt,
    raw: a,
  }
}

function normaliseCompetitorAlert(a: MonitorChangeAlert, monitorName: string): UnifiedAlert {
  return {
    id: `competitor-${a.id}`,
    type: 'competitor',
    title: a.description,
    subject: monitorName,
    sentiment: a.type === 'new_ads_launched' || a.type === 'content_spike' ? 'negative' : 'neutral',
    isSignificant: a.is_significant,
    read: false,
    timestamp: a.created_at,
    raw: a,
  }
}

// ---------------------------------------------------------------------------
// Alert row
// ---------------------------------------------------------------------------

function AlertRow({
  alert,
  onMarkRead,
}: {
  alert: UnifiedAlert
  onMarkRead: (alert: UnifiedAlert) => void
}) {
  return (
    <div
      className={cn(
        'relative rounded-xl border transition-colors cursor-pointer',
        alert.read ? 'border-border bg-card' : 'border-primary/30 bg-primary/5',
      )}
      onClick={() => onMarkRead(alert)}
    >
      {!alert.read && (
        <span className="absolute top-3.5 left-3 w-1.5 h-1.5 rounded-full bg-primary" />
      )}

      <div className={cn('flex items-start gap-3 px-4 py-3', !alert.read && 'pl-6')}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {/* Type badge */}
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
              alert.type === 'brand' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600',
            )}>
              {alert.type === 'brand' ? 'Brand' : 'Competitor'}
            </span>

            {/* Subject */}
            {alert.subject && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {alert.subject}
              </span>
            )}

            {/* Sentiment */}
            <span className={cn('flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full', SENTIMENT_STYLE[alert.sentiment])}>
              <SentimentIcon s={alert.sentiment} />
              <span className="capitalize">{alert.sentiment}</span>
            </span>

            {/* Significant flag */}
            {alert.isSignificant && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                <AlertTriangle className="w-3 h-3" />Significant
              </span>
            )}

            {alert.source && (
              <span className="text-[10px] text-muted-foreground">{alert.source}</span>
            )}

            <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
              {timeAgo(alert.timestamp)}
            </span>
          </div>

          <p className="text-sm font-medium leading-snug mb-0.5">{alert.title}</p>

          {alert.snippet && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{alert.snippet}</p>
          )}
        </div>

        {alert.url && (
          <a
            href={alert.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AlertsPage() {
  const { projectId } = useParams<{ projectId: string }>()

  const [allAlerts, setAllAlerts] = useState<UnifiedAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | AlertType>('all')
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [days, setDays] = useState(14)

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Brand monitoring alerts
      const brandData = await api.monitoring.alerts(projectId, { days, limit: 200 })
      const brandAlerts = (brandData.alerts ?? []).map(normaliseBrandAlert)

      // 2. Competitor monitoring alerts (load monitors then their alerts)
      let competitorAlerts: UnifiedAlert[] = []
      try {
        const monitorsData = await api.deepResearch.listMonitors(projectId)
        const monitors: CompetitorMonitor[] = monitorsData.monitors ?? []
        const alertBatches = await Promise.allSettled(
          monitors.slice(0, 10).map((m) =>
            api.deepResearch.listAlerts(projectId, m.id).then((res) =>
              (res.alerts ?? []).map((a) => normaliseCompetitorAlert(a, m.competitor?.name ?? 'Competitor'))
            )
          )
        )
        competitorAlerts = alertBatches
          .filter((r): r is PromiseFulfilledResult<UnifiedAlert[]> => r.status === 'fulfilled')
          .flatMap((r) => r.value)
      } catch {
        // competitor alerts are best-effort
      }

      const combined = [...brandAlerts, ...competitorAlerts].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      setAllAlerts(combined)
    } catch {
      toast.error('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [projectId, days])

  useEffect(() => { loadAlerts() }, [loadAlerts])

  async function handleScan() {
    setScanning(true)
    let newCount = 0
    try {
      await new Promise<void>((resolve, reject) => {
        api.monitoring.run(
          projectId,
          (event) => { if (event.type === 'done') newCount = event.new_alerts ?? 0 },
          resolve,
        ).catch(reject)
      })
      toast.success(`Scan complete — ${newCount} new alert${newCount !== 1 ? 's' : ''}`)
      await loadAlerts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  async function handleMarkRead(alert: UnifiedAlert) {
    if (alert.read || alert.type !== 'brand') return
    try {
      const raw = alert.raw as { id: string }
      await api.monitoring.markRead(projectId, raw.id)
      setAllAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, read: true } : a))
    } catch { /* non-critical */ }
  }

  async function handleMarkAllRead() {
    const unread = allAlerts.filter((a) => !a.read && a.type === 'brand')
    await Promise.allSettled(
      unread.map((a) => {
        const raw = a.raw as { id: string }
        return api.monitoring.markRead(projectId, raw.id)
      })
    )
    setAllAlerts((prev) => prev.map((a) => a.type === 'brand' ? { ...a, read: true } : a))
    toast.success('All brand alerts marked as read')
  }

  // Derived
  const filtered = allAlerts.filter((a) => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false
    if (sentimentFilter !== 'all' && a.sentiment !== sentimentFilter) return false
    if (unreadOnly && a.read) return false
    return true
  })

  const stats = {
    total: allAlerts.length,
    unread: allAlerts.filter((a) => !a.read).length,
    negative: allAlerts.filter((a) => a.sentiment === 'negative').length,
    significant: allAlerts.filter((a) => a.isSignificant).length,
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-3 shrink-0">
        <SidebarToggle />
        <Bell className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <h1 className="font-semibold text-sm">Alerts</h1>
          <p className="text-xs text-muted-foreground">Brand mentions + competitor changes</p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {scanning ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…</> : <><RefreshCw className="w-3.5 h-3.5" /> Run Scan</>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl mx-auto w-full">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: '' },
            { label: 'Unread', value: stats.unread, color: stats.unread > 0 ? 'text-primary' : '' },
            { label: 'Negative', value: stats.negative, color: stats.negative > 0 ? 'text-rose-500' : '' },
            { label: 'Significant', value: stats.significant, color: stats.significant > 0 ? 'text-amber-500' : '' },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-xl border border-border bg-card text-center">
              <p className={cn('text-2xl font-bold tabular-nums', s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(['all', 'brand', 'competitor'] as const).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={cn('px-3 py-1.5 font-medium capitalize transition-colors',
                  typeFilter === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                {t}
              </button>
            ))}
          </div>

          {/* Sentiment */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(['all', 'negative', 'positive', 'neutral'] as const).map((s) => (
              <button key={s} onClick={() => setSentimentFilter(s)}
                className={cn('px-3 py-1.5 font-medium capitalize transition-colors',
                  sentimentFilter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                {s}
              </button>
            ))}
          </div>

          {/* Days */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={cn('px-2.5 py-1.5 transition-colors',
                  days === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                {d}d
              </button>
            ))}
          </div>

          {/* Unread toggle */}
          <button onClick={() => setUnreadOnly(!unreadOnly)}
            className={cn('flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors',
              unreadOnly ? 'border-primary text-primary bg-primary/5' : 'border-border text-muted-foreground hover:text-foreground')}>
            <Filter className="w-3 h-3" /> Unread only
          </button>

          {/* Mark all read */}
          {stats.unread > 0 && (
            <button onClick={handleMarkAllRead}
              className="flex items-center gap-1 ml-auto text-xs text-muted-foreground hover:text-foreground">
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>

        {/* Alert list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {allAlerts.length === 0 ? 'No alerts yet — run a scan to start monitoring.' : 'No alerts match your filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((alert) => (
              <AlertRow key={alert.id} alert={alert} onMarkRead={handleMarkRead} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
