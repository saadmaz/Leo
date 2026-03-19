'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { PlusIcon, MessageSquare, ChevronDown, LogOut, Layers } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { auth } from '@/lib/firebase'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { Project, Chat } from '@/types'

export function Sidebar() {
  const router = useRouter()
  const params = useParams<{ projectId?: string; chatId?: string }>()

  const { user, projects, setProjects, activeProject, setActiveProject, chats, setChats, setActiveChat } = useAppStore()

  const [creating, setCreating] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)

  useEffect(() => {
    if (!user) return
    api.projects.list().then(setProjects).catch(console.error)
  }, [user, setProjects])

  useEffect(() => {
    if (!activeProject) { setChats([]); return }
    api.chats.list(activeProject.id).then(setChats).catch(console.error)
  }, [activeProject, setChats])

  useEffect(() => {
    if (!params.projectId || !projects.length) return
    const found = projects.find((p) => p.id === params.projectId)
    if (found && found.id !== activeProject?.id) setActiveProject(found)
  }, [params.projectId, projects, activeProject, setActiveProject])

  async function createProject() {
    if (!newProjectName.trim()) return
    setCreating(true)
    try {
      const project = await api.projects.create({ name: newProjectName.trim() })
      setProjects([project, ...projects])
      setActiveProject(project)
      setNewProjectName('')
      setShowNewProject(false)
      const chat = await api.chats.create(project.id, 'New Chat')
      setChats([chat])
      setActiveChat(chat)
      router.push(`/projects/${project.id}/chats/${chat.id}`)
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  async function openChat(project: Project, chat: Chat) {
    setActiveProject(project)
    setActiveChat(chat)
    router.push(`/projects/${project.id}/chats/${chat.id}`)
  }

  async function newChat(project: Project) {
    try {
      const chat = await api.chats.create(project.id)
      setChats([chat, ...chats])
      openChat(project, chat)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleSignOut() {
    await signOut(auth)
    router.replace('/login')
  }

  return (
    <aside className="flex flex-col w-60 shrink-0 border-r border-border bg-card h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <span className="text-base font-bold tracking-tight">LEO</span>
        <button
          onClick={() => setShowNewProject(true)}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="New project"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {/* New project input */}
      <AnimatePresence>
        {showNewProject && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border"
          >
            <div className="p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">New project</p>
              <input
                autoFocus
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Brand name…"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createProject()
                  if (e.key === 'Escape') setShowNewProject(false)
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={createProject}
                  disabled={creating || !newProjectName.trim()}
                  className="flex-1 rounded-md bg-primary text-primary-foreground py-1 text-xs font-medium disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
                <button
                  onClick={() => setShowNewProject(false)}
                  className="flex-1 rounded-md border border-border py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto py-2">
        {projects.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Layers className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-xs text-muted-foreground">No projects yet.</p>
            <button
              onClick={() => setShowNewProject(true)}
              className="mt-2 text-xs text-primary underline underline-offset-2"
            >
              Create your first brand
            </button>
          </div>
        )}

        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            isActive={activeProject?.id === project.id}
            activeChatId={params.chatId}
            chats={activeProject?.id === project.id ? chats : []}
            onOpenChat={(chat) => openChat(project, chat)}
            onNewChat={() => newChat(project)}
            onSelect={() => {
              setActiveProject(project)
              if (activeProject?.id !== project.id) {
                api.chats.list(project.id).then((c) => {
                  setChats(c)
                  if (c.length > 0) openChat(project, c[0])
                })
              }
            }}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="truncate text-xs">{user?.email ?? 'Sign out'}</span>
        </button>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------

interface ProjectRowProps {
  project: Project
  isActive: boolean
  activeChatId?: string
  chats: Chat[]
  onSelect: () => void
  onOpenChat: (chat: Chat) => void
  onNewChat: () => void
}

function ProjectRow({ project, isActive, activeChatId, chats, onSelect, onOpenChat, onNewChat }: ProjectRowProps) {
  return (
    <div>
      <button
        onClick={onSelect}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-medium transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )}
      >
        <ChevronDown className={cn('w-3 h-3 shrink-0 transition-transform', isActive ? '' : '-rotate-90')} />
        <span className="truncate">{project.name}</span>
      </button>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="ml-6 border-l border-border pl-2 py-1 space-y-0.5">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => onOpenChat(chat)}
                  className={cn(
                    'flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-left text-xs transition-colors',
                    activeChatId === chat.id
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  <MessageSquare className="w-3 h-3 shrink-0" />
                  <span className="truncate">{chat.name}</span>
                </button>
              ))}
              <button
                onClick={onNewChat}
                className="flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <PlusIcon className="w-3 h-3 shrink-0" />
                <span>New chat</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
