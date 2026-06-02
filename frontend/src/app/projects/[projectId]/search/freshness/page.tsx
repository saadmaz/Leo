'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  RefreshCw, AlertCircle, ExternalLink, Loader2, TrendingDown, ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { SSEFeaturePage } from '@/components/pillar1/SSEFeaturePage'
import { SidebarToggle } from '@/components/layout/sidebar'
import { api } from '@/lib/api'
import { usePillar3Store } from '@/stores/pillar3-store'
import type { ContentFreshnessPayload, ProgressStep } from '@/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Existing manual-analysis styles
// ---------------------------------------------------------------------------

const SIGNAL_STYLES = {
  good: 'text-green-700 bg-green-50 border-green-200 dark:bg-green-950/20',
  warning: 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20',
  critical: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/20',
}

const PRIORITY_BADGE = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
}

function FreshnessScore({ score }: { score: number }) {
  const color = score >= 70 ? 'text-green-500' : score >= 40 ? 'text-yellow-500' : 'text-red-500'
  const barColor = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3">
      <p className={cn('text-4xl font-bold', color)}>{score}</p>
      <div className="flex-1">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', barColor)} style={{ width: `${score}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Freshness score</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manual analysis tab (unchanged existing flow)
// ---------------------------------------------------------------------------

function ManualAnalysisTab({ projectId, initialUrl }: { projectId: string; initialUrl?: string }) {
  const store = usePillar3Store()
  const [url, setUrl] = useState(initialUrl ?? '')
  const [keyword, setKeyword] = useState('')
  const [locationCode, setLocationCode] = useState(2840)
  const [result, setResult] = useState<ContentFreshnessPayload | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function generate() {
    if (!url.trim()) { toast.error('URL is required'); return }
    if (!keyword.trim()) { toast.error('Keyword is required'); return }
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    store.setIsStreaming(true)
    store.clearSteps()
    store.clearStreamText()
    setResult(null)
    try {
      await api.pillar3.streamFreshnessCheck(projectId,
        { url: url.trim(), keyword: keyword.trim(), location_code: locationCode, language_code: 'en' },
        {
          onStep: (step, label, status) => store.upsertStep(step, label, status as ProgressStep['status']),
          onDelta: (text) => store.appendStreamText(text),
          onSaved: (_id, payload) => { setResult(payload as unknown as ContentFreshnessPayload); store.clearStreamText(); store.setIsStreaming(false); toast.success('Freshness check complete!') },
          onError: (msg) => { toast.error(msg); store.setIsStreaming(false) },
          onDone: () => store.setIsStreaming(false),
        },
        abortRef.current.signal,
      )
    } catch { store.setIsStreaming(false) }
  }

  const form = (
    <>
      <h2 className="font-semibold text-sm">Content Freshness Check</h2>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Page URL *</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/blog/your-article"
          className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target Keyword *</label>
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)}
          placeholder="e.g. best CRM for startups"
          className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</label>
        <select value={locationCode} onChange={(e) => setLocationCode(Number(e.target.value))}
          className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary">
          <option value={2840}>United States</option>
          <option value={2826}>United Kingdom</option>
          <option value={2124}>Canada</option>
          <option value={2036}>Australia</option>
        </select>
      </div>
    </>
  )

  const resultNode = result ? (
    <div className="space-y-4">
      <div className="p-5 rounded-xl border border-border bg-card space-y-4">
        <FreshnessScore score={result.freshness_score} />
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Current Rank</p>
            <p className="text-lg font-bold">{result.current_position ? `#${result.current_position}` : 'N/R'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trend</p>
            <p className="text-sm font-medium">{result.position_trend}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Priority</p>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_BADGE[result.update_priority] ?? 'bg-muted text-muted-foreground')}>
              {result.update_priority}
            </span>
          </div>
        </div>
      </div>
      {result.signals?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Freshness Signals</p>
          {result.signals.map((sig, i) => (
            <div key={i} className={cn('p-3 rounded-lg border flex items-start gap-3', SIGNAL_STYLES[sig.status])}>
              <div className={cn('w-2 h-2 rounded-full mt-1 shrink-0',
                sig.status === 'good' ? 'bg-green-500' : sig.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500')} />
              <div>
                <p className="text-xs font-semibold">{sig.signal}</p>
                <p className="text-xs opacity-80">{sig.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {result.recommended_updates?.length > 0 && (
        <div className="p-4 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">Recommended Updates</p>
          {result.recommended_updates.map((u, i) => (
            <p key={i} className="text-xs text-orange-700 mb-1">→ {u}</p>
          ))}
        </div>
      )}
      {result.refresh_checklist?.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Refresh Checklist</p>
          {result.refresh_checklist.map((item, i) => (
            <p key={i} className="text-xs text-muted-foreground">☐ {item}</p>
          ))}
        </div>
      )}
      {result.competitive_threat && (
        <div className="p-3 rounded-lg border border-border">
          <p className="text-xs font-semibold mb-1">Competitive Threat</p>
          <p className="text-xs text-muted-foreground">{result.competitive_threat}</p>
        </div>
      )}
      {result.estimated_traffic_recovery && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs font-semibold text-primary mb-0.5">Potential Impact</p>
          <p className="text-xs">{result.estimated_traffic_recovery}</p>
        </div>
      )}
    </div>
  ) : null

  return (
    <SSEFeaturePage projectId={projectId} title="Content Freshness Check" subtitle="DataForSEO + Claude"
      icon={<RefreshCw className="w-4 h-4" />} credits={10} steps={store.steps}
      isStreaming={store.isStreaming} streamText={store.streamText} form={form} result={resultNode}
      onSubmit={generate} submitLabel="Check Freshness - 10 credits" canSubmit={!!url.trim() && !!keyword.trim()} />
  )
}

// ---------------------------------------------------------------------------
// Site Audit tab (GSC-powered, shown only when GSC connected)
// ---------------------------------------------------------------------------

type AuditRow = {
  page: string
  current_impressions: number
  prior_impressions: number
  delta_percent: number
  current_clicks: number
  avg_position: number
  refresh_priority: 'urgent' | 'moderate' | 'low'
}

const PRIORITY_STYLES: Record<AuditRow['refresh_priority'], string> = {
  urgent:   'bg-red-500/10 text-red-600 border border-red-500/20',
  moderate: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  low:      'bg-muted text-muted-foreground',
}

function SiteAuditTab({ projectId, onAnalyseUrl }: { projectId: string; onAnalyseUrl: (url: string) => void }) {
  const [gscStatus, setGscStatus] = useState<{ connected: boolean; domain: string | null } | null>(null)
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.integrations.gscStatus(projectId)
      .then((s) => {
        setGscStatus({ connected: s.connected, domain: s.domain })
        if (s.connected) {
          return api.integrations.gscFreshnessAudit(projectId)
        }
        return []
      })
      .then((data) => {
        if (Array.isArray(data)) setRows(data as AuditRow[])
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!gscStatus?.connected) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Not-connected banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Connect Google Search Console
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Connect GSC to automatically surface pages with declining impressions that need refreshing.{' '}
              <a href={`/projects/${projectId}/settings/integrations`} className="underline hover:no-underline">
                Go to Integrations →
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 p-4">
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-sm text-destructive">
          Failed to load audit data: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">

      {/* Header info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          Comparing last 90 days vs prior 90 days
        </div>
        {gscStatus.domain && (
          <span className="text-xs text-muted-foreground ml-auto">
            Site: <span className="font-medium">{gscStatus.domain}</span>
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No page data found for this site</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Page</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Impressions</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Clicks</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Avg Pos.</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Priority</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={cn(
                    'border-b border-border/50 hover:bg-muted/20 transition-colors',
                    row.refresh_priority === 'urgent' && 'bg-red-500/[0.03]',
                  )}>
                    <td className="px-4 py-2.5 max-w-[260px]">
                      <p className="font-medium truncate">{row.page}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="tabular-nums">{row.current_impressions.toLocaleString()}</span>
                      <span className={cn(
                        'ml-1.5 tabular-nums font-medium',
                        row.delta_percent < 0 ? 'text-red-500' : 'text-green-500',
                      )}>
                        ({row.delta_percent > 0 ? '+' : ''}{row.delta_percent}%)
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {row.current_clicks.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {row.avg_position}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-center">
                        <span className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize',
                          PRIORITY_STYLES[row.refresh_priority],
                        )}>
                          {row.refresh_priority}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => onAnalyseUrl(row.page)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
                        title="Analyse this page"
                      >
                        Analyse <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page — tab shell
// ---------------------------------------------------------------------------

export default function FreshnessPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [activeTab, setActiveTab] = useState<'manual' | 'audit'>('manual')
  const [prefilledUrl, setPrefilledUrl] = useState<string | null>(null)

  // When "Analyse" is clicked in Site Audit, switch to manual tab with URL prefilled
  function handleAnalyseUrl(url: string) {
    setPrefilledUrl(url)
    setActiveTab('manual')
  }

  if (activeTab === 'audit') {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <SidebarToggle />
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Content Freshness</span>
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-muted/40 ml-2">
            <button
              onClick={() => setActiveTab('manual')}
              className="px-3 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Manual Check
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className="px-3 py-1 rounded-md text-xs font-medium bg-background text-foreground shadow-sm"
            >
              Site Audit
            </button>
          </div>
        </div>
        <SiteAuditTab projectId={projectId} onAnalyseUrl={handleAnalyseUrl} />
      </div>
    )
  }

  // Manual tab — SSEFeaturePage owns its own header, overlay the tabs
  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-muted/80 backdrop-blur-sm shadow-sm">
          <button
            onClick={() => setActiveTab('manual')}
            className="px-3 py-1 rounded-md text-xs font-medium bg-background text-foreground shadow-sm"
          >
            Manual Check
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className="px-3 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Site Audit
          </button>
        </div>
      </div>
      <ManualAnalysisTab
        projectId={projectId}
        initialUrl={prefilledUrl ?? undefined}
        key={prefilledUrl ?? 'default'}
      />
    </div>
  )
}
