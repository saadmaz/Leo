'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  BarChart2, RefreshCw, Plus, X, Loader2, ChevronDown, ChevronUp,
  TrendingUp, AlertTriangle, Lightbulb, Zap, Bell, Search,
  Globe, Instagram, Youtube, Linkedin, Facebook, Target,
  ArrowRight, CheckCircle2, Clock, Flame, Shield, Swords,
  TrendingDown, Minus, Activity, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { SidebarToggle } from '@/components/layout/sidebar'
import { BackButton } from '@/components/layout/back-button'
import { CompetitorReportPanel } from './competitor-report'
import type {
  CompetitorSnapshot,
  CompetitorReport,
  DiscoveredCompetitor,
  CompetitiveStrategy,
} from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompetitorForm = {
  name: string
  website: string
  instagram: string
  facebook: string
  tiktok: string
  linkedin: string
  youtube: string
}

type ProgressStep = {
  id: string
  label: string
  status: 'pending' | 'active' | 'done' | 'error'
}

type Tab = 'snapshots' | 'strategy'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-3.5 h-3.5" />,
  facebook: <Facebook className="w-3.5 h-3.5" />,
  tiktok: <Activity className="w-3.5 h-3.5" />,
  linkedin: <Linkedin className="w-3.5 h-3.5" />,
  youtube: <Youtube className="w-3.5 h-3.5" />,
  web: <Globe className="w-3.5 h-3.5" />,
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'text-pink-500 bg-pink-500/10',
  facebook: 'text-blue-500 bg-blue-500/10',
  tiktok: 'text-foreground bg-muted',
  linkedin: 'text-sky-600 bg-sky-500/10',
  youtube: 'text-red-500 bg-red-500/10',
  web: 'text-emerald-500 bg-emerald-500/10',
}

const THREAT_CONFIG = {
  high:   { label: 'High threat',   color: 'text-red-500',    bg: 'bg-red-500/10 border-red-500/20',    icon: <Flame className="w-3.5 h-3.5" /> },
  medium: { label: 'Medium threat', color: 'text-amber-500',  bg: 'bg-amber-500/10 border-amber-500/20', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  low:    { label: 'Low threat',    color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: <Shield className="w-3.5 h-3.5" /> },
}

const POSITION_CONFIG = {
  winning:    { label: 'Winning',    color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  competitive:{ label: 'Competitive', color: 'text-blue-500',  bg: 'bg-blue-500/10',    icon: <Minus className="w-3.5 h-3.5" /> },
  losing:     { label: 'Behind',     color: 'text-red-500',    bg: 'bg-red-500/10',     icon: <TrendingDown className="w-3.5 h-3.5" /> },
  untapped:   { label: 'Untapped',   color: 'text-violet-500', bg: 'bg-violet-500/10',  icon: <Sparkles className="w-3.5 h-3.5" /> },
}

const PRIORITY_CONFIG = {
  immediate:  { label: 'Do now',      color: 'text-red-500',    bg: 'bg-red-500/10',    border: 'border-red-500/30' },
  short_term: { label: 'This month',  color: 'text-amber-500',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30' },
  long_term:  { label: 'Long-term',   color: 'text-blue-500',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
}

function emptyForm(): CompetitorForm {
  return { name: '', website: '', instagram: '', facebook: '', tiktok: '', linkedin: '', youtube: '' }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntelligencePage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const { activeProject } = useAppStore()

  const [tab, setTab] = useState<Tab>('snapshots')
  const [snapshots, setSnapshots] = useState<CompetitorSnapshot[]>([])
  const [strategy, setStrategy] = useState<CompetitiveStrategy | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [strategyLoading, setStrategyLoading] = useState(false)
  const [discovered, setDiscovered] = useState<DiscoveredCompetitor[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [competitors, setCompetitors] = useState<CompetitorForm[]>([emptyForm()])
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([])
  const [reportSnapshot, setReportSnapshot] = useState<CompetitorSnapshot | null>(null)
  const [report, setReport] = useState<CompetitorReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const loadSnapshots = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.intelligence.get(params.projectId)
      setSnapshots(data.snapshots ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [params.projectId])

  useEffect(() => {
    if (params.projectId) loadSnapshots()
  }, [params.projectId, loadSnapshots])

  // ---------------------------------------------------------------------------
  // Animated progress for analysis
  // ---------------------------------------------------------------------------

  function buildProgressSteps(comps: CompetitorForm[]): ProgressStep[] {
    const steps: ProgressStep[] = []
    for (const c of comps) {
      if (c.instagram) steps.push({ id: `${c.name}-ig`,  label: `${c.name} — Instagram`,  status: 'pending' })
      if (c.facebook)  steps.push({ id: `${c.name}-fb`,  label: `${c.name} — Facebook`,   status: 'pending' })
      if (c.tiktok)    steps.push({ id: `${c.name}-tt`,  label: `${c.name} — TikTok`,     status: 'pending' })
      if (c.linkedin)  steps.push({ id: `${c.name}-li`,  label: `${c.name} — LinkedIn`,   status: 'pending' })
      if (c.youtube)   steps.push({ id: `${c.name}-yt`,  label: `${c.name} — YouTube`,    status: 'pending' })
    }
    steps.push({ id: 'analyse', label: 'Analysing with Claude AI', status: 'pending' })
    steps.push({ id: 'save',    label: 'Saving intelligence',      status: 'pending' })
    return steps
  }

  async function runProgressAnimation(steps: ProgressStep[], totalMs: number) {
    const interval = totalMs / (steps.length + 1)
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, interval * 0.2))
      setProgressSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'active' } : s))
      await new Promise(r => setTimeout(r, interval * 0.8))
      setProgressSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s))
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleRefresh() {
    const valid = competitors.filter(c => c.name.trim())
    if (valid.length === 0) {
      toast.error('Add at least one competitor name.')
      return
    }
    const hasAnyPlatform = valid.some(c =>
      c.instagram || c.facebook || c.tiktok || c.linkedin || c.youtube || c.website
    )
    if (!hasAnyPlatform) {
      toast.error('Add at least one platform handle or URL for a competitor.')
      return
    }

    setRefreshing(true)
    setShowAddForm(false)
    const steps = buildProgressSteps(valid)
    setProgressSteps(steps)

    // Estimate ~20s per competitor platform, kick off animation
    const estimatedMs = valid.reduce((acc, c) => {
      const platforms = [c.instagram, c.facebook, c.tiktok, c.linkedin, c.youtube].filter(Boolean).length
      return acc + platforms * 20_000
    }, 5_000)

    const animPromise = runProgressAnimation(steps, estimatedMs)

    try {
      const result = await api.intelligence.refresh(
        params.projectId,
        valid.map(c => ({
          name: c.name.trim(),
          website:   c.website.trim()   || undefined,
          instagram: c.instagram.trim() || undefined,
          facebook:  c.facebook.trim()  || undefined,
          tiktok:    c.tiktok.trim()    || undefined,
          linkedin:  c.linkedin.trim()  || undefined,
          youtube:   c.youtube.trim()   || undefined,
        })),
      )

      // Complete all remaining steps instantly
      setProgressSteps(prev => prev.map(s => ({ ...s, status: 'done' })))
      await new Promise(r => setTimeout(r, 500))

      toast.success(`Analysed ${(result.refreshed ?? []).length} competitor(s).`)
      setProgressSteps([])
      setCompetitors([emptyForm()])
      await loadSnapshots()
      setStrategy(null) // invalidate cached strategy
    } catch (err) {
      setProgressSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s))
      await new Promise(r => setTimeout(r, 800))
      setProgressSteps([])
      toast.error('Analysis failed. Check handles and try again.')
      console.error(err)
    } finally {
      setRefreshing(false)
      void animPromise
    }
  }

  async function handleDiscover() {
    setDiscovering(true)
    setDiscovered([])
    try {
      const result = await api.seoIntel.discoverCompetitors(params.projectId)
      const found = result.competitors ?? []
      setDiscovered(found)
      if (found.length === 0) {
        toast.info('No competitors found automatically. Add them manually.')
      }
    } catch {
      toast.error('Auto-discovery requires an Exa API key.')
    } finally {
      setDiscovering(false)
    }
  }

  async function handleGenerateStrategy() {
    setStrategyLoading(true)
    setTab('strategy')
    try {
      const result = await api.intelligence.strategy(params.projectId)
      setStrategy(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('400')) {
        toast.error('Run competitor analysis first before generating a strategy.')
      } else {
        toast.error('Strategy generation failed.')
      }
      setTab('snapshots')
    } finally {
      setStrategyLoading(false)
    }
  }

  async function handleOpenReport(snapshot: CompetitorSnapshot) {
    setReportSnapshot(snapshot)
    setReport(null)
    setReportLoading(true)
    try {
      const result = await api.intelligence.report(params.projectId, snapshot.name)
      setReport(result)
    } catch (err) {
      toast.error('Could not generate report. Try again.')
      console.error(err)
    } finally {
      setReportLoading(false)
    }
  }

  function addDiscoveredCompetitor(c: DiscoveredCompetitor) {
    let name = c.name
    if (!name) {
      try { name = new URL(c.url).hostname.replace('www.', '') } catch { name = c.url }
    }
    setCompetitors(prev => {
      const empty = prev.find(p => !p.name.trim())
      if (empty) return prev.map(p => !p.name.trim() ? { ...p, name, website: c.url } : p)
      return [...prev, { ...emptyForm(), name, website: c.url }]
    })
    setShowAddForm(true)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Top bar ── */}
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
          <button
            onClick={() => router.push(`/projects/${params.projectId}/intelligence/monitoring`)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bell className="w-3.5 h-3.5" /> Monitoring
          </button>
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            {discovering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {discovering ? 'Discovering…' : 'Auto-discover'}
          </button>
          {snapshots.length > 0 && (
            <button
              onClick={handleGenerateStrategy}
              disabled={strategyLoading}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs border border-violet-500/30 text-violet-400 rounded-md hover:bg-violet-500/10 disabled:opacity-50 transition-colors"
            >
              {strategyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {strategyLoading ? 'Generating…' : 'Strategy Plan'}
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Competitors
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Add competitor form ── */}
        {showAddForm && (
          <AddCompetitorForm
            competitors={competitors}
            setCompetitors={setCompetitors}
            onClose={() => setShowAddForm(false)}
            onSubmit={handleRefresh}
            refreshing={refreshing}
          />
        )}

        {/* ── Progress overlay ── */}
        {refreshing && progressSteps.length > 0 && (
          <ProgressPanel steps={progressSteps} />
        )}

        {/* ── Auto-discovered suggestions ── */}
        {!refreshing && discovered.length > 0 && (
          <DiscoveredBanner discovered={discovered} onAdd={addDiscoveredCompetitor} onDismiss={() => setDiscovered([])} />
        )}

        {/* ── Tabs ── */}
        {!refreshing && snapshots.length > 0 && (
          <div className="flex gap-1 px-4 sm:px-6 pt-4 border-b border-border">
            {(['snapshots', 'strategy'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => {
                  if (t === 'strategy' && !strategy && !strategyLoading) handleGenerateStrategy()
                  else setTab(t)
                }}
                className={`px-4 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors ${
                  tab === t
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'snapshots' ? 'Competitor Profiles' : 'Strategy Plan'}
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : snapshots.length === 0 && !refreshing ? (
          <EmptyState onAdd={() => setShowAddForm(true)} />
        ) : tab === 'snapshots' ? (
          <div className="px-4 sm:px-6 py-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
            {snapshots.map(snapshot => (
              <CompetitorCard key={snapshot.id} snapshot={snapshot} onOpenReport={handleOpenReport} />
            ))}
          </div>
        ) : (
          <StrategyPanel
            strategy={strategy}
            loading={strategyLoading}
            onRegenerate={handleGenerateStrategy}
          />
        )}
      </div>

      {reportSnapshot && (
        <CompetitorReportPanel
          snapshot={reportSnapshot}
          report={report}
          loading={reportLoading}
          onClose={() => { setReportSnapshot(null); setReport(null) }}
          onRegenerate={() => handleOpenReport(reportSnapshot)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Competitor Form
// ---------------------------------------------------------------------------

function AddCompetitorForm({
  competitors,
  setCompetitors,
  onClose,
  onSubmit,
  refreshing,
}: {
  competitors: CompetitorForm[]
  setCompetitors: React.Dispatch<React.SetStateAction<CompetitorForm[]>>
  onClose: () => void
  onSubmit: () => void
  refreshing: boolean
}) {
  function update(i: number, field: keyof CompetitorForm, val: string) {
    setCompetitors(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c))
  }
  function remove(i: number) {
    setCompetitors(prev => prev.filter((_, j) => j !== i))
  }
  function addRow() {
    setCompetitors(prev => [...prev, emptyForm()])
  }

  return (
    <div className="border-b border-border bg-muted/20 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Add competitors to analyse</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add handles and URLs for each platform you want tracked
          </p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {competitors.map((comp, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <input
                value={comp.name}
                onChange={e => update(i, 'name', e.target.value)}
                placeholder="Competitor brand name *"
                className="text-sm font-medium bg-transparent focus:outline-none placeholder:text-muted-foreground/50 flex-1"
              />
              {competitors.length > 1 && (
                <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { field: 'website',   icon: <Globe className="w-3 h-3" />,      placeholder: 'Website URL',        color: 'text-emerald-500' },
                { field: 'instagram', icon: <Instagram className="w-3 h-3" />,  placeholder: '@instagram_handle',  color: 'text-pink-500'    },
                { field: 'facebook',  icon: <Facebook className="w-3 h-3" />,   placeholder: 'Facebook page URL',  color: 'text-blue-500'    },
                { field: 'tiktok',    icon: <Activity className="w-3 h-3" />,   placeholder: 'TikTok profile URL', color: 'text-foreground'  },
                { field: 'linkedin',  icon: <Linkedin className="w-3 h-3" />,   placeholder: 'LinkedIn company URL', color: 'text-sky-500'   },
                { field: 'youtube',   icon: <Youtube className="w-3 h-3" />,    placeholder: 'YouTube channel URL', color: 'text-red-500'   },
              ].map(({ field, icon, placeholder, color }) => (
                <div key={field} className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5">
                  <span className={color}>{icon}</span>
                  <input
                    value={comp[field as keyof CompetitorForm]}
                    onChange={e => update(i, field as keyof CompetitorForm, e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 text-xs bg-transparent focus:outline-none placeholder:text-muted-foreground/40 min-w-0"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        {competitors.length < 5 && (
          <button
            onClick={addRow}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add another competitor
          </button>
        )}
        <button
          onClick={onSubmit}
          disabled={refreshing}
          className="ml-auto flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {refreshing ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing…</>
          ) : (
            <><Zap className="w-3.5 h-3.5" /> Run Analysis</>
          )}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Progress Panel
// ---------------------------------------------------------------------------

function ProgressPanel({ steps }: { steps: ProgressStep[] }) {
  return (
    <div className="mx-4 sm:mx-6 my-6 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm font-semibold">Analysing competitors…</span>
        <span className="text-xs text-muted-foreground ml-1">This takes 1–3 minutes</span>
      </div>
      <div className="space-y-2">
        {steps.map(step => (
          <div key={step.id} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
              step.status === 'done'   ? 'bg-emerald-500/20 text-emerald-500' :
              step.status === 'active' ? 'bg-primary/20 text-primary' :
              step.status === 'error'  ? 'bg-red-500/20 text-red-500' :
              'bg-muted text-muted-foreground/30'
            }`}>
              {step.status === 'done'   ? <CheckCircle2 className="w-3.5 h-3.5" /> :
               step.status === 'active' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
               step.status === 'error'  ? <X className="w-3.5 h-3.5" /> :
               <Clock className="w-3 h-3" />}
            </div>
            <span className={`text-xs transition-all ${
              step.status === 'done'   ? 'text-foreground/60 line-through' :
              step.status === 'active' ? 'text-foreground font-medium' :
              step.status === 'error'  ? 'text-red-500' :
              'text-muted-foreground/40'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Discovered Banner
// ---------------------------------------------------------------------------

function DiscoveredBanner({
  discovered,
  onAdd,
  onDismiss,
}: {
  discovered: DiscoveredCompetitor[]
  onAdd: (c: DiscoveredCompetitor) => void
  onDismiss: () => void
}) {
  return (
    <div className="mx-4 sm:mx-6 mt-4 rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Auto-discovered competitors — click to add
        </p>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {discovered.map((c, i) => (
          <button
            key={i}
            onClick={() => onAdd(c)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs hover:border-primary/50 hover:bg-primary/5 transition-colors"
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
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
        <BarChart2 className="w-8 h-8 text-muted-foreground/40" />
      </div>
      <h2 className="text-lg font-semibold mb-2">No competitor intelligence yet</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Add your competitors&apos; social handles and LEO will analyse their content,
        identify their strategy, and surface opportunities they&apos;re missing.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add your first competitor
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Competitor Card
// ---------------------------------------------------------------------------

function CompetitorCard({ snapshot, onOpenReport }: { snapshot: CompetitorSnapshot; onOpenReport: (s: CompetitorSnapshot) => void }) {
  const [expanded, setExpanded] = useState(true)
  const { analysis, web_analysis } = snapshot
  const platforms = Object.keys(snapshot.platforms || {})

  const scrapedDate = snapshot.scrapedAt
    ? new Date(snapshot.scrapedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="border border-border rounded-2xl bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-5 py-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {snapshot.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold">{snapshot.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {platforms.map(p => (
                <span key={p} className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[p] ?? 'text-muted-foreground bg-muted'}`}>
                  {PLATFORM_ICONS[p]} {p}
                </span>
              ))}
              {scrapedDate && <span className="text-[10px] text-muted-foreground">· {scrapedDate}</span>}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <div className="px-4 pb-3 border-b border-border">
        <button
          onClick={() => onOpenReport(snapshot)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
        >
          <BarChart2 className="w-3.5 h-3.5" />
          View Deep-Dive Report
        </button>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border">
          {/* Web intelligence banner */}
          {web_analysis?.market_position && (
            <div className="mt-4 rounded-lg bg-blue-500/5 border border-blue-500/20 px-3 py-2.5 flex items-start gap-2">
              <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-blue-400 mb-0.5">Market Position</p>
                <p className="text-xs text-foreground/80">{web_analysis.market_position}</p>
                {web_analysis.opportunity && (
                  <p className="text-xs text-emerald-400 mt-1">→ {web_analysis.opportunity}</p>
                )}
              </div>
            </div>
          )}

          {analysis && (
            <>
              {/* Tone */}
              {analysis.tone && analysis.tone !== 'Unknown' && (
                <div className="pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Their Voice</p>
                  <p className="text-sm text-foreground/80">{analysis.tone}</p>
                </div>
              )}

              {/* Key themes */}
              {(analysis.key_themes?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Key Themes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.key_themes.map((theme, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border text-foreground/70">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Opportunities */}
              {(analysis.content_gaps?.length ?? 0) > 0 && (
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Opportunities They&apos;re Missing
                  </div>
                  <ul className="space-y-1">
                    {analysis.content_gaps.map((gap, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex gap-2">
                        <ArrowRight className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {(analysis.strengths?.length ?? 0) > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">
                      <TrendingUp className="w-3 h-3" /> They do well
                    </div>
                    <ul className="space-y-1">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-foreground/70">· {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(analysis.weaknesses?.length ?? 0) > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2">
                      <AlertTriangle className="w-3 h-3" /> Weaknesses
                    </div>
                    <ul className="space-y-1">
                      {analysis.weaknesses.map((w, i) => (
                        <li key={i} className="text-xs text-foreground/70">· {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Hashtags */}
              {(analysis.top_hashtags?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Top Hashtags</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.top_hashtags.slice(0, 12).map((tag, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        #{tag.replace(/^#/, '')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Strategy Panel
// ---------------------------------------------------------------------------

function StrategyPanel({
  strategy,
  loading,
  onRegenerate,
}: {
  strategy: CompetitiveStrategy | null
  loading: boolean
  onRegenerate: () => void
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-violet-400" />
        <p className="text-sm text-muted-foreground">Generating strategy plan…</p>
        <p className="text-xs text-muted-foreground/60">Comparing your brand against all competitors</p>
      </div>
    )
  }

  if (!strategy) return null

  return (
    <div className="px-4 sm:px-6 py-5 space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Competitive Strategy Plan</h2>
          <p className="text-xs text-muted-foreground mt-0.5">AI-generated from competitor analysis</p>
        </div>
        <button
          onClick={onRegenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Regenerate
        </button>
      </div>

      {/* Executive Summary */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Executive Summary</h3>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">{strategy.executive_summary}</p>

        {strategy.brand_position?.differentiation && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium mb-1">Your differentiation</p>
            <p className="text-sm text-foreground/80">{strategy.brand_position.differentiation}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4">
          {(strategy.brand_position?.strengths?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">Your Strengths</p>
              <ul className="space-y-1">
                {strategy.brand_position.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(strategy.brand_position?.vulnerabilities?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-2">Vulnerabilities</p>
              <ul className="space-y-1">
                {strategy.brand_position.vulnerabilities.map((v, i) => (
                  <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />{v}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Quick wins */}
      {(strategy.quick_wins?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-amber-500">Quick Wins — Do This Week</h3>
          </div>
          <ul className="space-y-2">
            {strategy.quick_wins.map((win, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {win}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Competitor breakdown */}
      {(strategy.competitor_breakdown?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Swords className="w-3.5 h-3.5" /> Competitor Breakdown
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {strategy.competitor_breakdown.map((comp, i) => {
              const threat = THREAT_CONFIG[comp.threat_level] ?? THREAT_CONFIG.medium
              return (
                <div key={i} className={`rounded-xl border p-4 ${threat.bg}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-background/50 flex items-center justify-center text-xs font-bold">
                        {comp.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold">{comp.name}</span>
                    </div>
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-background/40 ${threat.color}`}>
                      {threat.icon} {threat.label}
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">What they do better</p>
                      <p className="text-foreground/80">{comp.what_they_do_better}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Their weakness</p>
                      <p className="text-foreground/80">{comp.their_weakness}</p>
                    </div>
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">How to beat them</p>
                      <p className="text-foreground/80">{comp.how_to_beat_them}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Battlegrounds */}
      {(strategy.battlegrounds?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" /> Content Battlegrounds
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {strategy.battlegrounds.map((b, i) => {
              const pos = POSITION_CONFIG[b.our_position] ?? POSITION_CONFIG.competitive
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{b.area}</span>
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${pos.bg} ${pos.color}`}>
                      {pos.icon} {pos.label}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/70">{b.recommendation}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Action Plan */}
      {(strategy.action_plan?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Target className="w-3.5 h-3.5" /> Action Plan
          </h3>
          <div className="space-y-2">
            {strategy.action_plan.map((action, i) => {
              const p = PRIORITY_CONFIG[action.priority] ?? PRIORITY_CONFIG.short_term
              return (
                <div key={i} className={`rounded-xl border ${p.border} bg-card p-4`}>
                  <div className="flex items-start gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${p.bg} ${p.color}`}>
                      {p.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{action.action}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{action.rationale}</p>
                      {action.expected_impact && (
                        <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> {action.expected_impact}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
