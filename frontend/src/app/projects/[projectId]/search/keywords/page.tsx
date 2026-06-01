'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Search, TrendingUp, Loader2, AlertCircle, ExternalLink, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { SSEFeaturePage } from '@/components/pillar1/SSEFeaturePage'
import { SidebarToggle } from '@/components/layout/sidebar'
import { api } from '@/lib/api'
import { usePillar3Store } from '@/stores/pillar3-store'
import type { KeywordResearchPayload, ProgressStep } from '@/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const LOCATIONS = [
  { label: 'United States', code: 2840 },
  { label: 'United Kingdom', code: 2826 },
  { label: 'Canada', code: 2124 },
  { label: 'Australia', code: 2036 },
  { label: 'Germany', code: 2276 },
  { label: 'France', code: 2250 },
]

const INTENT_COLORS: Record<string, string> = {
  Informational: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Navigational:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Transactional: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Commercial:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

function DifficultyBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">N/A</span>
  const color = score <= 30 ? 'bg-green-500' : score <= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono">{score}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GSC Opportunities tab
// ---------------------------------------------------------------------------

function GSCOpportunitiesTab({ projectId }: { projectId: string }) {
  type GSCQuery = { query: string; clicks: number; impressions: number; ctr: number; position: number }

  const [gscStatus, setGscStatus] = useState<{ connected: boolean } | null>(null)
  const [queries, setQueries] = useState<GSCQuery[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(28)

  useEffect(() => {
    api.blog.getGSCStatus(projectId)
      .then(setGscStatus)
      .catch(() => setGscStatus({ connected: false }))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    if (!gscStatus?.connected) return
    setLoading(true)
    api.integrations.gscQueries(projectId, days)
      .then((r) => setQueries(r.queries))
      .catch(() => toast.error('Failed to load GSC queries'))
      .finally(() => setLoading(false))
  }, [projectId, gscStatus, days])

  // "Quick win" = position 4-20 with impressions > 500 and CTR below average
  const avgCtr = queries.length > 0 ? queries.reduce((s, q) => s + q.ctr, 0) / queries.length : 0
  const quickWins = queries.filter((q) => q.position >= 4 && q.position <= 20 && q.impressions > 500 && q.ctr < avgCtr)

  function handleWritePost(query: string) {
    toast.info(`Opening Blog Brief for "${query}"`)
    window.location.href = `/projects/${projectId}/search/blog-brief?keyword=${encodeURIComponent(query)}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!gscStatus?.connected) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-center p-8">
        <div className="p-4 rounded-full bg-muted">
          <Search className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="font-semibold">Google Search Console not connected</h2>
          <p className="text-sm text-muted-foreground">
            Connect GSC to see your actual keyword rankings, impressions, CTR, and quick-win opportunities from Google's own index.
          </p>
        </div>
        <a
          href={`/projects/${projectId}/settings/integrations`}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Connect GSC
        </a>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Period:</span>
        {[7, 28, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              days === d ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Quick wins callout */}
      {quickWins.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {quickWins.length} Quick Win{quickWins.length !== 1 ? 's' : ''} — High impressions, low CTR
            </p>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            These keywords already rank on page 1–2 but have below-average click-through rates. A targeted blog post could move the needle fast.
          </p>
          <div className="space-y-2">
            {quickWins.slice(0, 5).map((q, i) => (
              <div key={i} className="flex items-center justify-between gap-3 bg-white dark:bg-amber-900/30 rounded-lg px-3 py-2.5 border border-amber-200/60 dark:border-amber-900/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{q.query}</p>
                  <p className="text-xs text-muted-foreground">
                    Pos {q.position} · {q.impressions.toLocaleString()} impressions · {q.ctr}% CTR
                  </p>
                </div>
                <button
                  onClick={() => handleWritePost(q.query)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
                >
                  <FileText className="w-3 h-3" /> Write Post
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All queries table */}
      {queries.length > 0 ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">All Search Queries</p>
            <span className="text-xs text-muted-foreground">{queries.length} queries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Query</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Clicks</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Impressions</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">CTR</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Position</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {queries.map((q, i) => {
                  const isWin = quickWins.includes(q)
                  return (
                    <tr key={i} className={cn('border-b border-border/50 hover:bg-muted/20', isWin && 'bg-amber-50/50 dark:bg-amber-900/10')}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {isWin && <span className="text-amber-500 shrink-0" title="Quick win opportunity">⚡</span>}
                          <span className="font-medium">{q.query}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{q.clicks}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{q.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{q.ctr}%</td>
                      <td className={cn(
                        'px-4 py-2.5 text-right tabular-nums font-medium',
                        q.position <= 3 ? 'text-green-600' : q.position <= 10 ? 'text-amber-600' : 'text-muted-foreground',
                      )}>
                        {q.position}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleWritePost(q.query)}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Write blog post for this keyword"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No query data found for this period</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI Research tab (existing SSEFeaturePage content)
// ---------------------------------------------------------------------------

function AIResearchTab({ projectId }: { projectId: string }) {
  const store = usePillar3Store()
  const [seeds, setSeeds] = useState('')
  const [locationCode, setLocationCode] = useState(2840)
  const [limit, setLimit] = useState(50)
  const [result, setResult] = useState<KeywordResearchPayload | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function generate() {
    const seedList = seeds.split(',').map((s) => s.trim()).filter(Boolean)
    if (seedList.length === 0) { toast.error('Enter at least one seed keyword'); return }
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    store.setIsStreaming(true)
    store.clearSteps()
    store.clearStreamText()
    setResult(null)
    try {
      await api.pillar3.streamKeywordResearch(
        projectId,
        { seed_keywords: seedList, location_code: locationCode, language_code: 'en', limit },
        {
          onStep: (step, label, status) => store.upsertStep(step, label, status as ProgressStep['status']),
          onDelta: (text) => store.appendStreamText(text),
          onSaved: (_id, payload) => {
            setResult(payload as unknown as KeywordResearchPayload)
            store.clearStreamText()
            store.setIsStreaming(false)
            toast.success('Keyword research ready!')
          },
          onError: (msg) => { toast.error(msg); store.setIsStreaming(false) },
          onDone: () => store.setIsStreaming(false),
        },
        abortRef.current.signal,
      )
    } catch { store.setIsStreaming(false) }
  }

  const form = (
    <>
      <h2 className="font-semibold text-sm">Keyword Research Engine</h2>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Seed Keywords * (comma-separated)</label>
        <input value={seeds} onChange={(e) => setSeeds(e.target.value)}
          placeholder="e.g. marketing automation, email campaigns, lead nurturing"
          className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</label>
          <select value={locationCode} onChange={(e) => setLocationCode(Number(e.target.value))}
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary">
            {LOCATIONS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Results Limit</label>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary">
            {[20, 50, 100, 200].map((n) => <option key={n} value={n}>{n} keywords</option>)}
          </select>
        </div>
      </div>
    </>
  )

  const resultNode = result ? (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Keyword Research Results</h2>
        <span className="text-xs text-muted-foreground">{result.total_found} ideas found</span>
      </div>
      {result.strategy_note && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Strategy Overview</p>
          <p className="text-sm text-muted-foreground">{result.strategy_note}</p>
        </div>
      )}
      {result.priority_picks?.length > 0 && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Priority Picks</p>
          {result.priority_picks.map((p, i) => <p key={i} className="text-xs">⭐ {p}</p>)}
        </div>
      )}
      {result.keywords?.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 bg-muted px-3 py-2">
            {['Keyword', 'Volume', 'Diff', 'CPC', 'Intent'].map((h) => (
              <p key={h} className="text-xs font-semibold text-muted-foreground">{h}</p>
            ))}
          </div>
          {result.keywords.map((kw, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 border-t border-border items-start">
              <div>
                <p className="text-xs font-medium">{kw.keyword}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{kw.content_idea}</p>
              </div>
              <p className="text-xs font-mono text-right">{kw.search_volume?.toLocaleString() ?? '-'}</p>
              <DifficultyBar score={kw.difficulty} />
              <p className="text-xs font-mono">{kw.cpc ? `$${kw.cpc.toFixed(2)}` : '-'}</p>
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap',
                INTENT_COLORS[kw.intent] ?? 'bg-muted text-muted-foreground')}>
                {kw.intent}
              </span>
            </div>
          ))}
        </div>
      )}
      {result.cluster_suggestions?.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Keyword Clusters</p>
          {result.cluster_suggestions.map((c, i) => (
            <div key={i}>
              <p className="text-xs font-medium mb-1">{c.cluster}</p>
              <div className="flex flex-wrap gap-1">
                {c.keywords.map((kw, j) => (
                  <span key={j} className="text-[10px] px-2 py-0.5 bg-muted rounded-full">{kw}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  ) : null

  return (
    <SSEFeaturePage
      projectId={projectId}
      title="Keyword Research"
      subtitle="DataForSEO + Claude"
      icon={<Search className="w-4 h-4" />}
      credits={10}
      steps={store.steps}
      isStreaming={store.isStreaming}
      streamText={store.streamText}
      form={form}
      result={resultNode}
      onSubmit={generate}
      submitLabel="Research Keywords — 10 credits"
      canSubmit={!!seeds.trim()}
    />
  )
}

// ---------------------------------------------------------------------------
// Page — tab shell
// ---------------------------------------------------------------------------

export default function KeywordResearchPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [activeTab, setActiveTab] = useState<'ai' | 'gsc'>('ai')

  // SSEFeaturePage renders its own full-page header, so for the GSC tab
  // we render our own minimal header that matches the same visual style.
  if (activeTab === 'gsc') {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <SidebarToggle />
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Keyword Research</span>
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-muted/40 ml-2">
            <button
              onClick={() => setActiveTab('ai')}
              className="px-3 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              AI Research
            </button>
            <button
              onClick={() => setActiveTab('gsc')}
              className="px-3 py-1 rounded-md text-xs font-medium bg-background text-foreground shadow-sm"
            >
              From GSC
            </button>
          </div>
        </div>
        <GSCOpportunitiesTab projectId={projectId} />
      </div>
    )
  }

  // AI tab: SSEFeaturePage handles its own header, so inject tabs into it
  // by wrapping in a relative container and overlaying the tab switcher.
  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Tab overlay — absolutely positioned to sit inside SSEFeaturePage's header row */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-muted/80 backdrop-blur-sm shadow-sm">
          <button
            onClick={() => setActiveTab('ai')}
            className="px-3 py-1 rounded-md text-xs font-medium bg-background text-foreground shadow-sm"
          >
            AI Research
          </button>
          <button
            onClick={() => setActiveTab('gsc')}
            className="px-3 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            From GSC
          </button>
        </div>
      </div>
      <AIResearchTab projectId={projectId} />
    </div>
  )
}
