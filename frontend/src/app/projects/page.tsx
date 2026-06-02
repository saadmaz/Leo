'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Library, BarChart2, PlusCircle, Globe, Search } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/lib/api'
import { Sidebar, SidebarToggle } from '@/components/layout/sidebar'
import { AnnouncementBanner } from '@/components/layout/announcement-banner'
import { OnboardingCard } from '@/components/onboarding/onboarding-card'
import { Skeleton } from '@/components/ui/skeleton'
import { getBrandInitials } from '@/lib/brand-utils'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'

// ---------------------------------------------------------------------------
// Palettes — header gradient + avatar solid + text accent
// ---------------------------------------------------------------------------

const PALETTES = [
  { header: 'from-violet-600 via-violet-700 to-violet-900', avatar: 'bg-violet-600' },
  { header: 'from-blue-600 via-blue-700 to-blue-900',       avatar: 'bg-blue-600'   },
  { header: 'from-emerald-500 via-emerald-600 to-emerald-800', avatar: 'bg-emerald-600' },
  { header: 'from-amber-500 via-amber-600 to-orange-700',   avatar: 'bg-amber-500'  },
  { header: 'from-rose-600 via-rose-700 to-rose-900',       avatar: 'bg-rose-600'   },
  { header: 'from-indigo-600 via-indigo-700 to-indigo-900', avatar: 'bg-indigo-600' },
]

function getPalette(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PALETTES[hash % PALETTES.length]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDomain(url?: string | null): string | null {
  if (!url) return null
  try {
    const full = url.startsWith('http') ? url : `https://${url}`
    return new URL(full).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getSetupProgress(p: Project): { done: number; total: number; nextHint: string } {
  const checks = [
    { done: !!p.websiteUrl,                                         hint: 'Add your website URL' },
    { done: !!(p.brandCore?.tone),                                  hint: 'Define your brand voice' },
    { done: !!(p.brandCore?.visual),                                hint: 'Set your visual identity' },
    { done: !!(p.brandCore?.themes?.length),                        hint: 'Add content themes' },
    { done: !!(p.instagramUrl || p.linkedinUrl || p.xUrl || p.tiktokUrl), hint: 'Connect social profiles' },
  ]
  const done = checks.filter((c) => c.done).length
  const next = checks.find((c) => !c.done)?.hint ?? 'All steps complete'
  return { done, total: checks.length, nextHint: next }
}

// ---------------------------------------------------------------------------
// SetupRing — small circular SVG progress indicator
// ---------------------------------------------------------------------------

function SetupRing({ done, total }: { done: number; total: number }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const pct = total === 0 ? 0 : done / total
  return (
    <svg width={52} height={52} viewBox="0 0 52 52" className="shrink-0">
      <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={4} />
      <circle
        cx={26} cy={26} r={r}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${pct * circ} ${circ}`}
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dasharray 0.9s ease-out' }}
      />
      <text x={26} y={26} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 11, fontWeight: 700, fill: 'white', fontFamily: 'inherit' }}>
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// BrandLogo — Clearbit → logoUrl → solid-colour initials
// ---------------------------------------------------------------------------

function BrandLogo({ project, size = 40 }: { project: Project; size?: number }) {
  const [err, setErr] = useState(false)
  const domain = getDomain(project.websiteUrl)
  const src = project.logoUrl ?? (domain ? `https://logo.clearbit.com/${domain}` : null)
  const palette = getPalette(project.name)
  const initials = getBrandInitials(project.name)

  if (src && !err) {
    return (
      <div
        className="shrink-0 rounded-xl bg-white flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={project.name}
          onError={() => setErr(true)}
          style={{ width: size - 10, height: size - 10 }}
          className="object-contain"
        />
      </div>
    )
  }

  return (
    <div
      className={cn('shrink-0 rounded-xl flex items-center justify-center font-bold text-white', palette.avatar)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectCard — credit-card style
// ---------------------------------------------------------------------------

function ProjectCard({
  project,
  onOpenChat,
  onNavigate,
}: {
  project: Project
  onOpenChat: () => void
  onNavigate: (path: string) => void
}) {
  const hasBrandCore = !!project.brandCore
  const palette = getPalette(project.name)
  const initials = getBrandInitials(project.name)
  const domain = getDomain(project.websiteUrl)
  const setup = getSetupProgress(project)
  const tagline = project.brandCore?.tagline ?? project.brandCore?.messaging?.valueProp ?? null
  const themes = project.brandCore?.themes?.slice(0, 3) ?? []

  return (
    <div
      className="group flex flex-col rounded-2xl overflow-hidden cursor-pointer border border-white/6 hover:border-white/14 hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200"
      onClick={() => onNavigate(`/projects/${project.id}/dashboard`)}
    >
      {/* ── Coloured header ─────────────────── */}
      <div className={cn('relative px-5 pt-5 pb-4 bg-gradient-to-br overflow-hidden', palette.header)}>
        {/* Large watermark initial */}
        <span
          aria-hidden
          className="absolute right-2 top-0 font-black leading-none select-none text-white/[0.08] pointer-events-none"
          style={{ fontSize: 120 }}
        >
          {initials[0]}
        </span>

        {/* Logo + name */}
        <div className="relative flex items-start gap-3">
          <BrandLogo project={project} size={42} />
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-bold text-base text-white leading-tight truncate">{project.name}</h3>
            {domain && (
              <p className="flex items-center gap-1 mt-0.5 text-[11px] text-white/55">
                <Globe className="w-2.5 h-2.5 shrink-0" />
                {domain}
              </p>
            )}
          </div>
        </div>

        {/* Status + time */}
        <div className="relative mt-3 flex items-center justify-between gap-2">
          {hasBrandCore ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              Brand Core ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/25 text-white/75 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              In setup
            </span>
          )}
          <span className="text-[10px] text-white/35 shrink-0">Updated {timeAgo(project.updatedAt)}</span>
        </div>
      </div>

      {/* ── Dark body ───────────────────────── */}
      <div className="flex flex-col flex-1 bg-card">

        {/* Content zone */}
        <div className="px-5 py-4 flex-1 min-h-[72px] flex items-center">
          {hasBrandCore ? (
            <div className="w-full">
              {tagline ? (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{tagline}</p>
              ) : themes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {themes.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium border border-primary/15">
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 italic">Ready to create content</p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4 w-full">
              <SetupRing done={setup.done} total={setup.total} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Setup {setup.done} of {setup.total}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{setup.nextHint}</p>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-border/40" />

        {/* Action chips */}
        <div
          className="flex items-center gap-2 px-5 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          {([
            { icon: MessageSquare, label: 'Chat',      action: onOpenChat },
            { icon: Library,       label: 'Library',   action: () => onNavigate(`/projects/${project.id}/library`) },
            { icon: BarChart2,     label: 'Analytics', action: () => onNavigate(`/projects/${project.id}/analytics`) },
          ] as const).map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              title={label}
              onClick={action as () => void}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-medium text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground transition-all"
            >
              <Icon className="w-3 h-3" />
              <span className="hidden xs:inline sm:hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Primary CTA */}
        <div
          className="px-5 pb-5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onNavigate(`/projects/${project.id}/dashboard`)}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {hasBrandCore ? 'Open workspace' : 'Continue setup'}
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// New brand card
// ---------------------------------------------------------------------------

function NewProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col items-center justify-center gap-3 rounded-2xl min-h-[280px]',
        'border-2 border-dashed border-white/8 hover:border-primary/40',
        'hover:bg-primary/5 transition-all duration-200',
      )}
    >
      <div className="w-12 h-12 rounded-2xl border-2 border-white/10 group-hover:border-primary/50 flex items-center justify-center transition-all">
        <PlusCircle className="w-6 h-6 text-muted-foreground/25 group-hover:text-primary transition-colors" />
      </div>
      <div className="text-center space-y-0.5">
        <p className="text-sm font-semibold text-muted-foreground/40 group-hover:text-primary transition-colors">New brand</p>
        <p className="text-[11px] text-muted-foreground/25">Connect a new workspace</p>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type FilterKey = 'all' | 'ready' | 'setup'

export default function ProjectsPage() {
  const router = useRouter()
  const { projects, setProjects, setChats, setActiveChat, setWizardOpen, user } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) { router.replace('/login'); return }
    setLoading(true)
    api.projects.list()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, router, setProjects])

  async function openChat(projectId: string) {
    try {
      const chats = await api.chats.list(projectId)
      if (chats.length > 0) {
        setActiveChat(chats[0])
        router.push(`/projects/${projectId}/chats/${chats[0].id}`)
      } else {
        const chat = await api.chats.create(projectId)
        setChats([chat])
        setActiveChat(chat)
        router.push(`/projects/${projectId}/chats/${chat.id}`)
      }
    } catch {
      router.push(`/projects/${projectId}/dashboard`)
    }
  }

  const readyCount = projects.filter((p) => !!p.brandCore).length
  const setupCount = projects.length - readyCount

  const filtered = useMemo(() => {
    let list = projects
    if (filter === 'ready') list = list.filter((p) => !!p.brandCore)
    if (filter === 'setup') list = list.filter((p) => !p.brandCore)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) || getDomain(p.websiteUrl)?.includes(q)
      )
    }
    return list
  }, [projects, filter, search])

  const FILTERS: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all',   label: 'All',         count: projects.length },
    { key: 'ready', label: 'Ready',        count: readyCount },
    { key: 'setup', label: 'Needs setup',  count: setupCount },
  ]

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <AnnouncementBanner />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

            {/* Page header */}
            <div className="flex items-center gap-4">
              <SidebarToggle />

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">Your brands</h1>
                {!loading && projects.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {projects.length} workspace{projects.length !== 1 ? 's' : ''}
                    {readyCount > 0 && <span> · {readyCount} ready to ship</span>}
                    {setupCount > 0 && <span> · {setupCount} need setup</span>}
                  </p>
                )}
              </div>

              {/* Search */}
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search brands…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-44 rounded-xl bg-card/60 border border-border/50 pl-9 pr-3 text-sm placeholder:text-muted-foreground/35 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
              </div>

              {/* New brand */}
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                New brand
              </button>
            </div>

            {/* Filter tabs */}
            {!loading && projects.length > 0 && (
              <div className="flex items-center gap-1">
                {FILTERS.map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                      filter === key
                        ? 'bg-card text-foreground border border-border/60 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {label}
                    <span className={cn(
                      'text-[11px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums',
                      filter === key ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                    )}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl overflow-hidden border border-white/6">
                    <Skeleton className="h-[108px] w-full rounded-none" />
                    <div className="bg-card p-5 space-y-3">
                      <div className="flex items-center gap-4">
                        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-3/4" />
                          <Skeleton className="h-2.5 w-1/2" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-8 flex-1 rounded-xl" />
                        <Skeleton className="h-8 flex-1 rounded-xl" />
                        <Skeleton className="h-8 flex-1 rounded-xl" />
                      </div>
                      <Skeleton className="h-10 w-full rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && projects.length === 0 && <OnboardingCard />}

            {/* Cards grid */}
            {!loading && projects.length > 0 && (
              <>
                {filtered.length === 0 && search && (
                  <p className="text-center text-sm text-muted-foreground py-12">
                    No brands match &ldquo;{search}&rdquo;
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onOpenChat={() => openChat(project.id)}
                      onNavigate={(path) => router.push(path)}
                    />
                  ))}
                  {filter === 'all' && !search && (
                    <NewProjectCard onClick={() => setWizardOpen(true)} />
                  )}
                </div>
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
