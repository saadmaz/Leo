'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import {
  Loader2, MessageSquare, Map, Mic2, ArrowRight, Target, BarChart2,
  CheckCircle2, Circle, ChevronRight, Users, TrendingUp, Camera,
  RotateCcw, Sparkles,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import type { PersonalCore, InterviewQuestion, InterviewNextResponse } from '@/types'
import { InterviewProgressBar } from '@/components/personal-brand/interview/interview-progress-bar'
import { InterviewModuleIntro } from '@/components/personal-brand/interview/interview-module-intro'
import { InterviewQuestionCard } from '@/components/personal-brand/interview/interview-question-card'
import { InterviewExtractionProgress } from '@/components/personal-brand/interview/interview-extraction-progress'
import { SidebarToggle } from '@/components/layout/sidebar'
import { MovedNotice } from '@/components/layout/moved-notice'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Module question counts (mirrors backend interview_questions.py)
// ---------------------------------------------------------------------------

const MODULE_COUNTS: Record<string, number> = { A: 6, B: 5, C: 5, D: 5, E: 3 }
const MOD_START: Record<string, number> = { A: 0, B: 6, C: 11, D: 16, E: 21 }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyticsSnapshot {
  platform: string
  snapshotDate: string
  followers: number
  followersDelta: number
  postsThisWeek: number
  avgEngagementRate: number
  consistencyScore: number
}

// ---------------------------------------------------------------------------
// Completeness ring
// ---------------------------------------------------------------------------

function CompletenessRing({ score }: { score: number }) {
  const r = 40
  const circ = 2 * Math.PI * r
  const filled = circ * (score / 100)
  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="6"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          className="text-primary transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{score}%</span>
        <span className="text-[10px] text-muted-foreground">complete</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick action card
// ---------------------------------------------------------------------------

function QuickAction({ icon, label, href, onClick }: {
  icon: React.ReactNode; label: string; href?: string; onClick?: () => void
}) {
  const cls = 'flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/30 transition-all cursor-pointer'
  const inner = (
    <>
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      <span className="text-xs font-medium text-center leading-tight text-foreground">{label}</span>
    </>
  )
  if (href) return <Link href={href} className={cls}>{inner}</Link>
  return <button onClick={onClick} className={cls}>{inner}</button>
}

// ---------------------------------------------------------------------------
// Checklist item
// ---------------------------------------------------------------------------

function ChecklistItem({ done, label, href }: { done: boolean; label: string; href?: string }) {
  const content = (
    <div className={cn('flex items-center gap-3 py-2 px-3 rounded-lg transition-colors', !done && 'hover:bg-muted/60')}>
      {done
        ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
        : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
      <span className={cn('text-sm', done ? 'line-through text-muted-foreground' : 'text-foreground')}>
        {label}
      </span>
      {!done && href && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
    </div>
  )
  if (!done && href) return <Link href={href}>{content}</Link>
  return <div>{content}</div>
}

// ---------------------------------------------------------------------------
// Platform row (strategy summary)
// ---------------------------------------------------------------------------

function PlatformRow({ platform, cfg }: { platform: string; cfg: { focusLevel?: string; postsPerWeek?: number } }) {
  const focusColor: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    secondary: 'text-amber-600 bg-amber-500/10',
    passive: 'text-muted-foreground bg-muted',
  }
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold uppercase text-muted-foreground">
          {platform[0]}
        </span>
        <span className="text-sm font-medium text-foreground capitalize">{platform}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full capitalize', focusColor[cfg.focusLevel ?? ''] ?? focusColor.passive)}>
          {cfg.focusLevel}
        </span>
        <span className="text-xs text-muted-foreground w-12 text-right">{cfg.postsPerWeek}×/wk</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Analytics summary strip
// ---------------------------------------------------------------------------

function AnalyticsSummary({ snapshots }: { snapshots: AnalyticsSnapshot[] }) {
  if (snapshots.length === 0) return null
  const overallConsistency = Math.round(
    snapshots.reduce((sum, s) => sum + (s.consistencyScore ?? 0), 0) / snapshots.length
  )
  const consistencyColor = overallConsistency >= 80 ? 'text-green-600' : overallConsistency >= 60 ? 'text-amber-600' : 'text-red-500'

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary" />
          Analytics Summary
        </h2>
        <span className={cn('text-sm font-bold tabular-nums', consistencyColor)}>
          Consistency {overallConsistency}/100
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {snapshots.map((s) => (
          <div key={s.platform} className="rounded-lg border border-border bg-background p-3 space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide capitalize">{s.platform}</p>
            <p className="text-lg font-bold text-foreground">{(s.followers ?? 0).toLocaleString()}</p>
            <p className={cn('text-[10px] font-medium', s.followersDelta >= 0 ? 'text-green-600' : 'text-red-500')}>
              {s.followersDelta >= 0 ? '+' : ''}{s.followersDelta} this week
            </p>
            <p className="text-[10px] text-muted-foreground">{s.avgEngagementRate?.toFixed(1) ?? '–'}% engagement</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Embedded interview view
// ---------------------------------------------------------------------------

type InterviewStage = 'loading' | 'module_intro' | 'question' | 'extracting'

function EmbeddedInterview({ projectId, onComplete }: {
  projectId: string
  onComplete: (core: PersonalCore) => void
}) {
  const { setPersonalCore, setPersonalVoiceProfile } = useAppStore()

  const [stage, setStage] = useState<InterviewStage>('loading')
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [totalCount, setTotalCount] = useState(24)
  const [currentModule, setCurrentModule] = useState('A')
  const [lastModule, setLastModule] = useState('')
  const [answerLoading, setAnswerLoading] = useState(false)
  const [questionInModule, setQuestionInModule] = useState(1)

  const loadNext = useCallback(async (prevModule?: string) => {
    try {
      const res: InterviewNextResponse = await api.persona.getNextQuestion(projectId)
      setAnsweredCount(res.answeredCount)
      setTotalCount(res.totalCount)
      if (res.interviewStatus === 'complete' || !res.question) { setStage('extracting'); return }
      const q = res.question
      const mod = q.module
      const pos = res.answeredCount - MOD_START[mod] + 1
      setQuestionInModule(Math.max(1, pos))
      setCurrentQuestion(q)
      setCurrentModule(mod)
      if (prevModule && prevModule !== mod) { setLastModule(mod); setStage('module_intro') }
      else { setStage('question') }
    } catch { setStage('question') }
  }, [projectId])

  useEffect(() => {
    async function init() {
      try {
        let core: PersonalCore
        try { core = await api.persona.getCore(projectId) }
        catch { core = await api.persona.initCore(projectId, { fullName: '' }) }
        if (core.interviewStatus === 'complete') { onComplete(core); return }
        const res: InterviewNextResponse = await api.persona.getNextQuestion(projectId)
        setAnsweredCount(res.answeredCount)
        setTotalCount(res.totalCount)
        if (res.interviewStatus === 'complete' || !res.question) { setStage('extracting'); return }
        const q = res.question
        setCurrentQuestion(q)
        setCurrentModule(q.module)
        const pos = res.answeredCount - MOD_START[q.module] + 1
        setQuestionInModule(Math.max(1, pos))
        if (res.answeredCount === 0) { setLastModule('A'); setStage('module_intro') }
        else { setStage('question') }
      } catch { setStage('question') }
    }
    init()
  }, [projectId, onComplete])

  async function handleAnswer(answer: string) {
    if (!currentQuestion) return
    setAnswerLoading(true)
    const prev = currentModule
    try {
      await api.persona.saveAnswer(projectId, currentQuestion.key, answer)
      await loadNext(prev)
    } finally { setAnswerLoading(false) }
  }

  async function handleSkip() {
    if (!currentQuestion) return
    const prev = currentModule
    try { await api.persona.saveAnswer(projectId, currentQuestion.key, '') } catch {}
    await loadNext(prev)
  }

  function handleExtractionDone(core: PersonalCore) {
    setPersonalCore(core)
    api.persona.getVoice(projectId).then(setPersonalVoiceProfile).catch(() => {})
    onComplete(core)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="max-w-lg mx-auto">
          {stage !== 'loading' && stage !== 'extracting' && (
            <InterviewProgressBar currentModule={currentModule} answeredCount={answeredCount} totalCount={totalCount} />
          )}
          {stage === 'loading' && (
            <div className="flex items-center justify-center h-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {stage === 'extracting' && (
            <div className="flex items-center justify-center h-16">
              <p className="text-sm font-medium text-foreground">Building your Personal Core…</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {stage === 'loading' && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </motion.div>
            )}
            {stage === 'module_intro' && (
              <motion.div key={`intro-${lastModule}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <InterviewModuleIntro moduleKey={lastModule} questionCount={MODULE_COUNTS[lastModule] ?? 5} onStart={() => setStage('question')} />
              </motion.div>
            )}
            {stage === 'question' && currentQuestion && (
              <motion.div key={currentQuestion.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <InterviewQuestionCard
                  question={currentQuestion}
                  questionNumber={questionInModule}
                  totalInModule={MODULE_COUNTS[currentModule] ?? 5}
                  onAnswer={handleAnswer}
                  onSkip={handleSkip}
                  loading={answerLoading}
                />
              </motion.div>
            )}
            {stage === 'extracting' && (
              <motion.div key="extracting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <InterviewExtractionProgress projectId={projectId} onDone={handleExtractionDone} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard view (interview complete)
// ---------------------------------------------------------------------------

function DashboardView({ core, projectId, snapshots }: {
  core: PersonalCore
  projectId: string
  snapshots: AnalyticsSnapshot[]
}) {
  const { setMyBrandPanelOpen } = useAppStore()

  const checklist = [
    { done: core.interviewStatus === 'complete', label: 'Complete your discovery interview' },
    { done: (core.contentPillars?.length ?? 0) > 0, label: 'Get your content pillars defined' },
    { done: !!core.positioningStatement, label: 'Build your positioning statement' },
    { done: false, label: 'Generate your first personal post', href: `/projects/${projectId}/personal-brand/content` },
    { done: false, label: 'Build your platform strategy', href: `/projects/${projectId}/personal-brand/strategy` },
    { done: false, label: 'Connect your social accounts', href: `/projects/${projectId}/personal-brand/content?tab=schedule` },
  ]

  const hasPlatforms = core.platformStrategy && Object.keys(core.platformStrategy).length > 0

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {core.fullName ? `${core.fullName}'s Brand` : 'My Personal Brand'}
            </h1>
            {core.headline && <p className="text-sm text-muted-foreground mt-1">{core.headline}</p>}
          </div>
          <button
            onClick={() => setMyBrandPanelOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
          >
            View My Brand <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Completeness hero */}
        <div className="flex items-center gap-6 p-6 rounded-2xl border border-border bg-card">
          <CompletenessRing score={core.completenessScore ?? 0} />
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Your Personal Core is {core.completenessScore ?? 0}% complete
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {core.interviewStatus === 'complete'
                  ? 'All 5 modules answered. Your brand profile is fully built.'
                  : 'Complete your discovery interview to unlock your full brand profile.'}
              </p>
            </div>
          </div>
        </div>

        {/* Analytics summary */}
        <AnalyticsSummary snapshots={snapshots} />

        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction icon={<MessageSquare className="w-4 h-4" />} label="Content Engine" href={`/projects/${projectId}/personal-brand/content`} />
            <QuickAction icon={<Map className="w-4 h-4" />} label="Build my strategy" href={`/projects/${projectId}/personal-brand/strategy`} />
            <QuickAction icon={<Mic2 className="w-4 h-4" />} label="View voice profile" onClick={() => setMyBrandPanelOpen(true)} />
            <QuickAction icon={<Sparkles className="w-4 h-4" />} label="Post calendar" href={`/projects/${projectId}/personal-brand/content?tab=posts`} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Content Pillars */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Content Pillars
            </h2>
            {(core.contentPillars?.length ?? 0) > 0 ? (
              <div className="space-y-3">
                {core.contentPillars.map((pillar, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{pillar.name}</p>
                      {pillar.description && <p className="text-xs text-muted-foreground mt-0.5">{pillar.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Content pillars will appear after your interview is complete.</p>
            )}
          </div>

          {/* Next Steps */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Next Steps</h2>
            <div className="space-y-0.5">
              {checklist.map((item, i) => (
                <ChecklistItem key={i} done={item.done} label={item.label} href={item.href} />
              ))}
            </div>
          </div>
        </div>

        {/* Platform Strategy */}
        {hasPlatforms && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Platform Strategy
              </h2>
              <Link href={`/projects/${projectId}/personal-brand/strategy`} className="text-xs text-primary hover:underline">
                View full strategy →
              </Link>
            </div>
            <div className="divide-y divide-border/50">
              {Object.entries(core.platformStrategy as Record<string, { focusLevel?: string; postsPerWeek?: number }>).map(([platform, cfg]) => (
                <PlatformRow key={platform} platform={platform} cfg={cfg} />
              ))}
            </div>
          </div>
        )}

        {/* Goals */}
        {(core.goal90Day || core.goal12Month) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {core.goal90Day && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">90-Day Goal</p>
                <p className="text-sm text-foreground leading-relaxed">{core.goal90Day}</p>
              </div>
            )}
            {core.goal12Month && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">12-Month Vision</p>
                <p className="text-sm text-foreground leading-relaxed">{core.goal12Month}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Phase = 'loading' | 'interview' | 'dashboard'

export default function PersonalBrandHubPage() {
  const params = useParams<{ projectId: string }>()
  const { personalCore, setPersonalCore } = useAppStore()

  const [phase, setPhase] = useState<Phase>('loading')
  const [core, setCore] = useState<PersonalCore | null>(personalCore)
  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>([])

  // Determine initial phase
  useEffect(() => {
    if (personalCore) {
      setCore(personalCore)
      setPhase(personalCore.interviewStatus === 'complete' ? 'dashboard' : 'interview')
      return
    }
    api.persona.getCore(params.projectId)
      .then((c) => {
        setCore(c)
        setPersonalCore(c)
        setPhase(c.interviewStatus === 'complete' ? 'dashboard' : 'interview')
      })
      .catch(() => setPhase('interview')) // No core → start interview
  }, [params.projectId, personalCore, setPersonalCore])

  // Load analytics when showing dashboard
  useEffect(() => {
    if (phase !== 'dashboard') return
    ;(api.persona.getAnalytics(params.projectId) as unknown as Promise<AnalyticsSnapshot[]>)
      .then((snaps) => {
        // Deduplicate to latest snapshot per platform
        const latest = Object.values(
          (snaps ?? []).reduce<Record<string, AnalyticsSnapshot>>((acc, s) => {
            if (!acc[s.platform] || s.snapshotDate > acc[s.platform].snapshotDate) acc[s.platform] = s
            return acc
          }, {})
        )
        setSnapshots(latest)
      })
      .catch(() => {})
  }, [phase, params.projectId])

  function handleInterviewComplete(completedCore: PersonalCore) {
    setCore(completedCore)
    setPersonalCore(completedCore)
    setPhase('dashboard')
  }

  if (phase === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MovedNotice />

      {/* Shared header strip */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <SidebarToggle />
        <span className="text-sm font-semibold">
          {phase === 'interview' ? 'Personal Brand Interview' : 'Personal Brand'}
        </span>
      </div>

      {phase === 'interview' && (
        <EmbeddedInterview
          projectId={params.projectId}
          onComplete={handleInterviewComplete}
        />
      )}

      {phase === 'dashboard' && core && (
        <DashboardView
          core={core}
          projectId={params.projectId}
          snapshots={snapshots}
        />
      )}
    </div>
  )
}
