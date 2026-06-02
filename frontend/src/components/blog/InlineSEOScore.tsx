'use client'

/**
 * InlineSEOScore — lightweight, fully client-side SEO quality gate.
 *
 * Six scored criteria (total = 100 pts):
 *   1. Keyword in H1          (15 pts)
 *   2. Keyword in first 100w  (15 pts)
 *   3. Keyword density        (20 pts)
 *   4. Heading structure      (15 pts)
 *   5. Word count vs SERP avg (20 pts)
 *   6. Meta description       (15 pts)
 *
 * No API calls — everything is computed from the draft string.
 */

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InlineSEOScoreProps {
  draftText: string
  targetKeyword: string
  serpWordCount: number   // 0 = not available
}

// ---------------------------------------------------------------------------
// Pure scoring helpers
// ---------------------------------------------------------------------------

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')     // headings
    .replace(/\*\*(.*?)\*\*/g, '$1') // bold
    .replace(/\*(.*?)\*/g, '$1')     // italic
    .replace(/`[^`]+`/g, '')         // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^[-*+]\s+/gm, '')      // bullets
    .replace(/^\d+\.\s+/gm, '')      // numbered lists
    .trim()
}

function wordCount(text: string): number {
  return stripMarkdown(text).split(/\s+/).filter(Boolean).length
}

function keywordOccurrences(text: string, keyword: string): number {
  if (!keyword) return 0
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped, 'gi')
  return (text.match(re) ?? []).length
}

interface CriterionResult {
  label: string
  pts: number
  maxPts: number
  passed: boolean
  tip?: string
}

function score(draftText: string, targetKeyword: string, serpWordCount: number): {
  total: number
  criteria: CriterionResult[]
} {
  const kw = targetKeyword.trim().toLowerCase()
  const criteria: CriterionResult[] = []

  // ---- 1. Keyword in H1 (15 pts) ----
  const h1Match = /^#\s+.+$/m.test(draftText)
    && new RegExp(`^#\\s+.*${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'im').test(draftText)
  criteria.push({
    label: 'Keyword in H1',
    pts: h1Match ? 15 : 0,
    maxPts: 15,
    passed: h1Match,
    tip: h1Match ? undefined : `Include "${targetKeyword}" in your main title (# heading).`,
  })

  // ---- 2. Keyword in first 100 words (15 pts) ----
  const first100 = stripMarkdown(draftText).split(/\s+/).slice(0, 100).join(' ').toLowerCase()
  const inFirst100 = kw ? first100.includes(kw) : false
  criteria.push({
    label: 'Keyword in first 100 words',
    pts: inFirst100 ? 15 : 0,
    maxPts: 15,
    passed: inFirst100,
    tip: inFirst100 ? undefined : 'Mention the target keyword in your opening paragraph.',
  })

  // ---- 3. Keyword density (20 pts) ----
  const totalWords = wordCount(draftText)
  const kwCount = keywordOccurrences(stripMarkdown(draftText), kw)
  const density = totalWords > 0 && kw ? (kwCount / totalWords) * 100 : 0
  let densityPts = 0
  if (density >= 1.0 && density <= 2.5) densityPts = 20
  else if ((density >= 0.5 && density < 1.0) || (density > 2.5 && density <= 3.0)) densityPts = 5
  const densityPassed = densityPts >= 15
  criteria.push({
    label: `Keyword density (${density.toFixed(1)}%)`,
    pts: densityPts,
    maxPts: 20,
    passed: densityPts === 20,
    tip: density < 0.5
      ? `Keyword appears only ${kwCount}× — aim for 1–2.5% density.`
      : density > 3.0
      ? 'Keyword density too high (>3%) — reduce repetition.'
      : undefined,
  })

  // ---- 4. Heading structure (15 pts) ----
  const hasH1 = /^#\s+.+$/m.test(draftText)
  const h2Count = (draftText.match(/^##\s+.+$/gm) ?? []).length
  // No H3 before first H2
  const firstH2Pos = draftText.search(/^##\s+/m)
  const firstH3Pos = draftText.search(/^###\s+/m)
  const h3BeforeH2 = firstH3Pos !== -1 && (firstH2Pos === -1 || firstH3Pos < firstH2Pos)
  const structureOk = hasH1 && h2Count >= 2 && !h3BeforeH2
  criteria.push({
    label: 'Heading structure',
    pts: structureOk ? 15 : (hasH1 && h2Count >= 1 ? 7 : 0),
    maxPts: 15,
    passed: structureOk,
    tip: !hasH1
      ? 'Add an H1 title (# heading) at the top.'
      : h2Count < 2
      ? 'Add at least 2 H2 sections (## heading) to structure your post.'
      : h3BeforeH2
      ? 'An H3 appears before any H2 — fix the heading hierarchy.'
      : undefined,
  })

  // ---- 5. Word count (20 pts) ----
  let wcPts = 0
  let wcTip: string | undefined
  if (serpWordCount > 0) {
    const ratio = totalWords / serpWordCount
    if (ratio >= 0.8 && ratio <= 1.2) wcPts = 20
    else if (ratio >= 0.6 && ratio <= 1.4) wcPts = 10
    wcTip = wcPts < 20
      ? `${totalWords} words vs SERP target ${serpWordCount}. Aim for ±20% of target.`
      : undefined
  } else {
    if (totalWords > 800) wcPts = 20
    else if (totalWords > 400) wcPts = 10
    wcTip = wcPts < 20 ? `${totalWords} words — aim for 800+ for a comprehensive post.` : undefined
  }
  criteria.push({
    label: serpWordCount > 0
      ? `Word count (${totalWords} / ${serpWordCount} target)`
      : `Word count (${totalWords} words)`,
    pts: wcPts,
    maxPts: 20,
    passed: wcPts === 20,
    tip: wcTip,
  })

  // ---- 6. Meta description (15 pts) ----
  const metaPatterns = [
    /^meta description:/im,
    /^\*\*meta[:\s]/im,
    /^description:/im,
    /^seo description:/im,
  ]
  const hasExplicitMeta = metaPatterns.some((p) => p.test(draftText))
  // Fallback: last non-empty paragraph ≤ 160 chars
  const paras = draftText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const lastPara = paras[paras.length - 1] ?? ''
  const lastParaClean = stripMarkdown(lastPara)
  const lastParaIsShort = lastParaClean.length > 0 && lastParaClean.length <= 160
  const metaOk = hasExplicitMeta || lastParaIsShort
  criteria.push({
    label: 'Meta description',
    pts: metaOk ? 15 : 0,
    maxPts: 15,
    passed: metaOk,
    tip: metaOk ? undefined : 'Add a "Meta description:" line (under 160 chars) at the end of your post.',
  })

  const total = criteria.reduce((s, c) => s + c.pts, 0)
  return { total, criteria }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineSEOScore({ draftText, targetKeyword, serpWordCount }: InlineSEOScoreProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { total, criteria } = useMemo(
    () => score(draftText, targetKeyword, serpWordCount),
    [draftText, targetKeyword, serpWordCount],
  )

  const scoreColor =
    total >= 80 ? 'text-green-600 dark:text-green-400'
    : total >= 60 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-500'

  const ringColor =
    total >= 80 ? 'stroke-green-500'
    : total >= 60 ? 'stroke-amber-500'
    : 'stroke-red-500'

  // Worst-scoring criterion for the tip
  const worstTip = [...criteria]
    .filter((c) => c.tip)
    .sort((a, b) => (a.pts / a.maxPts) - (b.pts / b.maxPts))[0]?.tip

  const circumference = 2 * Math.PI * 20
  const dashOffset = circumference - (total / 100) * circumference

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden text-sm">
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        {/* Circular score */}
        <div className="relative w-12 h-12 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor"
              className="text-muted/40" strokeWidth="4" />
            <circle cx="24" cy="24" r="20" fill="none"
              className={ringColor} strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round" />
          </svg>
          <span className={cn('absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums', scoreColor)}>
            {total}
          </span>
        </div>

        <div className="flex-1 text-left">
          <p className="text-xs font-semibold">SEO Score</p>
          <p className="text-[10px] text-muted-foreground">
            {total >= 80 ? 'Good' : total >= 60 ? 'Needs work' : 'Poor'} · {total}/100
          </p>
        </div>
        {collapsed
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-border pt-3">
          {criteria.map((c) => (
            <div key={c.label}>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs shrink-0', c.passed ? 'text-green-500' : c.pts > 0 ? 'text-amber-500' : 'text-red-400')}>
                  {c.passed ? '✓' : c.pts > 0 ? '◑' : '✗'}
                </span>
                <span className="text-xs flex-1 text-muted-foreground">{c.label}</span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {c.pts}/{c.maxPts}
                </span>
              </div>
              <div className="ml-5 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full', c.passed ? 'bg-green-500' : c.pts > 0 ? 'bg-amber-500' : 'bg-red-400')}
                  style={{ width: `${(c.pts / c.maxPts) * 100}%` }}
                />
              </div>
            </div>
          ))}

          {/* Actionable tip */}
          {worstTip && (
            <div className="mt-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-[10px] font-semibold text-primary mb-0.5 uppercase tracking-wide">Top tip</p>
              <p className="text-xs text-muted-foreground">{worstTip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
