'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Minus, PlusCircle, RefreshCw,
  Loader2, ExternalLink, CheckCircle, AlertCircle, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, type BlogRankRecord, type BlogRankSnapshot } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function latestSnapshot(record: BlogRankRecord): BlogRankSnapshot | null {
  const valid = record.snapshots.filter((s) => s.position !== null)
  if (valid.length === 0) return null
  return valid.sort((a, b) => b.date.localeCompare(a.date))[0]
}

function positionBand(position: number | null): 'top3' | 'page1' | 'page2' | 'beyond' | 'unranked' {
  if (position === null) return 'unranked'
  if (position <= 3) return 'top3'
  if (position <= 10) return 'page1'
  if (position <= 20) return 'page2'
  return 'beyond'
}

const BAND_CONFIG = {
  top3:    { label: 'Top 3',   color: 'text-green-600',     bg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' },
  page1:   { label: 'Page 1',  color: 'text-blue-600',      bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' },
  page2:   { label: 'Page 2',  color: 'text-amber-600',     bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' },
  beyond:  { label: 'Page 3+', color: 'text-muted-foreground', bg: 'bg-muted border-border' },
  unranked:{ label: 'No data', color: 'text-muted-foreground', bg: 'bg-muted/50 border-border' },
}

function PositionBadge({ position }: { position: number | null }) {
  if (position === null) return <span className="text-xs text-muted-foreground">—</span>
  const band = positionBand(position)
  const { color } = BAND_CONFIG[band]
  return <span className={cn('text-xl font-bold tabular-nums', color)}>#{position}</span>
}

function WeeklyMovement({ snapshots }: { snapshots: BlogRankSnapshot[] }) {
  const sorted = snapshots.filter((s) => s.position !== null).sort((a, b) => b.date.localeCompare(a.date))
  if (sorted.length < 2) return null
  const diff = (sorted[1].position as number) - (sorted[0].position as number)
  if (diff === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" /> 0</span>
  if (diff > 0) return <span className="text-xs text-green-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +{diff}</span>
  return <span className="text-xs text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> {diff}</span>
}

function MiniSparkline({ snapshots }: { snapshots: BlogRankSnapshot[] }) {
  const valid = snapshots.filter((s) => s.position !== null).sort((a, b) => a.date.localeCompare(b.date)).slice(-8)
  if (valid.length < 2) return null
  const positions = valid.map((s) => s.position as number)
  const maxP = Math.max(...positions)
  const minP = Math.min(...positions)
  const range = maxP - minP || 1
  const W = 80; const H = 24
  const pts = positions.map((p, i) => `${(i / (positions.length - 1)) * W},${((p - minP) / range) * H}`).join(' ')
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-primary" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Band column
// ---------------------------------------------------------------------------

function BandColumn({ band, records }: { band: keyof typeof BAND_CONFIG; records: BlogRankRecord[] }) {
  const config = BAND_CONFIG[band]
  const filtered = records.filter((r) => positionBand(latestSnapshot(r)?.position ?? null) === band)
  return (
    <div className={cn('rounded-xl border p-3 space-y-2', config.bg)}>
      <div className="flex items-center justify-between">
        <p className={cn('text-xs font-semibold', config.color)}>{config.label}</p>
        <span className="text-xs text-muted-foreground">{filtered.length}</span>
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">None</p>
      ) : (
        filtered.map((r) => {
          const snap = latestSnapshot(r)
          return (
            <div key={r.id} className="bg-card rounded-lg border border-border p-2.5 space-y-1">
              <a href={r.post_url} target="_blank" rel="noreferrer"
                className="text-xs font-medium hover:text-primary flex items-center gap-1 truncate">
                <span className="truncate">{r.post_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
              <p className="text-[10px] text-muted-foreground truncate">{r.target_keyword}</p>
              <div className="flex items-center justify-between">
                <PositionBadge position={snap?.position ?? null} />
                <div className="flex items-center gap-2">
                  <WeeklyMovement snapshots={r.snapshots} />
                  <MiniSparkline snapshots={r.snapshots} />
                </div>
              </div>
              {snap?.clicks !== null && snap?.clicks !== undefined && (
                <p className="text-[10px] text-muted-foreground">{snap.clicks} clicks · {snap.impressions} impressions</p>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RankTrackerPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [records, setRecords] = useState<BlogRankRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [gscStatus, setGscStatus] = useState<{ connected: boolean; properties?: string[] } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [trackUrl, setTrackUrl] = useState('')
  const [trackKeyword, setTrackKeyword] = useState('')
  const [snapshotting, setSnapshotting] = useState<string | null>(null)

  useEffect(() => {
    const gscConnected = searchParams.get('gsc_connected')
    if (gscConnected) {
      toast.success('Google Search Console connected!')
      router.replace(`/projects/${projectId}/search/rank-tracker`)
    }

    Promise.all([
      api.blog.listRankHistory(projectId),
      api.blog.getGSCStatus(projectId),
    ]).then(([rankRes, gscRes]) => {
      setRecords(rankRes.records)
      setGscStatus(gscRes)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [projectId, searchParams, router])

  async function handleAdd() {
    if (!trackUrl.trim() || !trackKeyword.trim()) { toast.error('URL and keyword required'); return }
    try {
      const record = await api.blog.startTracking(projectId, trackUrl.trim(), trackKeyword.trim())
      setRecords((p) => [record, ...p])
      setTrackUrl(''); setTrackKeyword(''); setShowForm(false)
      toast.success('Tracking started')
    } catch { toast.error('Failed to add tracking') }
  }

  async function handleSnapshot(record: BlogRankRecord) {
    setSnapshotting(record.id)
    try {
      const snap = await api.blog.takeSnapshot(projectId, record.post_url, record.target_keyword, gscStatus?.properties?.[0])
      setRecords((p) => p.map((r) => r.id === record.id ? { ...r, snapshots: [...r.snapshots, snap] } : r))
      toast.success(`Position: ${snap.position !== null ? `#${snap.position}` : 'Not in top 100'}`)
    } catch { toast.error('Snapshot failed') } finally { setSnapshotting(null) }
  }

  async function handleConnectGSC() {
    try {
      const { auth_url } = await api.blog.getGSCAuthUrl(projectId)
      window.location.href = auth_url
    } catch { toast.error('Failed to get GSC auth URL') }
  }

  const bands: (keyof typeof BAND_CONFIG)[] = ['top3', 'page1', 'page2', 'beyond']
  const summary = {
    total: records.length,
    tracked: records.filter((r) => r.snapshots.length > 0).length,
    top10: records.filter((r) => { const p = latestSnapshot(r)?.position ?? null; return p !== null && p <= 10 }).length,
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <div className="flex-1">
          <h1 className="font-semibold">Rank Tracker</h1>
          <p className="text-xs text-muted-foreground">Track Google position for any URL + keyword pair</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
          <PlusCircle className="w-3.5 h-3.5" /> Track URL
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* GSC connection */}
        {gscStatus && !gscStatus.connected && (
          <div className="flex items-center gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Connect Google Search Console for first-party data</p>
              <p className="text-xs text-muted-foreground">Without GSC, positions are pulled from DataForSEO (paid per check).</p>
            </div>
            <button onClick={handleConnectGSC}
              className="shrink-0 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
              Connect GSC
            </button>
          </div>
        )}

        {gscStatus?.connected && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/20">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-xs font-medium text-green-800 dark:text-green-300">
              Google Search Console connected · {gscStatus.properties?.length ?? 0} propert{(gscStatus.properties?.length ?? 0) === 1 ? 'y' : 'ies'}
            </p>
            <button onClick={() => api.blog.disconnectGSC(projectId).then(() => setGscStatus({ connected: false }))}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground">
              Disconnect
            </button>
          </div>
        )}

        {/* Summary */}
        {records.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Tracked URLs', value: summary.total },
              { label: 'With snapshots', value: summary.tracked },
              { label: 'In top 10', value: summary.top10 },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl border border-border bg-card text-center">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
            <p className="text-sm font-semibold">Track New URL</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Published URL</label>
                <input value={trackUrl} onChange={(e) => setTrackUrl(e.target.value)}
                  placeholder="https://yourblog.com/post-slug"
                  className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Target Keyword</label>
                <input value={trackKeyword} onChange={(e) => setTrackKeyword(e.target.value)}
                  placeholder="email marketing for SaaS"
                  className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
                Start Tracking
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Band view */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading rank data…
          </div>
        ) : records.length === 0 && !showForm ? (
          <div className="text-center py-16 space-y-3">
            <Search className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No URLs tracked yet.</p>
            <p className="text-xs text-muted-foreground">Click "Track URL" to start monitoring a page's position.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {bands.map((band) => (
              <BandColumn key={band} band={band} records={records} />
            ))}
          </div>
        )}

        {/* Per-record snapshot buttons */}
        {records.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Refresh Snapshots</p>
            <div className="space-y-2">
              {records.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-1.5">
                  <p className="text-xs text-muted-foreground truncate flex-1">{r.target_keyword} — {r.post_url}</p>
                  <button onClick={() => handleSnapshot(r)} disabled={snapshotting === r.id}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 shrink-0">
                    {snapshotting === r.id
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…</>
                      : <><RefreshCw className="w-3.5 h-3.5" /> Snapshot</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
