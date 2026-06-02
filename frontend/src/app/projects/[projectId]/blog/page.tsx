'use client'

import React, { useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  FileText, Search, Loader2, Sparkles, ChevronDown, ChevronUp,
  Globe, BarChart2, CheckCircle2,
  BookOpen, Target, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SidebarToggle } from '@/components/layout/sidebar'
import { api } from '@/lib/api'
import type { BlogSERPAnalysis, BlogBrief } from '@/lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'write' | 'score' | 'competitors'

interface ContentScore {
  combined_score: number
  seo_score: number
  geo_score: number
  aeo_score: number
  geo: {
    geo_score: number
    dimensions: Record<string, number>
    suggestions: { type: string; issue: string; fix: string }[]
    summary: string
  }
  aeo: {
    aeo_score: number
    dimensions: Record<string, number>
    faq_pairs: { question: string; answer: string }[]
    faq_schema: object
    suggested_questions: string[]
    suggestions: { type: string; issue: string; fix: string }[]
    summary: string
  }
  top_priorities: { title: string; body: string; score_area: string }[]
}

interface CompetitorAnalysis {
  competitors: {
    domain: string
    posts: { title: string; url: string }[]
    top_formats: string[]
    top_topics: string[]
    posting_frequency: string
    content_style: string
  }[]
  gap_opportunities: {
    topic: string
    angle: string
    why_now: string
    target_format: string
    priority: 'high' | 'medium' | 'low'
  }[]
  recommended_formats: string[]
  summary: string
}

// ---------------------------------------------------------------------------
// Score ring
// ---------------------------------------------------------------------------

function ScoreRing({ score, label, size = 64 }: { score: number; label: string; size?: number }) {
  const r = size * 0.4
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-border" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
          {score}
        </text>
      </svg>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score Panel
// ---------------------------------------------------------------------------

function ScorePanel({ score, loading }: { score: ContentScore | null; loading: boolean }) {
  const [showFaq, setShowFaq] = useState(false)
  const [showSchema, setShowSchema] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Scoring content…</span>
      </div>
    )
  }

  if (!score) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
        <BarChart2 className="w-7 h-7 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Paste content and click Score to analyse</p>
      </div>
    )
  }

  const priorityColor = { high: 'text-red-600', medium: 'text-amber-600', low: 'text-muted-foreground' }
  const areaColor = { SEO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', GEO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', AEO: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }

  return (
    <div className="space-y-4">
      {/* Score rings */}
      <div className="flex items-center justify-around py-3 bg-muted/30 rounded-xl border border-border">
        <ScoreRing score={score.combined_score} label="Combined" size={72} />
        <ScoreRing score={score.seo_score} label="SEO" size={56} />
        <ScoreRing score={score.geo_score} label="GEO" size={56} />
        <ScoreRing score={score.aeo_score} label="AEO" size={56} />
      </div>

      {/* GEO summary */}
      <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-900/40">
        <p className="text-xs font-semibold text-purple-800 dark:text-purple-300 mb-0.5">GEO — Generative Engine</p>
        <p className="text-xs text-purple-700 dark:text-purple-400 leading-relaxed">{score.geo.summary}</p>
      </div>

      {/* AEO summary */}
      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40">
        <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-0.5">AEO — Answer Engine</p>
        <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">{score.aeo.summary}</p>
      </div>

      {/* Top priorities */}
      {score.top_priorities.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top Fixes</p>
          {score.top_priorities.slice(0, 5).map((p, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', (areaColor as Record<string, string>)[p.score_area] ?? 'bg-muted text-muted-foreground')}>
                  {p.score_area}
                </span>
                <p className="text-xs font-medium">{p.title}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* FAQ pairs */}
      {score.aeo.faq_pairs?.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowFaq(!showFaq)}
            className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-semibold hover:bg-muted/40 transition-colors"
          >
            <span>Generated FAQ ({score.aeo.faq_pairs.length} Q&As)</span>
            {showFaq ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showFaq && (
            <div className="border-t border-border divide-y divide-border">
              {score.aeo.faq_pairs.map((faq, i) => (
                <div key={i} className="px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold">{faq.question}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* JSON-LD Schema */}
      {score.aeo.faq_schema && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowSchema(!showSchema)}
            className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-semibold hover:bg-muted/40 transition-colors"
          >
            <span>FAQ JSON-LD Schema</span>
            {showSchema ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showSchema && (
            <div className="border-t border-border">
              <pre className="px-4 py-3 text-[10px] font-mono text-muted-foreground overflow-x-auto bg-muted/20">
                {JSON.stringify(score.aeo.faq_schema, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Suggested PAA questions */}
      {score.aeo.suggested_questions?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">People Also Ask — Cover These</p>
          {score.aeo.suggested_questions.map((q, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-primary mt-0.5 shrink-0">→</span>
              <span>{q}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Write Tab — SERP analysis + brief + content editor with SEO/GEO/AEO score
// ---------------------------------------------------------------------------

function WriteTab({ projectId }: { projectId: string }) {
  const [keyword, setKeyword] = useState('')
  const [serpSteps, setSerpSteps] = useState<{ label: string; status: string }[]>([])
  const [serpAnalysis, setSerpAnalysis] = useState<BlogSERPAnalysis | null>(null)
  const [brief, setBrief] = useState<BlogBrief | null>(null)
  const [briefSteps, setBriefSteps] = useState<{ label: string; status: string }[]>([])
  const [content, setContent] = useState('')
  const [serpLoading, setSerpLoading] = useState(false)
  const [briefLoading, setBriefLoading] = useState(false)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [score, setScore] = useState<ContentScore | null>(null)
  const [step, setStep] = useState<'keyword' | 'serp' | 'brief' | 'write'>('keyword')
  const abortRef = useRef<AbortController | null>(null)

  function upsertStep(setter: React.Dispatch<React.SetStateAction<{ label: string; status: string }[]>>, label: string, status: string) {
    setter((prev) => {
      const idx = prev.findIndex((s) => s.label === label)
      if (idx >= 0) { const next = [...prev]; next[idx] = { label, status }; return next }
      return [...prev, { label, status }]
    })
  }

  async function handleSerpAnalysis() {
    if (!keyword.trim()) { toast.error('Enter a keyword first'); return }
    setSerpLoading(true)
    setSerpSteps([])
    setSerpAnalysis(null)
    setBrief(null)
    setStep('serp')
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      await api.blog.streamSERPAnalysis(projectId, keyword.trim(), 2840, {
        onStep: (label, status) => upsertStep(setSerpSteps, label, status),
        onDone: (analysis) => { setSerpAnalysis(analysis); setSerpLoading(false); setStep('brief') },
        onError: (err) => { toast.error(err); setSerpLoading(false); setStep('keyword') },
      }, abortRef.current.signal)
    } catch {
      setSerpLoading(false)
    }
  }

  async function handleBriefGeneration() {
    if (!serpAnalysis) { toast.error('Run SERP analysis first'); return }
    setBriefLoading(true)
    setBriefSteps([])
    setBrief(null)
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      await api.blog.streamBrief(projectId, keyword.trim(), serpAnalysis, 2840, {
        onStep: (label, status) => upsertStep(setBriefSteps, label, status),
        onDone: (b) => { setBrief(b); setBriefLoading(false); setStep('write') },
        onError: (err) => { toast.error(err); setBriefLoading(false) },
      }, abortRef.current.signal)
    } catch {
      setBriefLoading(false)
    }
  }

  async function handleScore() {
    if (!content.trim()) { toast.error('Paste some content to score'); return }
    if (!keyword.trim()) { toast.error('Enter a keyword first'); return }
    setScoreLoading(true)
    setScore(null)
    try {
      const result = await api.blog.scoreContent(projectId, content.trim(), keyword.trim())
      setScore(result)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setScoreLoading(false)
    }
  }

  return (
    <div className="flex gap-4 h-full overflow-hidden">
      {/* Left: Workflow panel */}
      <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto pb-4">

        {/* Step 1: Keyword + SERP */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
              step === 'keyword' ? 'bg-primary text-primary-foreground' : 'bg-green-500 text-white'
            )}>
              {step !== 'keyword' ? <CheckCircle2 className="w-3 h-3" /> : '1'}
            </div>
            <p className="text-sm font-semibold">Target Keyword</p>
          </div>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. best email marketing tools"
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSerpAnalysis() }}
          />
          <button
            onClick={handleSerpAnalysis}
            disabled={serpLoading || !keyword.trim()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {serpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {serpLoading ? 'Analysing SERP…' : 'Analyse SERP'}
          </button>
          {serpSteps.length > 0 && (
            <div className="space-y-1">
              {serpSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {s.status === 'done' ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" /> : <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                  {s.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SERP analysis summary */}
        {serpAnalysis && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SERP Insights</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">Target words:</span> {serpAnalysis.recommended_word_count?.toLocaleString()}</p>
              {serpAnalysis.consensus_h2s?.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-0.5">Must-cover sections:</p>
                  <ul className="space-y-0.5">
                    {serpAnalysis.consensus_h2s.slice(0, 5).map((h, i) => (
                      <li key={i} className="truncate">· {h}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Generate brief */}
        {(step === 'brief' || step === 'write') && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                step === 'brief' ? 'bg-primary text-primary-foreground' : 'bg-green-500 text-white'
              )}>
                {step === 'write' ? <CheckCircle2 className="w-3 h-3" /> : '2'}
              </div>
              <p className="text-sm font-semibold">Content Brief</p>
            </div>
            <button
              onClick={handleBriefGeneration}
              disabled={briefLoading || !serpAnalysis}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {briefLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {briefLoading ? 'Generating…' : brief ? 'Regenerate Brief' : 'Generate Brief'}
            </button>
            {briefSteps.length > 0 && (
              <div className="space-y-1">
                {briefSteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {s.status === 'done' ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" /> : <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                    {s.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Brief output */}
        {brief && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brief</p>
            <div className="space-y-2 text-xs text-muted-foreground">
              {brief.title_options?.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-1">Title Options</p>
                  {brief.title_options.slice(0, 3).map((t, i) => (
                    <p key={i} className="leading-snug mb-0.5">· {t}</p>
                  ))}
                </div>
              )}
              <p><span className="font-medium text-foreground">Angle:</span> {brief.content_angle}</p>
              <p><span className="font-medium text-foreground">Hook:</span> {brief.intro_hook}</p>
              {brief.h2_structure?.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-1">H2 Structure</p>
                  {brief.h2_structure.map((h, i) => (
                    <p key={i} className="leading-snug mb-0.5">· {h.heading} <span className="text-muted-foreground/60">({h.word_target}w)</span></p>
                  ))}
                </div>
              )}
              {brief.nlp_terms_required?.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-1">Required NLP Terms</p>
                  <div className="flex flex-wrap gap-1">
                    {brief.nlp_terms_required.slice(0, 10).map((t, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-muted text-[10px]">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Centre: Content editor */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Content Editor {content.trim() ? `· ${content.trim().split(/\s+/).length} words` : ''}
          </p>
          <button
            onClick={handleScore}
            disabled={scoreLoading || !content.trim() || !keyword.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {scoreLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart2 className="w-3.5 h-3.5" />}
            Score SEO/GEO/AEO
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste or write your blog post here, then click Score…"
          className="flex-1 w-full text-sm bg-card border border-border rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Right: Score panel */}
      <div className="w-72 shrink-0 flex flex-col overflow-y-auto pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Score</p>
        <ScorePanel score={score} loading={scoreLoading} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Competitor Analysis Tab
// ---------------------------------------------------------------------------

function CompetitorTab({ projectId }: { projectId: string }) {
  const [urls, setUrls] = useState('')
  const [topicFocus, setTopicFocus] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompetitorAnalysis | null>(null)

  async function handleAnalyse() {
    const list = urls.split('\n').map((u) => u.trim()).filter(Boolean)
    if (list.length === 0) { toast.error('Enter at least one competitor URL'); return }
    if (list.length > 4) { toast.error('Max 4 competitor URLs'); return }
    setLoading(true)
    setResult(null)
    try {
      const data = await api.blog.analyseCompetitorBlogs(projectId, list, topicFocus.trim() || undefined)
      setResult(data)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }

  const priorityBadge = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    low: 'bg-muted text-muted-foreground',
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold mb-0.5">Competitor Blog URLs</p>
          <p className="text-xs text-muted-foreground">Enter 1-4 competitor URLs (one per line). Leo will crawl their blog, analyse their content strategy, and find gaps for your brand.</p>
        </div>
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder={"https://competitor1.com\nhttps://competitor2.com/blog"}
          rows={4}
          className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        />
        <input
          value={topicFocus}
          onChange={(e) => setTopicFocus(e.target.value)}
          placeholder="Optional topic focus (e.g. AI marketing tools)"
          className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleAnalyse}
          disabled={loading || !urls.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
          {loading ? 'Analysing…' : 'Analyse Competitors'}
        </button>
      </div>

      {result && (
        <>
          {/* Summary */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Strategic Summary</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
            {result.recommended_formats.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground">Best formats:</span>
                {result.recommended_formats.map((f, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{f}</span>
                ))}
              </div>
            )}
          </div>

          {/* Gap opportunities */}
          {result.gap_opportunities.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Content Gap Opportunities ({result.gap_opportunities.length})
              </p>
              {result.gap_opportunities.map((gap, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{gap.topic}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold', priorityBadge[gap.priority])}>
                        {gap.priority}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">
                        {gap.target_format}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">Angle:</span> {gap.angle}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">Why now:</span> {gap.why_now}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Per-competitor breakdown */}
          {result.competitors.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Competitor Breakdown</p>
              {result.competitors.map((comp, i) => (
                <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-primary" />
                      <p className="text-sm font-semibold">{comp.domain}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{comp.posting_frequency}</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-muted-foreground italic">{comp.content_style}</p>
                    {comp.top_topics.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Top Topics</p>
                        <div className="flex flex-wrap gap-1">
                          {comp.top_topics.map((t, j) => (
                            <span key={j} className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {comp.posts?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recent Posts</p>
                        <ul className="space-y-0.5">
                          {comp.posts.slice(0, 6).map((p, j) => (
                            <li key={j} className="text-xs text-muted-foreground truncate">
                              {p.url ? (
                                <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                                  {p.title}
                                </a>
                              ) : p.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BlogPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [tab, setTab] = useState<Tab>('write')

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3 shrink-0">
        <SidebarToggle />
        <FileText className="w-4 h-4 text-muted-foreground" />
        <div className="flex-1">
          <h1 className="font-semibold text-sm">Blog Studio</h1>
          <p className="text-xs text-muted-foreground">SEO · GEO · AEO — optimised content from brief to publish</p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-muted/40">
          {([
            { key: 'write', label: 'Write', icon: <FileText className="w-3 h-3" /> },
            { key: 'competitors', label: 'Competitors', icon: <Users className="w-3 h-3" /> },
          ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors',
                tab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </header>

      <div className={cn('flex-1 overflow-hidden', tab === 'write' ? 'p-4' : 'overflow-y-auto p-6')}>
        {tab === 'write' && <WriteTab projectId={projectId} />}
        {tab === 'competitors' && <CompetitorTab projectId={projectId} />}
      </div>
    </div>
  )
}
