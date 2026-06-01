'use client'

/**
 * BlogScorePanel — post-draft quality gate.
 *
 * All scoring is computed client-side from the draft text + optional brief.
 * The only network call is to the existing brand voice scorer API
 * (api.brandVoice.score), which already exists in Leo.
 *
 * Score components (brief mode):
 *   - Keyword density (target: 0.5-2.5%)
 *   - NLP term coverage (% of required terms present)
 *   - SERP gap coverage (% of brief H2s present in draft)
 *   - LSI term coverage (% of recommended LSI terms used) — new
 *   - Heading structure (H1 present, proper H2/H3 hierarchy) — new
 *   - Readability (Flesch-Kincaid Reading Ease)
 *   - Word count vs. target
 *   - Brand alignment (calls api.brandVoice.score)
 *
 * Non-brief mode omits NLP/SERP/LSI checks.
 */

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { BlogBrief } from '@/lib/api'

interface BlogScorePanelProps {
  draft: string
  brief?: BlogBrief | null
  projectId: string
  targetKeyword?: string
  targetWordCount?: number
  className?: string
}

interface ScoreItem {
  label: string
  score: number       // 0-100
  value: string       // human-readable value
  status: 'good' | 'warn' | 'bad'
  hint?: string
}

// ---------------------------------------------------------------------------
// Pure scoring functions (no imports)
// ---------------------------------------------------------------------------

function fleschKincaid(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const words = text.split(/\s+/).filter((w) => w.trim().length > 0)
  if (sentences.length === 0 || words.length === 0) return 0
  const syllables = words.reduce((sum, word) => {
    const cleaned = word.toLowerCase().replace(/[^a-z]/g, '')
    const matches = cleaned.match(/[aeiouy]+/g)
    return sum + Math.max(1, matches?.length ?? 1)
  }, 0)
  const avgSentenceLen = words.length / sentences.length
  const avgSyllablesPerWord = syllables / words.length
  const score = 206.835 - 1.015 * avgSentenceLen - 84.6 * avgSyllablesPerWord
  return Math.max(0, Math.min(100, Math.round(score)))
}

function keywordDensity(text: string, keyword: string): number {
  if (!keyword || !text) return 0
  const words = text.toLowerCase().split(/\s+/)
  const kwWords = keyword.toLowerCase().split(/\s+/)
  let count = 0
  for (let i = 0; i <= words.length - kwWords.length; i++) {
    if (kwWords.every((w, j) => words[i + j] === w)) count++
  }
  return words.length > 0 ? (count / words.length) * 100 : 0
}

function termCoverage(text: string, terms: string[]): number {
  if (terms.length === 0) return 100
  const lower = text.toLowerCase()
  const covered = terms.filter((t) => lower.includes(t.toLowerCase()))
  return Math.round((covered.length / terms.length) * 100)
}

function missingTerms(text: string, terms: string[], limit = 3): string[] {
  const lower = text.toLowerCase()
  return terms.filter((t) => !lower.includes(t.toLowerCase())).slice(0, limit)
}

function serpGapCoverage(text: string, h2s: { heading: string }[]): number {
  if (h2s.length === 0) return 100
  const lower = text.toLowerCase()
  const covered = h2s.filter((s) => {
    const words = s.heading.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    return words.length === 0 || words.some((w) => lower.includes(w))
  })
  return Math.round((covered.length / h2s.length) * 100)
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w.trim().length > 0).length
}

function headingStructureScore(text: string): { score: number; value: string; hint?: string } {
  const h1Count = (text.match(/^#\s/gm) ?? []).length
  const h2Count = (text.match(/^##\s/gm) ?? []).length
  const h3Count = (text.match(/^###\s/gm) ?? []).length

  if (h1Count === 0 && h2Count === 0) {
    return { score: 20, value: 'No headings', hint: 'Add H1 and H2 headings to structure the post' }
  }
  if (h1Count === 0) {
    return { score: 55, value: `H2:${h2Count} H3:${h3Count}`, hint: 'Missing H1 (# title)' }
  }
  if (h1Count > 1) {
    return { score: 70, value: `H1:${h1Count} H2:${h2Count}`, hint: 'Multiple H1s — use only one' }
  }
  if (h2Count < 3) {
    return { score: 75, value: `H1:${h1Count} H2:${h2Count}`, hint: 'Add more H2 sections (3+ recommended)' }
  }
  return { score: 100, value: `H1:${h1Count} H2:${h2Count} H3:${h3Count}` }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BlogScorePanel({ draft, brief, projectId, targetKeyword, targetWordCount, className }: BlogScorePanelProps) {
  const [brandScore, setBrandScore] = useState<number | null>(null)
  const [loadingBrand, setLoadingBrand] = useState(false)

  const kw = brief?.target_keyword ?? targetKeyword ?? ''
  const wc = wordCount(draft)
  const targetWc = brief?.recommended_word_count ?? targetWordCount ?? 1000
  const density = keywordDensity(draft, kw)
  const readability = fleschKincaid(draft)
  const wcPct = targetWc > 0 ? Math.round((wc / targetWc) * 100) : 0
  const headings = headingStructureScore(draft)

  useEffect(() => {
    if (!draft || draft.length < 200) return
    setLoadingBrand(true)
    api.brandVoice
      .score(projectId, draft.slice(0, 2000))
      .then((res) => {
        const score = typeof (res as { score?: number }).score === 'number'
          ? (res as { score: number }).score
          : null
        setBrandScore(score)
      })
      .catch(() => {})
      .finally(() => setLoadingBrand(false))
  }, [draft, projectId])

  const scores: ScoreItem[] = [
    // Keyword density — always shown when keyword is known
    ...(kw ? [{
      label: 'Keyword Density',
      score: density >= 0.5 && density <= 2.5 ? 100 : density < 0.5 ? density * 200 : Math.max(0, 100 - (density - 2.5) * 40),
      value: `${density.toFixed(2)}%`,
      status: (density >= 0.5 && density <= 2.5 ? 'good' : density > 2.5 ? 'bad' : 'warn') as ScoreItem['status'],
      hint: density > 2.5 ? 'Keyword stuffing detected (>2.5%)' : density < 0.5 ? 'Keyword under-used (<0.5%)' : undefined,
    }] : []),

    // Heading structure — always shown
    {
      label: 'Heading Structure',
      score: headings.score,
      value: headings.value,
      status: (headings.score >= 90 ? 'good' : headings.score >= 60 ? 'warn' : 'bad') as ScoreItem['status'],
      hint: headings.hint,
    },

    // Brief-mode only items
    ...(brief ? [
      {
        label: 'NLP Term Coverage',
        score: termCoverage(draft, brief.nlp_terms_required),
        value: `${termCoverage(draft, brief.nlp_terms_required)}%`,
        status: (termCoverage(draft, brief.nlp_terms_required) >= 75 ? 'good' : termCoverage(draft, brief.nlp_terms_required) >= 50 ? 'warn' : 'bad') as ScoreItem['status'],
        hint: termCoverage(draft, brief.nlp_terms_required) < 75
          ? `Missing: ${missingTerms(draft, brief.nlp_terms_required).join(', ')}`
          : undefined,
      },
      {
        label: 'SERP Gap Coverage',
        score: serpGapCoverage(draft, brief.h2_structure),
        value: `${serpGapCoverage(draft, brief.h2_structure)}%`,
        status: (serpGapCoverage(draft, brief.h2_structure) >= 80 ? 'good' : serpGapCoverage(draft, brief.h2_structure) >= 60 ? 'warn' : 'bad') as ScoreItem['status'],
      },
    ] : []),

    // LSI terms — shown when brief has lsi_terms
    ...(brief?.lsi_terms && brief.lsi_terms.length > 0 ? [{
      label: 'LSI Term Coverage',
      score: termCoverage(draft, brief.lsi_terms),
      value: `${termCoverage(draft, brief.lsi_terms)}%`,
      status: (termCoverage(draft, brief.lsi_terms) >= 60 ? 'good' : termCoverage(draft, brief.lsi_terms) >= 40 ? 'warn' : 'bad') as ScoreItem['status'],
      hint: termCoverage(draft, brief.lsi_terms) < 60
        ? `Weave in: ${missingTerms(draft, brief.lsi_terms, 4).join(', ')}`
        : undefined,
    }] : []),

    // Readability — always shown
    {
      label: 'Readability',
      score: readability,
      value: readability >= 60 ? 'Easy' : readability >= 30 ? 'Moderate' : 'Difficult',
      status: (readability >= 60 ? 'good' : readability >= 30 ? 'warn' : 'bad') as ScoreItem['status'],
      hint: readability < 30 ? 'Consider shorter sentences and simpler words' : undefined,
    },

    // Word count — always shown
    {
      label: 'Word Count',
      score: Math.min(100, wcPct),
      value: `${wc.toLocaleString()} / ${targetWc.toLocaleString()}`,
      status: (wcPct >= 90 ? 'good' : wcPct >= 60 ? 'warn' : 'bad') as ScoreItem['status'],
      hint: wcPct < 90 ? `~${targetWc - wc} words short` : undefined,
    },

    // Brand alignment — shown when score loaded
    ...(brandScore !== null ? [{
      label: 'Brand Alignment',
      score: brandScore,
      value: `${brandScore}%`,
      status: (brandScore >= 75 ? 'good' : brandScore >= 50 ? 'warn' : 'bad') as ScoreItem['status'],
    }] : []),
  ]

  const overallScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : 0

  const Icon = ({ status }: { status: ScoreItem['status'] }) => {
    if (status === 'good') return <CheckCircle className="w-3.5 h-3.5 text-green-500" />
    if (status === 'warn') return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
    return <Minus className="w-3.5 h-3.5 text-red-500" />
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <div>
          <p className="text-xs font-semibold">Blog SEO Score</p>
          <p className="text-[10px] text-muted-foreground">Computed from draft{brief ? ' + brief' : ''}</p>
        </div>
        <div className={cn(
          'ml-auto text-2xl font-bold tabular-nums',
          overallScore >= 75 ? 'text-green-500' : overallScore >= 50 ? 'text-amber-500' : 'text-red-500',
        )}>
          {overallScore}
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        {scores.map((s) => (
          <div key={s.label}>
            <div className="flex items-center gap-2 mb-1">
              <Icon status={s.status} />
              <span className="text-xs flex-1">{s.label}</span>
              <span className="text-xs font-mono font-medium">{s.value}</span>
            </div>
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  s.status === 'good' ? 'bg-green-500' : s.status === 'warn' ? 'bg-amber-500' : 'bg-red-500',
                )}
                style={{ width: `${s.score}%` }}
              />
            </div>
            {s.hint && <p className="text-[10px] text-muted-foreground mt-0.5">{s.hint}</p>}
          </div>
        ))}

        {loadingBrand && (
          <p className="text-[10px] text-muted-foreground animate-pulse">Checking brand alignment…</p>
        )}
      </div>
    </div>
  )
}
