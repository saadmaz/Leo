'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/lib/api'
import { Sidebar } from '@/components/layout/sidebar'
import { Layers, ArrowRight } from 'lucide-react'

export default function ProjectsPage() {
  const router = useRouter()
  const { user, projects, setProjects, setChats, setActiveChat } = useAppStore()

  useEffect(() => {
    if (!user) { router.replace('/login'); return }
    api.projects.list().then(setProjects).catch(console.error)
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

      <main className="flex-1 flex flex-col items-center justify-center p-8">
        {projects.length === 0 ? (
          <div className="text-center space-y-4 max-w-sm">
            <Layers className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <h2 className="text-xl font-semibold">No brands yet</h2>
            <p className="text-sm text-muted-foreground">
              Create your first brand project using the <strong>+</strong> button in the sidebar.
              LEO will build your Brand Core and help you create on-brand content.
            </p>
          </div>
        ) : (
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
      </main>
    </div>
  )
}
