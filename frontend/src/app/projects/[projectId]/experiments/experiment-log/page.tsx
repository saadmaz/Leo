'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { ClipboardList, Plus, ChevronDown, ChevronUp, Trash2, Edit2, Check, X, Zap, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SidebarToggle } from '@/components/layout/sidebar'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePillar10Store } from '@/stores/pillar10-store'
import type { ProgressStep } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  planned:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  running:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  concluded:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paused:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  cancelled:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STATUSES = ['planned', 'running', 'paused', 'concluded', 'cancelled']

interface Experiment {
  id: string
  name: string
  hypothesis: string
  control_description: string
  variant_description: string
  metric: string
  status: string
  winner?: string
  lift_achieved?: string
  learnings?: string
  channel?: string
  created_at?: string
}

function ExperimentCard({ exp, onUpdate, onDelete }: {
  exp: Experiment
  onUpdate: (id: string, patch: Partial<Experiment>) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState(exp.status)
  const [winner, setWinner] = useState(exp.winner ?? '')
  const [lift, setLift] = useState(exp.lift_achieved ?? '')
  const [learnings, setLearnings] = useState(exp.learnings ?? '')

  async function save() {
    await onUpdate(exp.id, { status, winner: winner || undefined, lift_achieved: lift || undefined, learnings: learnings || undefined })
    setEditing(false)
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <button onClick={() => setExpanded((v) => !v)} className="mt-0.5 text-muted-foreground hover:text-primary shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold truncate">{exp.name}</p>
              {exp.channel && <p className="text-[10px] text-muted-foreground">{exp.channel}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize', STATUS_COLORS[exp.status] ?? 'bg-muted text-muted-foreground')}>
                {exp.status}
              </span>
              <button onClick={() => setEditing((v) => !v)} className="text-muted-foreground hover:text-primary">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(exp.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{exp.hypothesis}</p>

          {exp.status === 'concluded' && exp.winner && (
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="text-green-600 dark:text-green-400 font-medium">Winner: {exp.winner}</span>
              {exp.lift_achieved && <span className="text-muted-foreground">Lift: {exp.lift_achieved}</span>}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-medium text-muted-foreground mb-0.5">Control</p>
              <p>{exp.control_description}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-0.5">Variant</p>
              <p>{exp.variant_description}</p>
            </div>
          </div>
          <div className="text-xs">
            <p className="font-medium text-muted-foreground mb-0.5">Primary Metric</p>
            <p>{exp.metric}</p>
          </div>
          {exp.learnings && (
            <div className="text-xs">
              <p className="font-medium text-muted-foreground mb-0.5">Learnings</p>
              <p className="text-muted-foreground">{exp.learnings}</p>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Update Experiment</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Winner</label>
              <input value={winner} onChange={(e) => setWinner(e.target.value)} placeholder="e.g. Variant B"
                className="mt-1 w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Lift Achieved</label>
            <input value={lift} onChange={(e) => setLift(e.target.value)} placeholder="e.g. +12% conversion rate"
              className="mt-1 w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Learnings</label>
            <textarea value={learnings} onChange={(e) => setLearnings(e.target.value)} rows={2}
              placeholder="What did you learn from this experiment?"
              className="mt-1 w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>

          <div className="flex gap-2">
            <button onClick={save} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              <Check className="w-3 h-3" /> Save
            </button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted">
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [control, setControl] = useState('')
  const [variant, setVariant] = useState('')
  const [metric, setMetric] = useState('')
  const [channel, setChannel] = useState('')
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!name.trim() || !hypothesis.trim() || !control.trim() || !variant.trim() || !metric.trim()) {
      toast.error('Fill in all required fields')
      return
    }
    setSaving(true)
    try {
      await api.pillar10.createExperiment(projectId, {
        name: name.trim(),
        hypothesis: hypothesis.trim(),
        control_description: control.trim(),
        variant_description: variant.trim(),
        metric: metric.trim(),
        channel: channel.trim() || undefined,
        status: 'planned',
      })
      toast.success('Experiment logged!')
      setName(''); setHypothesis(''); setControl(''); setVariant(''); setMetric(''); setChannel('')
      setOpen(false)
      onCreated()
    } catch {
      toast.error('Failed to save experiment')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
        <Plus className="w-4 h-4" /> Log Experiment
      </button>
    )
  }

  return (
    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">New Experiment</p>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-primary"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Experiment Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Homepage CTA Button Colour"
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Channel</label>
          <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="e.g. Landing page, Email, Ads"
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Hypothesis *</label>
        <textarea value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} rows={2}
          placeholder="If we [change X], then [metric Y] will improve by [Z%] because [reasoning]"
          className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Control *</label>
          <input value={control} onChange={(e) => setControl(e.target.value)} placeholder="Current version"
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Variant *</label>
          <input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="New version being tested"
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Primary Metric *</label>
        <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="e.g. Conversion rate, Click-through rate"
          className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      <button onClick={create} disabled={saving}
        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Experiment'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Learning Propagation (Insights tab)
// ---------------------------------------------------------------------------

const PROPAGATION_CHANNELS = [
  'landing_pages', 'email_campaigns', 'paid_ads', 'social_content',
  'blog_posts', 'sales_enablement', 'onboarding_flows', 'pricing_page',
]

const PRIORITY_COLORS: Record<string, string> = {
  high:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  low:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
}

interface PropagationResult {
  experiments_analysed: number
  winning_themes: string[]
  losing_themes: string[]
  propagation_actions: { action: string; channel: string; rationale: string; priority: string; effort: string; expected_impact: string }[]
  quick_wins: string[]
  long_term_plays: string[]
  meta_learnings: string[]
  propagation_summary: string
}

function InsightsTab({ projectId }: { projectId: string }) {
  const store = usePillar10Store()
  const abortRef = useRef<AbortController | null>(null)
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['landing_pages', 'email_campaigns', 'paid_ads'])
  const [focusArea, setFocusArea] = useState('')
  const [result, setResult] = useState<PropagationResult | null>(null)

  function toggleChannel(c: string) {
    setSelectedChannels((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])
  }

  async function generate() {
    if (selectedChannels.length === 0) { toast.error('Select at least one channel'); return }
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    store.setIsStreaming(true)
    store.clearSteps()
    store.clearStreamText()
    setResult(null)
    try {
      await api.pillar10.streamLearningPropagation(projectId,
        { propagation_channels: selectedChannels, focus_area: focusArea.trim() || undefined },
        {
          onStep: (step, label, status) => store.upsertStep(step, label, status as ProgressStep['status']),
          onDelta: (text) => store.appendStreamText(text),
          onSaved: (_id, payload) => { setResult(payload as unknown as PropagationResult); store.clearStreamText(); store.setIsStreaming(false); toast.success('Propagation plan ready!') },
          onError: (msg) => { toast.error(msg); store.setIsStreaming(false) },
          onDone: () => store.setIsStreaming(false),
        },
        abortRef.current.signal,
      )
    } catch { store.setIsStreaming(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="border border-border rounded-xl bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Learning Propagation</p>
        <p className="text-xs text-muted-foreground">Analyses all concluded experiments and generates a cross-channel action plan.</p>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Propagation Channels *</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {PROPAGATION_CHANNELS.map((c) => (
              <button key={c} onClick={() => toggleChannel(c)}
                className={cn('px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize',
                  selectedChannels.includes(c) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-primary/50')}>
                {c.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Focus Area (optional)</label>
          <input value={focusArea} onChange={(e) => setFocusArea(e.target.value)}
            placeholder="e.g. conversion rate, messaging clarity"
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <button onClick={generate} disabled={store.isStreaming || selectedChannels.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
          {store.isStreaming ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Zap className="w-4 h-4" /> Generate Propagation Plan — 20 credits</>}
        </button>

        {store.steps.length > 0 && (
          <div className="space-y-1.5">
            {store.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full shrink-0',
                  s.status === 'done' ? 'bg-green-500' : s.status === 'running' ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30')} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-4">
          {result.propagation_summary && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Summary</p>
              <p className="text-sm">{result.propagation_summary}</p>
              <p className="text-xs text-muted-foreground mt-1">{result.experiments_analysed} experiment{result.experiments_analysed !== 1 ? 's' : ''} analysed</p>
            </div>
          )}

          {(result.winning_themes?.length > 0 || result.losing_themes?.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {result.winning_themes?.length > 0 && (
                <div className="p-3 rounded-xl border border-green-500/30 bg-green-50/50 dark:bg-green-900/10">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">What's Working</p>
                  <ul className="space-y-1">{result.winning_themes.map((t, i) => <li key={i} className="text-xs text-muted-foreground">✓ {t}</li>)}</ul>
                </div>
              )}
              {result.losing_themes?.length > 0 && (
                <div className="p-3 rounded-xl border border-red-500/30 bg-red-50/50 dark:bg-red-900/10">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">What's Not Working</p>
                  <ul className="space-y-1">{result.losing_themes.map((t, i) => <li key={i} className="text-xs text-muted-foreground">✗ {t}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {result.quick_wins?.length > 0 && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Quick Wins (implement this week)</p>
              <ol className="space-y-1">
                {result.quick_wins.map((w, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-primary font-medium">{i + 1}.</span>{w}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {result.propagation_actions?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action Plan</p>
              {result.propagation_actions.map((a, i) => (
                <div key={i} className={cn('p-3 rounded-xl border', PRIORITY_COLORS[a.priority] ?? 'border-border bg-card')}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold capitalize">{a.channel.replace(/_/g, ' ')}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize border', PRIORITY_COLORS[a.priority] ?? 'bg-muted text-muted-foreground border-border')}>{a.priority} priority</span>
                      <span className="text-[10px] text-muted-foreground">Effort: {a.effort}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">Expected: {a.expected_impact}</span>
                  </div>
                  <p className="text-sm font-medium">{a.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.rationale}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExperimentLogPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [activeTab, setActiveTab] = useState<'log' | 'insights'>('log')
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')

  const load = useCallback(async () => {
    try {
      const data = await api.pillar10.listExperiments(projectId)
      setExperiments(data as Experiment[])
    } catch {
      toast.error('Failed to load experiments')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function handleUpdate(id: string, patch: Partial<Experiment>) {
    try {
      await api.pillar10.updateExperiment(projectId, id, patch)
      setExperiments((prev) => prev.map((e) => e.id === id ? { ...e, ...patch } : e))
      toast.success('Updated')
    } catch {
      toast.error('Update failed')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this experiment?')) return
    try {
      await api.pillar10.deleteExperiment(projectId, id)
      setExperiments((prev) => prev.filter((e) => e.id !== id))
      toast.success('Deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  const filtered = filterStatus === 'all' ? experiments : experiments.filter((e) => e.status === filterStatus)

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = experiments.filter((e) => e.status === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <div className="flex-1 flex items-center gap-3">
          <h1 className="font-semibold">Experiment Log</h1>
          <div className="flex items-center gap-1">
            {([
              { id: 'log',      label: 'Log',     icon: <ClipboardList className="w-3.5 h-3.5" /> },
              { id: 'insights', label: 'Insights', icon: <Zap className="w-3.5 h-3.5" /> },
            ] as { id: 'log' | 'insights'; label: string; icon: React.ReactNode }[]).map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={cn('flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  activeTab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'log' && <CreateForm projectId={projectId} onCreated={load} />}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'insights' ? (
          <InsightsTab projectId={projectId} />
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Status summary */}
            <div className="grid grid-cols-5 gap-2">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
                  className={cn('p-2 rounded-lg border text-center transition-colors',
                    filterStatus === s ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50')}>
                  <p className="text-lg font-bold">{counts[s] ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{s}</p>
                </button>
              ))}
            </div>

            {filterStatus !== 'all' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Showing: <span className="capitalize font-medium text-foreground">{filterStatus}</span></span>
                <button onClick={() => setFilterStatus('all')} className="text-xs text-primary hover:underline">Clear</button>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12 text-sm text-muted-foreground">Loading experiments…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <ClipboardList className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  {filterStatus === 'all' ? 'No experiments yet. Log your first one!' : `No ${filterStatus} experiments.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((exp) => (
                  <ExperimentCard key={exp.id} exp={exp} onUpdate={handleUpdate} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
