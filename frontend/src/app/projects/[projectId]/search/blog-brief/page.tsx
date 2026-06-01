'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FileText, Search, ChevronRight, AlertTriangle, CheckCircle, Loader2, ExternalLink, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { api, type BlogSERPAnalysis, type BlogBrief } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'
import { cn } from '@/lib/utils'

type Step = 'keyword' | 'serp' | 'brief' | 'done'

interface StepProgress {
  label: string
  status: 'running' | 'done' | 'skipped'
}

const LOCATIONS = [
  { label: 'United States', code: 2840 },
  { label: 'United Kingdom', code: 2826 },
  { label: 'Canada', code: 2124 },
  { label: 'Australia', code: 2036 },
]

function StepBadge({ status }: { status: StepProgress['status'] }) {
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
  if (status === 'done') return <CheckCircle className="w-3.5 h-3.5 text-green-500" />
  return <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30" />
}

function ProgressPanel({ steps }: { steps: StepProgress[] }) {
  if (steps.length === 0) return null
  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <StepBadge status={s.status} />
          <span className={cn('text-xs', s.status === 'running' ? 'text-foreground' : 'text-muted-foreground')}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function BlogBriefPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()

  const [step, setStep] = useState<Step>('keyword')
  const [keyword, setKeyword] = useState('')
  const [locationCode, setLocationCode] = useState(2840)
  const [serpSteps, setSerpSteps] = useState<StepProgress[]>([])
  const [briefSteps, setBriefSteps] = useState<StepProgress[]>([])
  const [serpAnalysis, setSerpAnalysis] = useState<BlogSERPAnalysis | null>(null)
  const [brief, setBrief] = useState<BlogBrief | null>(null)
  const [cannibalizationWarning, setCannibalizationWarning] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  function upsertStep(
    steps: StepProgress[],
    setSteps: (fn: (prev: StepProgress[]) => StepProgress[]) => void,
    label: string,
    status: StepProgress['status'],
  ) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.label === label)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { label, status }
        return next
      }
      return [...prev, { label, status }]
    })
  }

  async function runSERPAnalysis() {
    if (!keyword.trim()) { toast.error('Enter a target keyword'); return }
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setSerpSteps([])
    setSerpAnalysis(null)
    setIsStreaming(true)
    setStep('serp')

    try {
      await api.blog.streamSERPAnalysis(
        projectId,
        keyword.trim(),
        locationCode,
        {
          onStep: (label, status) =>
            upsertStep(serpSteps, setSerpSteps, label, status as StepProgress['status']),
          onDone: (analysis) => {
            setSerpAnalysis(analysis)
            setIsStreaming(false)
          },
          onError: (msg) => {
            toast.error(msg)
            setIsStreaming(false)
            setStep('keyword')
          },
        },
        abortRef.current.signal,
      )
    } catch {
      setIsStreaming(false)
      setStep('keyword')
    }
  }

  async function runBriefGeneration() {
    if (!serpAnalysis) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setBriefSteps([])
    setBrief(null)
    setCannibalizationWarning(null)
    setIsStreaming(true)
    setStep('brief')

    try {
      await api.blog.streamBrief(
        projectId,
        keyword.trim(),
        serpAnalysis,
        locationCode,
        {
          onStep: (label, status) =>
            upsertStep(briefSteps, setBriefSteps, label, status as StepProgress['status']),
          onCannibalizationWarning: (w) => setCannibalizationWarning(w),
          onDone: (b) => {
            setBrief(b)
            setIsStreaming(false)
            setStep('done')
          },
          onError: (msg) => {
            toast.error(msg)
            setIsStreaming(false)
          },
        },
        abortRef.current.signal,
      )
    } catch {
      setIsStreaming(false)
    }
  }

  function goToDraft() {
    if (!brief) return
    router.push(`/projects/${projectId}/seo?brief_id=${brief.id}`)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <div className="text-primary"><FileText className="w-5 h-5" /></div>
        <div>
          <h1 className="font-semibold text-sm">Blog Content Brief</h1>
          <p className="text-xs text-muted-foreground">SERP-grounded brief for long-form SEO content</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl mx-auto w-full">

        {/* Step 1: Keyword Input */}
        <div className={cn('rounded-xl border p-5 space-y-4 transition-opacity', step !== 'keyword' && !serpAnalysis && 'opacity-50')}>
          <div className="flex items-center gap-2">
            <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
              step === 'keyword' ? 'bg-primary text-primary-foreground' : 'bg-green-500 text-white')}>
              {step === 'keyword' ? '1' : '✓'}
            </div>
            <h2 className="font-semibold text-sm">Target Keyword</h2>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isStreaming && runSERPAnalysis()}
              placeholder="e.g. email marketing for SaaS"
              disabled={isStreaming}
              className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <select
              value={locationCode}
              onChange={(e) => setLocationCode(Number(e.target.value))}
              disabled={isStreaming}
              className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {LOCATIONS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>

          <button
            onClick={runSERPAnalysis}
            disabled={isStreaming || !keyword.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming && step === 'serp' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analysing SERP…</>
            ) : (
              <><Search className="w-4 h-4" /> Analyse SERP</>
            )}
          </button>

          {step === 'serp' && <ProgressPanel steps={serpSteps} />}
        </div>

        {/* Step 2: SERP Analysis Results */}
        {serpAnalysis && (
          <div className="rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                step === 'done' ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground')}>
                {step === 'done' ? '✓' : '2'}
              </div>
              <h2 className="font-semibold text-sm">SERP Analysis</h2>
              <span className="text-xs text-muted-foreground ml-auto">{serpAnalysis.pages_analysed} pages analysed</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-lg font-bold">{serpAnalysis.recommended_word_count.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Target words</p>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-lg font-bold">{serpAnalysis.consensus_h2s.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Consensus H2s</p>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-lg font-bold">{serpAnalysis.nlp_terms_required.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Required NLP terms</p>
              </div>
            </div>

            {serpAnalysis.content_gap && (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">Content Gap</p>
                <p className="text-xs text-amber-800 dark:text-amber-300">{serpAnalysis.content_gap}</p>
              </div>
            )}

            {serpAnalysis.consensus_h2s.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Consensus H2 Structure</p>
                <div className="space-y-1">
                  {serpAnalysis.consensus_h2s.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground font-mono">H2</span>
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {serpAnalysis.nlp_terms_required.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Required NLP Terms</p>
                <div className="flex flex-wrap gap-1.5">
                  {serpAnalysis.nlp_terms_required.map((t, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-muted rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {serpAnalysis.competing_urls.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Top Competing Pages</p>
                <div className="space-y-1.5">
                  {serpAnalysis.competing_urls.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-muted-foreground font-mono shrink-0">{i + 1}.</span>
                      <div className="min-w-0">
                        <a href={c.url} target="_blank" rel="noreferrer"
                          className="font-medium hover:text-primary flex items-center gap-1 truncate">
                          {c.title || c.url} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        <p className="text-muted-foreground">{c.weakness}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={runBriefGeneration}
              disabled={isStreaming}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStreaming && step === 'brief' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating brief…</>
              ) : (
                <><FileText className="w-4 h-4" /> Generate Content Brief <ChevronRight className="w-3.5 h-3.5" /></>
              )}
            </button>

            {step === 'brief' && <ProgressPanel steps={briefSteps} />}
          </div>
        )}

        {/* Cannibalization Warning */}
        {cannibalizationWarning && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-900/20">
            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Cannibalization Warning</p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">{cannibalizationWarning}</p>
            </div>
          </div>
        )}

        {/* Step 3: Brief Results */}
        {brief && (
          <div className="rounded-xl border border-green-200 dark:border-green-900/40 p-5 space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-[11px] font-bold">✓</div>
              <h2 className="font-semibold text-sm">Content Brief Ready</h2>
            </div>

            {/* Title Options */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Title Options</p>
              <div className="space-y-1.5">
                {brief.title_options.map((t, i) => (
                  <div key={i} className={cn(
                    'p-2.5 rounded-lg border text-xs',
                    i === 0 ? 'border-primary bg-primary/5 font-medium' : 'border-border bg-card',
                  )}>
                    {i === 0 && <span className="text-[9px] font-bold text-primary uppercase tracking-wide mr-1.5">Primary</span>}
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Angles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Content Angle</p>
                <p className="text-xs">{brief.content_angle}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Brand Angle</p>
                <p className="text-xs">{brief.brand_angle}</p>
              </div>
            </div>

            {/* H2 Structure */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Content Structure — {brief.recommended_word_count.toLocaleString()} words
              </p>
              <div className="space-y-2">
                {brief.h2_structure.map((section, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                    <span className="text-xs font-mono text-muted-foreground shrink-0 w-6">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-xs font-semibold">## {section.heading}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">~{section.word_target}w</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{section.purpose}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NLP Terms */}
            {brief.nlp_terms_required.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Required NLP Terms</p>
                <div className="flex flex-wrap gap-1.5">
                  {brief.nlp_terms_required.map((t, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            {brief.cta_suggestion && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">CTA Direction</p>
                <p className="text-xs">{brief.cta_suggestion}</p>
              </div>
            )}

            {/* Go to Draft */}
            <button
              onClick={goToDraft}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90"
            >
              <FileText className="w-4 h-4" />
              Draft with this Brief
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
