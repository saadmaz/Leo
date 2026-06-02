'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Library, BarChart2, PlusCircle, Globe } from 'lucide-react'
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
// Helpers
// ---------------------------------------------------------------------------

function getDomain(websiteUrl?: string | null): string | null {
  if (!websiteUrl) return null
  try {
    const url = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// Solid avatar colours — visible on any dark background
const AVATAR_PALETTES = [
  'bg-violet-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-rose-600',
  'bg-indigo-600',
]

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length]
}

// ---------------------------------------------------------------------------
// BrandLogo — Clearbit → project.logoUrl → solid-colour initials
// ---------------------------------------------------------------------------

function BrandLogo({ project }: { project: Project }) {
  const [error, setError] = useState(false)
  const domain = getDomain(project.websiteUrl)
  // Clearbit Logo API: free, no auth, 404s gracefully
  const src = project.logoUrl ?? (domain ? `https://logo.clearbit.com/${domain}` : null)

  if (src && !error) {
    return (
      <div className="w-12 h-12 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-white flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={project.name}
          onError={() => setError(true)}
          className="w-10 h-10 object-contain"
        />
      </div>
    )
  }

  // Solid-colour fallback — always visible on dark cards
  return (
    <div
      className={cn(
        'w-12 h-12 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm text-white',
        getAvatarColor(project.name),
      )}
    >
      {getBrandInitials(project.name)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectCard
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
  const domain = getDomain(project.websiteUrl)

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl cursor-pointer',
        'bg-card hover:bg-card/80',
        'border border-border/40 hover:border-primary/25',
        'shadow-sm hover:shadow-md',
        'transition-all duration-200',
      )}
      onClick={() => onNavigate(`/projects/${project.id}/dashboard`)}
    >
      {/* Amber top-bar when brand core missing */}
      {!hasBrandCore && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-amber-500/50" />
      )}

      {/* ── Main info row ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <BrandLogo project={project} />

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors duration-150">
            {project.name}
          </p>

          {domain ? (
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground/60 hover:text-primary transition-colors"
            >
              <Globe className="w-2.5 h-2.5" />
              {domain}
            </a>
          ) : project.description ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground/60 line-clamp-1">
              {project.description}
            </p>
          ) : null}

          {/* Status dot */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                hasBrandCore ? 'bg-emerald-500' : 'bg-amber-500/70',
              )}
            />
            <span
              className={cn(
                'text-[10px] font-medium',
                hasBrandCore ? 'text-emerald-600' : 'text-amber-500/80',
              )}
            >
              {hasBrandCore ? 'Brand Core ready' : 'Setup incomplete'}
            </span>
          </div>
        </div>

        {/* Icon-only quick actions — always visible, compact */}
        <div
          className="flex items-center gap-0.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { icon: MessageSquare, title: 'Open chat', action: onOpenChat },
            { icon: Library, title: 'Library', action: () => onNavigate(`/projects/${project.id}/library`) },
            { icon: BarChart2, title: 'Analytics', action: () => onNavigate(`/projects/${project.id}/analytics`) },
          ].map(({ icon: Icon, title, action }) => (
            <button
              key={title}
              title={title}
              onClick={action}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-white/8 transition-all"
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-border/30" />

      {/* ── Open CTA ── */}
      <div
        className="px-4 pt-3 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onNavigate(`/projects/${project.id}/dashboard`)}
          className={cn(
            'w-full py-2 rounded-xl text-xs font-semibold transition-all duration-150',
            'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground',
            'group-hover:bg-primary/15',
          )}
        >
          Open workspace
        </button>
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
        'group flex flex-col items-center justify-center gap-2.5 rounded-2xl',
        'border-2 border-dashed border-white/8 hover:border-primary/40',
        'transition-all duration-200 min-h-[140px]',
      )}
    >
      <div className="w-10 h-10 rounded-xl border border-white/10 group-hover:border-primary/40 flex items-center justify-center transition-colors">
        <PlusCircle className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
      </div>
      <span className="text-xs font-medium text-muted-foreground/40 group-hover:text-primary transition-colors">
        New brand
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectsPage() {
  const router = useRouter()
  const { projects, setProjects, setChats, setActiveChat, setWizardOpen, user } = useAppStore()
  const [loading, setLoading] = useState(true)

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

  const brandCount = projects.length

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <AnnouncementBanner />

        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <SidebarToggle />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold leading-none">Your brands</h1>
            {!loading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {brandCount === 0
                  ? 'No brands yet'
                  : `${brandCount} workspace${brandCount !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + New brand
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_60%_30%_at_50%_0%,hsl(var(--primary)/0.06),transparent)]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-card border border-border/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-2.5 w-20" />
                        <Skeleton className="h-2 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-px w-full" />
                    <Skeleton className="h-8 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            )}

            {!loading && brandCount === 0 && <OnboardingCard />}

            {!loading && brandCount > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpenChat={() => openChat(project.id)}
                    onNavigate={(path) => router.push(path)}
                  />
                ))}
                <NewProjectCard onClick={() => setWizardOpen(true)} />
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
