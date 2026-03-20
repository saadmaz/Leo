'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/lib/api'
import { Sidebar, SidebarToggle } from '@/components/layout/sidebar'
import { OnboardingCard } from '@/components/onboarding/onboarding-card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight } from 'lucide-react'

export default function ProjectsPage() {
  const router = useRouter()
  const { user, projects, setProjects, setChats, setActiveChat } = useAppStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { router.replace('/login'); return }
    setLoading(true)
    api.projects.list()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, router, setProjects])

  async function openProject(projectId: string) {
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
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border md:hidden">
          <SidebarToggle />
          <span className="font-bold text-sm">LEO</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {loading ? (
            /* Skeleton state */
            <div className="w-full max-w-xl space-y-3">
              <Skeleton className="h-6 w-32 mb-6" />
              {[1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            /* First-run onboarding */
            <OnboardingCard />
          ) : (
            /* Project list */
            <div className="w-full max-w-xl space-y-3">
              <h2 className="text-lg font-semibold mb-6">Your brands</h2>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => openProject(project.id)}
                  className="flex items-center justify-between w-full rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium">{project.name}</p>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {project.brandCore ? '✦ Brand Core ready' : 'Brand Core not set up'}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
