'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { TrendingUp, PlusCircle, RefreshCw, Loader2, ExternalLink, BarChart3, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api, type BlogRankRecord, type BlogRankSnapshot } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'
import { cn } from '@/lib/utils'

function PositionTrend({ snapshots }: { snapshots: BlogRankSnapshot[] }) {
  if (snapshots.length < 2) return null

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const previous = sorted[sorted.length - 2]

  if (!latest.position || !previous.position) return null

  const diff = previous.position - latest.position
  const improved = diff > 0

  return (
    <span className={cn(
      'text-xs font-medium',
      improved ? 'text-green-500' : diff < 0 ? 'text-red-500' : 'text-muted-foreground',
    )}>
      {improved ? '↑' : diff < 0 ? '↓' : '→'} {Math.abs(diff)} positions
    </span>
  )
}

function SparkLine({ snapshots }: { snapshots: BlogRankSnapshot[] }) {
  const valid = snapshots
    .filter((s) => s.position !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12)

  if (valid.length < 2) return <span className="text-xs text-muted-foreground">Not enough data</span>

  const positions = valid.map((s) => s.position as number)
  const maxPos = Math.max(...positions)
  const minPos = Math.min(...positions)
  const range = maxPos - minPos || 1

  const W = 120
  const H = 32
  const points = positions.map((p, i) => {
    const x = (i / (positions.length - 1)) * W
    // Invert: position 1 is top, higher position is lower
    const y = ((p - minPos) / range) * H
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-primary"
      />
    </svg>
  )
}

export default function BlogPerformancePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [records, setRecords] = useState<BlogRankRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [gscStatus, setGscStatus] = useState<{ connected: boolean; properties?: string[] } | null>(null)
  const [trackingUrl, setTrackingUrl] = useState('')
  const [trackingKeyword, setTrackingKeyword] = useState('')
  const [showTrackForm, setShowTrackForm] = useState(false)
  const [snapshotting, setSnapshotting] = useState<string | null>(null)

  useEffect(() => {
    // Handle GSC OAuth callback
    const gscConnected = searchParams.get('gsc_connected')
    const gscError = searchParams.get('gsc_error')
    if (gscConnected) {
      toast.success('Google Search Console connected!')
      router.replace(`/projects/${projectId}/analytics-pro/blog-performance`)
    } else if (gscError) {
      toast.error('Google Search Console connection failed')
      router.replace(`/projects/${projectId}/analytics-pro/blog-performance`)
    }

    Promise.all([
      api.blog.listRankHistory(projectId),
      api.blog.getGSCStatus(projectId),
    ]).then(([rankRes, gscRes]) => {
      setRecords(rankRes.records)
      setGscStatus(gscRes)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [projectId, searchParams, router])

  async function handleConnectGSC() {
    try {
      const { auth_url } = await api.blog.getGSCAuthUrl(projectId)
      window.location.href = auth_url
    } catch {
      toast.error('Failed to get GSC auth URL')
    }
  }

  async function handleStartTracking() {
    if (!trackingUrl.trim() || !trackingKeyword.trim()) {
      toast.error('URL and keyword are required')
      return
    }
    try {
      const record = await api.blog.startTracking(projectId, trackingUrl.trim(), trackingKeyword.trim())
      setRecords((prev) => [record, ...prev])
      setTrackingUrl('')
      setTrackingKeyword('')
      setShowTrackForm(false)
      toast.success('Post added for rank tracking')
    } catch {
      toast.error('Failed to start tracking')
    }
  }

  async function handleSnapshot(record: BlogRankRecord) {
    setSnapshotting(record.id)
    try {
      const snapshot = await api.blog.takeSnapshot(
        projectId,
        record.post_url,
        record.target_keyword,
        gscStatus?.properties?.[0],
      )
      setRecords((prev) => prev.map((r) =>
        r.id === record.id
          ? { ...r, snapshots: [...r.snapshots, snapshot] }
          : r
      ))
      toast.success(`Position: ${snapshot.position ?? 'Not in top 100'}`)
    } catch {
      toast.error('Snapshot failed')
    } finally {
      setSnapshotting(null)
    }
  }

  const latestPosition = (record: BlogRankRecord) => {
    const valid = record.snapshots.filter((s) => s.position !== null)
    if (valid.length === 0) return null
    return valid.sort((a, b) => b.date.localeCompare(a.date))[0].position
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <div className="text-primary"><BarChart3 className="w-5 h-5" /></div>
        <div>
          <h1 className="font-semibold text-sm">Blog Performance</h1>
          <p className="text-xs text-muted-foreground">Rank tracking for published blog posts</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* GSC Connection Banner */}
        {gscStatus && !gscStatus.connected && (
          <div className="flex items-center gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Connect Google Search Console</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                GSC gives first-party position, click, and impression data for your verified domains.
                Without it, rank tracking uses DataForSEO (paid, works for any URL).
              </p>
            </div>
            <button
              onClick={handleConnectGSC}
              className="shrink-0 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
            >
              Connect GSC
            </button>
          </div>
        )}

        {gscStatus?.connected && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/20">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Google Search Console Connected</p>
              {gscStatus.properties && gscStatus.properties.length > 0 && (
                <p className="text-xs text-green-700 dark:text-green-400">
                  {gscStatus.properties.length} propert{gscStatus.properties.length === 1 ? 'y' : 'ies'}: {gscStatus.properties.slice(0, 2).join(', ')}
                  {gscStatus.properties.length > 2 ? ` +${gscStatus.properties.length - 2} more` : ''}
                </p>
              )}
            </div>
            <button
              onClick={() => api.blog.disconnectGSC(projectId).then(() => setGscStatus({ connected: false }))}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Rank Records */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading rank data…
          </div>
        ) : (
          <>
            {records.length > 0 && (
              <div className="space-y-3">
                {records.map((record) => {
                  const position = latestPosition(record)
                  return (
                    <div key={record.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <a
                            href={record.post_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium hover:text-primary flex items-center gap-1 truncate"
                          >
                            {record.post_url} <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          <p className="text-xs text-muted-foreground">
                            Keyword: <span className="font-medium text-foreground">{record.target_keyword}</span>
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          {position !== null ? (
                            <>
                              <p className={cn(
                                'text-xl font-bold',
                                position <= 3 ? 'text-green-500' : position <= 10 ? 'text-primary' : 'text-muted-foreground',
                              )}>
                                #{position}
                              </p>
                              <PositionTrend snapshots={record.snapshots} />
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">No data yet</p>
                          )}
                        </div>
                      </div>

                      {record.snapshots.length > 1 && (
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground">Trend</span>
                          <SparkLine snapshots={record.snapshots} />
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {record.snapshots.length} snapshots · last {record.snapshots[record.snapshots.length - 1]?.source ?? ''}
                          </span>
                        </div>
                      )}

                      <button
                        onClick={() => handleSnapshot(record)}
                        disabled={snapshotting === record.id}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        {snapshotting === record.id ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking rank…</>
                        ) : (
                          <><RefreshCw className="w-3.5 h-3.5" /> Take snapshot</>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {records.length === 0 && !showTrackForm && (
              <div className="text-center py-12 space-y-3">
                <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No posts tracked yet</p>
                <p className="text-xs text-muted-foreground">Add a published blog post URL to start monitoring its Google ranking.</p>
              </div>
            )}

            {!showTrackForm ? (
              <button
                onClick={() => setShowTrackForm(true)}
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors w-full justify-center"
              >
                <PlusCircle className="w-4 h-4" />
                Track a Blog Post
              </button>
            ) : (
              <div className="p-5 rounded-xl border border-border bg-card space-y-4">
                <p className="text-sm font-semibold">Track New Post</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Published URL</label>
                    <input
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      placeholder="https://yourblog.com/post-slug"
                      className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target Keyword</label>
                    <input
                      value={trackingKeyword}
                      onChange={(e) => setTrackingKeyword(e.target.value)}
                      placeholder="email marketing for SaaS"
                      className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleStartTracking}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90"
                  >
                    Start Tracking
                  </button>
                  <button
                    onClick={() => setShowTrackForm(false)}
                    className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
