'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts'
import {
  BarChart2, TrendingUp, FileText, Upload, Sparkles,
  RefreshCw, Clock, CheckCircle2, AlertCircle, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { SidebarToggle } from '@/components/layout/sidebar'
import { BackButton } from '@/components/layout/back-button'
import { api } from '@/lib/api'
import type {
  AnalyticsOverview, AnalyticsTrends, ContentPerformanceRow, ActivityEvent,
} from '@/types'

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  linkedin: '#0A66C2',
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  tiktok: '#000000',
  youtube: '#FF0000',
  unknown: '#6b7280',
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  in_review: '#f59e0b',
  approved: '#10b981',
  scheduled: '#3b82f6',
  posted: '#8b5cf6',
}

const PIE_FALLBACK = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']

// ---------------------------------------------------------------------------
// Activity event metadata
// ---------------------------------------------------------------------------

const EVENT_META: Record<string, { icon: React.ReactNode; label: string }> = {
  metrics_logged:        { icon: <BarChart2 className="w-3 h-3" />,       label: 'Metrics logged' },
  content_created:       { icon: <FileText className="w-3 h-3" />,        label: 'Content created' },
  content_posted:        { icon: <Upload className="w-3 h-3" />,          label: 'Content posted' },
  review_submitted:      { icon: <Clock className="w-3 h-3" />,           label: 'Submitted for review' },
  review_approved:       { icon: <CheckCircle2 className="w-3 h-3" />,    label: 'Content approved' },
  review_rejected:       { icon: <AlertCircle className="w-3 h-3" />,     label: 'Content rejected' },
  changes_requested:     { icon: <AlertCircle className="w-3 h-3" />,     label: 'Changes requested' },
  default:               { icon: <Info className="w-3 h-3" />,            label: 'Activity' },
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, icon }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
      <div className="p-2 rounded-md bg-muted text-muted-foreground shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [trends, setTrends] = useState<AnalyticsTrends | null>(null)
  const [content, setContent] = useState<ContentPerformanceRow[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [aiSummary, setAiSummary] = useState<string>('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'engagement' | 'impressions' | 'clicks'>('engagement')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, tr, ct, ac] = await Promise.all([
        api.analytics.getOverview(projectId),
        api.analytics.getTrends(projectId),
        api.analytics.getContent(projectId),
        api.analytics.getActivity(projectId),
      ])
      setOverview(ov)
      setTrends(tr)
      setContent(ct)
      setActivity(ac)
    } catch {
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function loadAiSummary() {
    setSummaryLoading(true)
    try {
      const { summary } = await api.analytics.getAiSummary(projectId)
      setAiSummary(summary)
    } catch {
      toast.error('Failed to generate summary')
    } finally {
      setSummaryLoading(false)
    }
  }

  const sortedContent = [...content].sort((a, b) => b[sortKey] - a[sortKey])

  const pieData = trends?.platform_breakdown.map((p, i) => ({
    name: p.platform,
    value: p.count,
    fill: PLATFORM_COLORS[p.platform] ?? PIE_FALLBACK[i % PIE_FALLBACK.length],
  })) ?? []

  const statusData = trends?.status_breakdown.map((s) => ({
    name: s.status,
    count: s.count,
    fill: STATUS_COLORS[s.status] ?? '#6b7280',
  })) ?? []

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <SidebarToggle />
          <BackButton />
          <BarChart2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Analytics</span>
        </header>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Loading analytics…
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <SidebarToggle />
        <BackButton />
        <BarChart2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Analytics</span>
        <div className="ml-auto">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-border hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* Overview cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Content"
            value={overview?.total_content ?? 0}
            icon={<FileText className="w-4 h-4" />}
          />
          <StatCard
            label="Posted"
            value={overview?.total_posted ?? 0}
            sub={overview?.total_content ? `${Math.round((overview.total_posted / overview.total_content) * 100)}% of total` : undefined}
            icon={<Upload className="w-4 h-4" />}
          />
          <StatCard
            label="Avg Engagement"
            value={overview?.avg_engagement ?? 0}
            sub="per tracked post"
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <StatCard
            label="Total Impressions"
            value={(overview?.total_impressions ?? 0).toLocaleString()}
            sub={overview?.best_platform ? `Best: ${overview.best_platform}` : 'No metrics yet'}
            icon={<BarChart2 className="w-4 h-4" />}
          />
        </div>

        {/* AI Summary */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">AI Performance Summary</span>
            </div>
            <button
              onClick={loadAiSummary}
              disabled={summaryLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {summaryLoading ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {aiSummary ? 'Regenerate' : 'Generate'}
            </button>
          </div>
          {aiSummary ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{aiSummary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click &quot;Generate&quot; to get an AI-powered analysis of your content performance.
            </p>
          )}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Content creation trend */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
            <p className="text-sm font-semibold mb-4">Content Created Over Time</p>
            {trends && trends.daily_creation.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trends.daily_creation} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(d) => d.slice(5)} // MM-DD
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={(l) => `Date: ${l}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    name="Content"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">
                No content data yet
              </div>
            )}
          </div>

          {/* Platform breakdown pie */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm font-semibold mb-4">Platform Breakdown</p>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">
                No data yet
              </div>
            )}
          </div>
        </div>

        {/* Status breakdown bar */}
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm font-semibold mb-4">Content by Status</p>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={statusData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" name="Items" radius={[0, 4, 4, 0]}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-28 flex items-center justify-center text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </div>

        {/* Content performance + activity side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Performance table */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">Content Performance</p>
              <div className="flex items-center gap-1">
                {(['engagement', 'impressions', 'clicks'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSortKey(k)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      sortKey === k
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Platform</th>
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Status</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Impressions</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Clicks</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedContent.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No content items yet
                      </td>
                    </tr>
                  ) : sortedContent.slice(0, 20).map((row) => (
                    <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 font-medium capitalize">{row.platform}</td>
                      <td className="px-4 py-2">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: `${STATUS_COLORS[row.status] ?? '#6b7280'}20`, color: STATUS_COLORS[row.status] ?? '#6b7280' }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.impressions > 0 ? row.impressions.toLocaleString() : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.clicks > 0 ? row.clicks.toLocaleString() : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.engagement > 0 ? (
                          <span className="font-semibold text-primary">{row.engagement}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity feed */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">Activity Feed</p>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
              {activity.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No activity yet
                </div>
              ) : activity.map((evt) => {
                const meta = EVENT_META[evt.event_type] ?? EVENT_META.default
                return (
                  <div key={evt.id} className="flex items-start gap-2.5 px-4 py-2.5 border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <div className="mt-0.5 p-1.5 rounded bg-muted text-muted-foreground shrink-0">
                      {meta.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground leading-snug">{evt.description}</p>
                      {evt.user_email && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{evt.user_email}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{relativeTime(evt.timestamp)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
