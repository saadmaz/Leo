'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, MessageSquare, Map, Mic2, Search, ChevronRight,
  CheckCircle2, Circle, ArrowRight, Target, BarChart2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import type { PersonalCore } from '@/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Completeness Ring
// ---------------------------------------------------------------------------

function CompletenessRing({ score }: { score: number }) {
  const r = 40
  const circ = 2 * Math.PI * r
  const filled = circ * (score / 100)
  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
        <circle
          cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="6"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          className="text-primary transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{score}%</span>
        <span className="text-[10px] text-muted-foreground">complete</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick Action card
// ---------------------------------------------------------------------------

function QuickAction({
  icon,
  label,
  href,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  href?: string
  onClick?: () => void
}) {
  const cls = 'flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/30 transition-all cursor-pointer'
  const inner = (
    <>
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
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
// Platform row
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
// Page
// ---------------------------------------------------------------------------

export default function PersonalBrandDashboardPage() {
  const params = useParams<{ projectId: string }>()
  const { personalCore, setPersonalCore, setMyBrandPanelOpen } = useAppStore()
  const [core, setCore] = useState<PersonalCore | null>(personalCore)
  const [loading, setLoading] = useState(!personalCore)

  useEffect(() => {
    if (personalCore) { setCore(personalCore); return }
    api.persona.getCore(params.projectId)
      .then((c) => { setCore(c); setPersonalCore(c) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [params.projectId, personalCore, setPersonalCore])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!core) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">Personal Core not found.</p>
        <Link
          href={`/projects/${params.projectId}/personal-brand/onboarding`}
          className="text-sm text-primary hover:underline"
        >
          Start your interview →
        </Link>
      </div>
    )
  }

  // Build checklist dynamically
  const checklist = [
    {
      done: core.interviewStatus === 'complete',
      label: 'Complete your discovery interview',
      href: core.interviewStatus !== 'complete' ? `/projects/${params.projectId}/personal-brand/onboarding` : undefined,
    },
    {
      done: (core.contentPillars?.length ?? 0) > 0,
      label: 'Get your content pillars defined',
      href: core.interviewStatus !== 'complete' ? `/projects/${params.projectId}/personal-brand/onboarding` : undefined,
    },
    {
      done: !!core.positioningStatement,
      label: 'Build your positioning statement',
      href: `/projects/${params.projectId}/personal-brand/onboarding`,
    },
    {
      done: false,
      label: 'Generate your first personal post',
      href: `/projects/${params.projectId}/personal-brand/content`,
    },
    {
      done: false,
      label: 'Build your platform strategy',
      href: `/projects/${params.projectId}/personal-brand/strategy`,
    },
  ]

  const hasPlatforms = core.platformStrategy && Object.keys(core.platformStrategy).length > 0

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {core.fullName ? `${core.fullName}'s Brand` : 'My Personal Brand'}
            </h1>
            {core.headline && (
              <p className="text-sm text-muted-foreground mt-1">{core.headline}</p>
            )}
          </div>
          <button
            onClick={() => setMyBrandPanelOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
          >
            View My Brand <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hero: completeness + interview CTA */}
        <div className="flex items-center gap-6 p-6 rounded-2xl border border-border bg-card">
          <CompletenessRing score={core.completenessScore ?? 0} />
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Your Personal Core is {core.completenessScore ?? 0}% complete</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {core.interviewStatus === 'complete'
                  ? 'All 5 modules answered. Your brand profile is fully built.'
                  : 'Complete your discovery interview to unlock your full brand profile.'}
              </p>
            </div>
            {core.interviewStatus !== 'complete' && (
              <Link
                href={`/projects/${params.projectId}/personal-brand/onboarding`}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                {core.interviewStatus === 'in_progress' ? 'Resume interview' : 'Start interview'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction icon={<MessageSquare className="w-4 h-4" />} label="Content Engine" href={`/projects/${params.projectId}/personal-brand/content`} />
            <QuickAction icon={<Map className="w-4 h-4" />} label="Build my strategy" href={`/projects/${params.projectId}/personal-brand/strategy`} />
            <QuickAction icon={<Mic2 className="w-4 h-4" />} label="View voice profile" onClick={() => setMyBrandPanelOpen(true)} />
            <QuickAction icon={<Search className="w-4 h-4" />} label="Analyse my niche" href={`/projects/${params.projectId}/personal-brand/strategy?tab=niche`} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Content Pillars */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Content Pillars
            </h2>
            {core.contentPillars?.length > 0 ? (
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
                    <Link
                      href={`/projects/${params.projectId}/chats`}
                      className="text-[10px] text-primary shrink-0 hover:underline"
                    >
                      Create →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Content pillars will appear after your interview is complete.
              </p>
            )}
          </div>

          {/* Next Steps Checklist */}
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
              <Link href={`/projects/${params.projectId}/personal-brand/strategy`} className="text-xs text-primary hover:underline">
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
