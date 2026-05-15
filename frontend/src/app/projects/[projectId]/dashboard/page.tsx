'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Loader2, Library, CalendarDays, BarChart2,
  Brain, TrendingUp, Zap, ChevronRight, RefreshCw,
  AlertTriangle, Lightbulb, Star, Info, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { PageHeader } from '@/components/layout/page-header'
import { SetupChecklist } from '@/components/onboarding/setup-checklist'
import type { ProjectAnalytics, ProjectInsight } from '@/types'

type ComparisonData = {
  period_days: number
  library: { current: number; previous: number; pct_change: number | null }
  calendar: { current: number; previous: number; pct_change: number | null }
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-600',
  tiktok: 'bg-neutral-900',
  linkedin: 'bg-blue-700',
  x: 'bg-neutral-700',
  email: 'bg-violet-500',
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  draft:     { bg: 'bg-muted',          text: 'text-muted-foreground', ring: 'ring-border',           label: 'Draft' },
  approved:  { bg: 'bg-emerald-500/10', text: 'text-emerald-600',      ring: 'ring-emerald-500/20',   label: 'Approved' },
  scheduled: { bg: 'bg-blue-500/10',    text: 'text-blue-600',         ring: 'ring-blue-500/20',      label: 'Scheduled' },
  posted:    { bg: 'bg-violet-500/10',  text: 'text-violet-600',       ring: 'ring-violet-500/20',    label: 'Posted' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function brandHealthScore(data: ProjectAnalytics | null): number {
  if (!data) return 0
  const lib = data.library
  const cal = data.calendar
  const mem = data.memory
  const comp = data.competitors
  let score = 30
  if ((lib?.total ?? 0) > 0) score += Math.min(25, Math.round(((lib?.total ?? 0) / 20) * 25))
  if ((lib?.by_status?.['posted'] ?? 0) > 0) score += 10
  if ((cal?.upcoming_count ?? 0) > 0) score += 15
  if ((comp?.count ?? 0) > 0) score += 15
  if ((mem?.count ?? 0) > 0) score += Math.min(5, mem?.count ?? 0)
  return Math.min(100, score)
}

function useAnimatedCount(target: number, duration = 900) {
  const [count, setCount] = useState(0)
  const rafRef = useRef<number>(0)
  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    if (target === 0) { setCount(0); return }
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setCount(Math.round(target * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])
  return count
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const { activeProject } = useAppStore()

  const [data, setData] = useState<ProjectAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<ProjectInsight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [comparePeriod, setComparePeriod] = useState<'7d' | '30d'>('7d')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [result, comp] = await Promise.all([
        api.analytics.get(params.projectId),
        api.analytics.compare(params.projectId, comparePeriod),
      ])
      setData(result)
      setComparison(comp)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [params.projectId, comparePeriod])

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true)
    try {
      const result = await api.insights.get(params.projectId)
      setInsights(result.insights)
    } catch (err) {
      console.error(err)
    } finally {
      setInsightsLoading(false)
    }
  }, [params.projectId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadInsights() }, [loadInsights])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const lib = data?.library
  const cal = data?.calendar
  const mem = data?.memory
  const comp = data?.competitors
  const topPerformers = data?.top_performers ?? []
  const healthScore = brandHealthScore(data)

  const pipeline = [
    { key: 'draft',     ...STATUS_CONFIG['draft'],     count: lib?.by_status?.['draft'] ?? 0 },
    { key: 'approved',  ...STATUS_CONFIG['approved'],  count: lib?.by_status?.['approved'] ?? 0 },
    { key: 'scheduled', ...STATUS_CONFIG['scheduled'], count: lib?.by_status?.['scheduled'] ?? 0 },
    { key: 'posted',    ...STATUS_CONFIG['posted'],    count: lib?.by_status?.['posted'] ?? 0 },
  ]

  const byPlatform = Object.entries(lib?.by_platform ?? {}).sort((a, b) => b[1] - a[1])

  const headerActions = (
    <div className="flex items-center gap-2">
      <div className="flex items-center border border-border rounded-lg overflow-hidden text-xs">
        {(['7d', '30d'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setComparePeriod(p)}
            className={cn(
              'px-2.5 py-1 transition-colors',
              comparePeriod === p ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/50',
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        onClick={load}
        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Refresh"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <PageHeader
        icon={<LayoutDashboard className="w-4 h-4" />}
        title="Brand Dashboard"
        subtitle={activeProject?.name}
        showBack
        actions={headerActions}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 page-enter">
        {activeProject && <SetupChecklist project={activeProject} />}

        {/* Hero row: brand health gauge + stat cards */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4 items-stretch">
          <div className="card-raised p-5 flex flex-col items-center justify-center gap-1">
            <BrandHealthGauge score={healthScore} />
            <p className="text-xs text-muted-foreground">Brand Health</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Library className="w-4 h-4" />}
              iconColor="bg-violet-500/10 text-violet-600"
              label="Library Items"
              value={lib?.total ?? 0}
              sub={`${lib?.by_status?.['posted'] ?? 0} posted`}
              trend={comparison?.library.pct_change ?? null}
              onClick={() => router.push(`/projects/${params.projectId}/library`)}
            />
            <StatCard
              icon={<CalendarDays className="w-4 h-4" />}
              iconColor="bg-blue-500/10 text-blue-600"
              label="Upcoming Posts"
              value={cal?.upcoming_count ?? 0}
              sub="next 30 days"
              trend={comparison?.calendar.pct_change ?? null}
              onClick={() => router.push(`/projects/${params.projectId}/calendar`)}
            />
            <StatCard
              icon={<Brain className="w-4 h-4" />}
              iconColor="bg-amber-500/10 text-amber-600"
              label="Brand Memory"
              value={mem?.count ?? 0}
              sub="signals learned"
              onClick={() => router.push(`/projects/${params.projectId}/intelligence`)}
            />
            <StatCard
              icon={<BarChart2 className="w-4 h-4" />}
              iconColor="bg-rose-500/10 text-rose-600"
              label="Competitors"
              value={comp?.count ?? 0}
              sub={comp?.last_analysis ? `Last: ${timeAgo(comp.last_analysis)}` : 'Not analysed'}
              onClick={() => router.push(`/projects/${params.projectId}/intelligence`)}
            />
          </div>
        </div>

        {/* Content Pipeline — Kanban pills */}
        <div className="card-raised p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Content Pipeline</h3>
            <button
              onClick={() => router.push(`/projects/${params.projectId}/library`)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
            >
              View library <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
            {pipeline.map((stage, i) => (
              <div key={stage.key} className="flex flex-col flex-1 min-w-[80px] items-start">
                <div
                  className={cn(
                    'w-full rounded-xl p-3 ring-1 flex-1',
                    stage.bg, stage.ring,
                  )}
                >
                  <p className={cn('text-2xl font-bold tabular-nums', stage.text)}>{stage.count}</p>
                  <p className={cn('text-[11px] font-medium mt-0.5', stage.text)}>{stage.label}</p>
                </div>
                {i < pipeline.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40 mx-auto mt-1 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
          {(lib?.total ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Save content to the library to start tracking your pipeline.
            </p>
          )}
        </div>

        {/* Middle row: Platform breakdown + Upcoming */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card-raised p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Content by Platform</h3>
              <button
                onClick={() => router.push(`/projects/${params.projectId}/bulk`)}
                className="text-xs text-emerald-600 flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <Zap className="w-3 h-3" /> Generate
              </button>
            </div>
            {byPlatform.length === 0 ? (
              <div className="flex items-center justify-center h-24">
                <p className="text-xs text-muted-foreground text-center">No content yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {byPlatform.map(([platform, count]) => {
                  const pct = Math.round((count / (lib?.total || 1)) * 100)
                  return (
                    <div key={platform} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className={cn('w-2 h-2 rounded-full shrink-0', PLATFORM_COLORS[platform.toLowerCase()] ?? 'bg-muted-foreground')} />
                          <span className="text-xs font-medium capitalize">{platform}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', PLATFORM_COLORS[platform.toLowerCase()] ?? 'bg-primary')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="card-raised p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Upcoming Posts</h3>
              <button
                onClick={() => router.push(`/projects/${params.projectId}/calendar`)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
              >
                Full calendar <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {(cal?.upcoming?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 gap-2">
                <p className="text-xs text-muted-foreground text-center">No upcoming posts scheduled.</p>
                <button
                  onClick={() => router.push(`/projects/${params.projectId}/calendar`)}
                  className="text-xs text-blue-600 hover:opacity-80"
                >
                  Generate a calendar →
                </button>
              </div>
            ) : (
              <div>
                {cal?.upcoming?.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                    <div className="text-xs text-muted-foreground w-14 shrink-0 tabular-nums pt-0.5">
                      {formatDate(entry.date)}
                    </div>
                    <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', PLATFORM_COLORS[entry.platform?.toLowerCase()] ?? 'bg-muted-foreground')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground/80 truncate">{entry.content}</p>
                      <span className="text-[10px] text-muted-foreground capitalize">{entry.platform}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top performers */}
        {topPerformers.length > 0 && (
          <div className="card-raised p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold">Top Performers</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {topPerformers.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                  <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', PLATFORM_COLORS[item.platform?.toLowerCase()] ?? 'bg-muted-foreground')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/80 line-clamp-2">{item.content}</p>
                    <span className="text-[10px] text-muted-foreground capitalize">{item.platform}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-bold text-emerald-600">{item.engagement_rate.toFixed(1)}%</span>
                    <p className="text-[10px] text-muted-foreground">engagement</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Insights */}
        <div className="card-raised p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-violet-600" />
              </div>
              <h3 className="text-sm font-semibold">LEO&apos;s Insights</h3>
            </div>
            <button
              onClick={loadInsights}
              disabled={insightsLoading}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Refresh insights"
            >
              {insightsLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
            </button>
          </div>
          {insightsLoading && insights.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : insights.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Click refresh to generate AI insights for this project.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} projectId={params.projectId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BrandHealthGauge
// ---------------------------------------------------------------------------

function BrandHealthGauge({ score }: { score: number }) {
  const r = 44
  const circumference = 2 * Math.PI * r
  const trackLength = (270 / 360) * circumference
  const fillLength = (score / 100) * trackLength
  const gaugeColor = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  const label = score >= 70 ? 'Great' : score >= 40 ? 'Growing' : 'Starting'

  return (
    <svg width={120} height={104} viewBox="0 0 120 110" className="overflow-visible">
      {/* Track */}
      <circle
        cx={60} cy={62} r={r}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={`${trackLength} ${circumference - trackLength}`}
        transform="rotate(135 60 62)"
      />
      {/* Fill */}
      <circle
        cx={60} cy={62} r={r}
        fill="none"
        stroke={gaugeColor}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={`${fillLength} ${circumference - fillLength}`}
        transform="rotate(135 60 62)"
        style={{ transition: 'stroke-dasharray 1.2s ease-out' }}
      />
      <text
        x={60} y={60}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: 22, fontWeight: 700, fill: 'hsl(var(--foreground))', fontFamily: 'inherit' }}
      >
        {score}
      </text>
      <text
        x={60} y={79}
        textAnchor="middle"
        style={{ fontSize: 10, fill: gaugeColor, fontWeight: 600, fontFamily: 'inherit' }}
      >
        {label}
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// InsightCard
// ---------------------------------------------------------------------------

const INSIGHT_CONFIG: Record<string, { icon: React.ReactNode; border: string; iconBg: string; ctaColor: string }> = {
  warning:     { icon: <AlertTriangle className="w-3.5 h-3.5" />, border: 'border-amber-500/30',   iconBg: 'bg-amber-500/10 text-amber-600',   ctaColor: 'text-amber-600 hover:text-amber-700' },
  opportunity: { icon: <Lightbulb className="w-3.5 h-3.5" />,    border: 'border-violet-500/30',  iconBg: 'bg-violet-500/10 text-violet-600', ctaColor: 'text-violet-600 hover:text-violet-700' },
  tip:         { icon: <Info className="w-3.5 h-3.5" />,          border: 'border-blue-500/30',    iconBg: 'bg-blue-500/10 text-blue-600',     ctaColor: 'text-blue-600 hover:text-blue-700' },
  achievement: { icon: <Star className="w-3.5 h-3.5" />,          border: 'border-emerald-500/30', iconBg: 'bg-emerald-500/10 text-emerald-600', ctaColor: 'text-emerald-600 hover:text-emerald-700' },
}

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-500',
  low:    'bg-muted-foreground',
}

function InsightCard({ insight, projectId }: { insight: ProjectInsight; projectId: string }) {
  const router = useRouter()
  const config = INSIGHT_CONFIG[insight.type] ?? INSIGHT_CONFIG.tip

  return (
    <div className={cn('rounded-xl border p-3.5 flex flex-col gap-2', config.border)}>
      <div className="flex items-start gap-2">
        <div className={cn('p-1.5 rounded-md shrink-0 mt-0.5', config.iconBg)}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold leading-tight">{insight.title}</span>
            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', PRIORITY_DOT[insight.priority] ?? PRIORITY_DOT.low)} />
          </div>
        </div>
      </div>
      <p className="text-xs text-foreground/70 leading-relaxed flex-1">{insight.body}</p>
      {insight.action && (
        <button
          onClick={() => router.push(`/projects/${projectId}/chats/new`)}
          className={cn(
            'flex items-center gap-1 text-[11px] font-medium pt-2 border-t border-border/50 transition-colors w-full text-left',
            config.ctaColor,
          )}
        >
          <Zap className="w-3 h-3 shrink-0" />
          <span className="truncate">{insight.action}</span>
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({
  icon, iconColor, label, value, sub, trend, onClick,
}: {
  icon: React.ReactNode
  iconColor: string
  label: string
  value: number
  sub: string
  trend?: number | null
  onClick?: () => void
}) {
  const animated = useAnimatedCount(value)

  return (
    <button
      onClick={onClick}
      className="card-raised p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group w-full"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', iconColor)}>
          {icon}
        </div>
        {trend !== null && trend !== undefined && (
          <div className={cn(
            'flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
            trend > 0 ? 'bg-emerald-500/10 text-emerald-600' : trend < 0 ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground',
          )}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : trend < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums count-enter">{animated}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      <p className="text-[10px] text-muted-foreground/70">{sub}</p>
    </button>
  )
}
