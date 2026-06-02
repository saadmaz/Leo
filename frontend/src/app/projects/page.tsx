'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Library, BarChart2, PlusCircle } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/lib/api'
import { Sidebar, SidebarToggle } from '@/components/layout/sidebar'
import { AnnouncementBanner } from '@/components/layout/announcement-banner'
import { OnboardingCard } from '@/components/onboarding/onboarding-card'
import { Skeleton } from '@/components/ui/skeleton'
import { getBrandGradient, getBrandInitials, getBrandTextColor } from '@/lib/brand-utils'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'

// ---------------------------------------------------------------------------
// Project card
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
  const initials = getBrandInitials(project.name)
  const gradient = getBrandGradient(project.name)
  const textColor = getBrandTextColor(project.name)

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl overflow-hidden cursor-pointer',
        'bg-card/60 hover:bg-card/90',
        'shadow-sm hover:shadow-md',
        'transition-all duration-200',
        'backdrop-blur-sm',
        !hasBrandCore && 'border-l-2 border-amber-500/60',
      )}
      onClick={() => onNavigate(`/projects/${project.id}/dashboard`)}
    >
      {/* Card body */}
      <div className="p-5 pb-3 flex-1">
        {/* Top row: avatar + name + secondary icon actions */}
        <div className="flex items-start gap-3">
          {/* Avatar */}
          {project.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.logoUrl}
              alt={project.name}
              className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-border/50"
            />
          ) : (
            <div
              className={cn(
                'w-14 h-14 rounded-2xl bg-gradient-to-br shrink-0',
                'flex items-center justify-center',
                gradient,
              )}
            >
              <span className={cn('text-lg font-bold', textColor)}>{initials}</span>
            </div>
          )}

          {/* Name and description */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {project.description}
              </p>
            )}
          </div>

          {/* Icon-only secondary actions */}
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              title="Open chat"
              onClick={onOpenChat}
              className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
            <button
              title="Library"
              onClick={() => onNavigate(`/projects/${project.id}/library`)}
              className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            >
              <Library className="w-3.5 h-3.5" />
            </button>
            <button
              title="Analytics"
              onClick={() => onNavigate(`/projects/${project.id}/analytics`)}
              className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Brand setup nudge — only shown when core is missing */}
        {!hasBrandCore && (
          <p className="text-[11px] text-amber-500/80 mt-3">
            Complete brand setup →
          </p>
        )}
      </div>

      {/* Primary CTA — full width at card bottom */}
      <div className="px-5 pb-5 pt-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onNavigate(`/projects/${project.id}/dashboard`)}
          className="w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          Open
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// New project card
// ---------------------------------------------------------------------------

function NewProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col items-center justify-center gap-2 rounded-2xl p-5 min-h-44',
        'border-2 border-dashed border-white/10 hover:border-primary/40',
        'transition-all duration-200',
      )}
    >
      <PlusCircle className="w-8 h-8 text-muted-foreground/40 group-hover:text-primary transition-colors" />
      <span className="text-sm text-muted-foreground/60 group-hover:text-primary transition-colors font-medium">
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
                {brandCount === 0 ? 'No brands yet' : `${brandCount} workspace${brandCount !== 1 ? 's' : ''}`}
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

        <div className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_60%_30%_at_50%_0%,hsl(var(--primary)/0.07),transparent)]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

            {/* Loading skeleton */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-card/60 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="w-14 h-14 rounded-2xl" />
                      <div className="space-y-1.5 flex-1 pt-1">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-2.5 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-7 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            )}

            {/* No projects — onboarding */}
            {!loading && brandCount === 0 && (
              <OnboardingCard />
            )}

            {/* Brand cards grid */}
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
