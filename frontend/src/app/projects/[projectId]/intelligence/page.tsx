'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import {
  BarChart2, RefreshCw, Plus, X, Loader2, ChevronDown, ChevronUp,
  TrendingUp, AlertTriangle, Lightbulb, Zap, Bell, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { SidebarToggle } from '@/components/layout/sidebar'
import { BackButton } from '@/components/layout/back-button'
import type { CompetitorSnapshot, DiscoveredCompetitor } from '@/types'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntelligencePage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const { activeProject } = useAppStore()

  const [snapshots, setSnapshots] = useState<CompetitorSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [discovered, setDiscovered] = useState<DiscoveredCompetitor[]>([])

  // Add competitor form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [competitors, setCompetitors] = useState<
    { name: string; instagram: string; facebook: string; tiktok: string }[]
  >([{ name: '', instagram: '', facebook: '', tiktok: '' }])

  const loadSnapshots = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.intelligence.get(params.projectId)
      setSnapshots(data.snapshots)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [params.projectId])

  useEffect(() => {
    if (params.projectId) loadSnapshots()
  }, [params.projectId, loadSnapshots])

  async function handleRefresh() {
    const valid = competitors.filter((c) => c.name.trim())
    if (valid.length === 0) {
      toast.error('Add at least one competitor to analyse.')
      return
    }

    setRefreshing(true)
    setShowAddForm(false)
    try {
      const result = await api.intelligence.refresh(
        params.projectId,
        valid.map((c) => ({
          name: c.name.trim(),
          instagram: c.instagram.trim() || undefined,
          facebook: c.facebook.trim() || undefined,
          tiktok: c.tiktok.trim() || undefined,
        })),
      )
      toast.success(`Analysed ${result.refreshed.length} competitor(s).`)
      await loadSnapshots()
      // Reset form
      setCompetitors([{ name: '', instagram: '', facebook: '', tiktok: '' }])
    } catch (err) {
      toast.error('Intelligence refresh failed. Check competitor handles and try again.')
      console.error(err)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleDiscover() {
    setDiscovering(true)
    setDiscovered([])
    try {
      const result = await api.seoIntel.discoverCompetitors(params.projectId)
      setDiscovered(result.competitors)
      if (result.competitors.length === 0) {
        toast.info('No competitors found automatically. Add them manually.')
      }
    } catch {
      toast.error('Auto-discovery requires an Exa API key.')
    } finally {
      setDiscovering(false)
    }
  }

  function addDiscoveredCompetitor(c: DiscoveredCompetitor) {
    // Pre-fill a new row in the add form with the competitor name
    let name = c.name
    if (!name) {
      try { name = new URL(c.url).hostname.replace('www.', '') } catch { name = c.url }
    }
    setCompetitors((prev) => {
      const empty = prev.find((p) => !p.name.trim())
      if (empty) {
        return prev.map((p) => p.name.trim() === '' ? { ...p, name } : p)
      }
      return [...prev, { name, instagram: '', facebook: '', tiktok: '' }]
    })
    setShowAddForm(true)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-border shrink-0">
        <SidebarToggle />
        <BackButton />
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Competitive Intelligence</span>
        </div>
        {activeProject && (
          <span className="text-xs text-muted-foreground">— {activeProject.name}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* Monitoring link */}
          <button
            onClick={() => router.push(`/projects/${params.projectId}/intelligence/monitoring`)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            Monitoring
          </button>
          {/* Auto-discover */}
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            {discovering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {discovering ? 'Discovering…' : 'Auto-discover'}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Competitors
          </button>
          {snapshots.length > 0 && (
            <button
              onClick={() => setShowAddForm(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {refreshing ? 'Analysing…' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Add competitor form */}
        {showAddForm && (
          <div className="border-b border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Add competitors to analyse</h3>
              <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {competitors.map((comp, i) => (
              <div key={i} className="grid grid-cols-4 gap-2">
                <input
                  value={comp.name}
                  onChange={(e) => {
                    const next = [...competitors]
                    next[i] = { ...next[i], name: e.target.value }
                    setCompetitors(next)
                  }}
                  placeholder="Brand name *"
                  className="text-xs bg-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  value={comp.instagram}
                  onChange={(e) => {
                    const next = [...competitors]
                    next[i] = { ...next[i], instagram: e.target.value }
                    setCompetitors(next)
                  }}
                  placeholder="@instagram_handle"
                  className="text-xs bg-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  value={comp.facebook}
                  onChange={(e) => {
                    const next = [...competitors]
                    next[i] = { ...next[i], facebook: e.target.value }
                    setCompetitors(next)
                  }}
                  placeholder="Facebook page URL"
                  className="text-xs bg-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-1">
                  <input
                    value={comp.tiktok}
                    onChange={(e) => {
                      const next = [...competitors]
                      next[i] = { ...next[i], tiktok: e.target.value }
                      setCompetitors(next)
                    }}
                    placeholder="TikTok profile URL"
                    className="flex-1 text-xs bg-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {competitors.length > 1 && (
                    <button
                      onClick={() => setCompetitors(competitors.filter((_, j) => j !== i))}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2">
              {competitors.length < 5 && (
                <button
                  onClick={() => setCompetitors([...competitors, { name: '', instagram: '', facebook: '', tiktok: '' }])}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add another
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="ml-auto flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {refreshing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing…</>
                ) : (
                  <><Zap className="w-3.5 h-3.5" /> Run Analysis</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Auto-discovered competitors */}
        {discovered.length > 0 && (
          <div className="border-b border-border bg-muted/20 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Auto-discovered competitors — click to add
              </p>
              <button onClick={() => setDiscovered([])} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {discovered.map((c, i) => (
                <button
                  key={i}
                  onClick={() => addDiscoveredCompetitor(c)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                >
                  <Plus className="w-3 h-3 text-primary shrink-0" />
                  <span className="font-medium">{c.name || (() => { try { return new URL(c.url).hostname.replace('www.', '') } catch { return c.url } })()}</span>
                  {c.relevance_score !== undefined && (
                    <span className="text-muted-foreground ml-1">{Math.round(c.relevance_score * 100)}%</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : snapshots.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-96 text-center px-8">
            <BarChart2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-2">No competitor intelligence yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Add your competitors&apos; social handles and LEO will analyse their content,
              identify their strategy, and surface opportunities they&apos;re missing.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add your first competitor
            </button>
          </div>
        ) : (
          /* Snapshot cards */
          <div className="px-4 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {snapshots.map((snapshot) => (
              <CompetitorCard key={snapshot.id} snapshot={snapshot} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CompetitorCard
// ---------------------------------------------------------------------------

function CompetitorCard({ snapshot }: { snapshot: CompetitorSnapshot }) {
  const [expanded, setExpanded] = useState(true)
  const analysis = snapshot.analysis
  const platformCount = Object.keys(snapshot.platforms || {}).length

  const scrapedDate = snapshot.scrapedAt
    ? new Date(snapshot.scrapedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Card header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {snapshot.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold">{snapshot.name}</div>
            <div className="text-xs text-muted-foreground">
              {platformCount} platform{platformCount !== 1 ? 's' : ''} analysed
              {scrapedDate && ` · ${scrapedDate}`}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && analysis && (
        <div className="px-4 pb-4 space-y-4 border-t border-border">
          {/* Tone */}
          {analysis.tone && (
            <div className="pt-3">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Their Voice</div>
              <p className="text-sm text-foreground/80">{analysis.tone}</p>
            </div>
          )}

          {/* Key themes */}
          {analysis.key_themes?.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Key Themes</div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.key_themes.map((theme, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border text-foreground/70">
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Content gaps — the strategic gold */}
          {analysis.content_gaps?.length > 0 && (
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 uppercase tracking-wide">
                <Lightbulb className="w-3.5 h-3.5" />
                Opportunities They&apos;re Missing
              </div>
              <ul className="space-y-1">
                {analysis.content_gaps.map((gap, i) => (
                  <li key={i} className="text-xs text-foreground/80 flex gap-2">
                    <span className="text-amber-500 shrink-0 mt-0.5">→</span>
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Strengths */}
            {analysis.strengths?.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs font-medium text-green-600 uppercase tracking-wide mb-1.5">
                  <TrendingUp className="w-3 h-3" />
                  They do well
                </div>
                <ul className="space-y-1">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-foreground/70">· {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Weaknesses */}
            {analysis.weaknesses?.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs font-medium text-red-500 uppercase tracking-wide mb-1.5">
                  <AlertTriangle className="w-3 h-3" />
                  Their weaknesses
                </div>
                <ul className="space-y-1">
                  {analysis.weaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-foreground/70">· {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Top hashtags */}
          {analysis.top_hashtags?.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">Their Top Hashtags</div>
              <div className="flex flex-wrap gap-1">
                {analysis.top_hashtags.slice(0, 12).map((tag, i) => (
                  <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                    #{tag.replace(/^#/, '')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
