'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { signOut } from 'firebase/auth'
import {
  PlusIcon, MessageSquare, ChevronDown, LogOut, Layers,
  CreditCard, Pencil, Trash2, X, Moon, Sun, Settings, Menu,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { auth } from '@/lib/firebase'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { Project, Chat } from '@/types'

// ---------------------------------------------------------------------------
// Sidebar shell
// ---------------------------------------------------------------------------

export function Sidebar() {
  const router = useRouter()
  const params = useParams<{ projectId?: string; chatId?: string }>()
  const { resolvedTheme, setTheme } = useTheme()

  const {
    user, projects, setProjects, activeProject, setActiveProject,
    chats, setChats, setActiveChat, setIngestionOpen,
    billingStatus, openUpgradeModal,
    upsertProject, removeProject, upsertChat, removeChat,
    sidebarOpen, setSidebarOpen,
  } = useAppStore()

  const [creating, setCreating] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [createError, setCreateError] = useState('')
  const [projectsLoading, setProjectsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setProjectsLoading(true)
    api.projects.list()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setProjectsLoading(false))
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
    setCreateError('')
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
      setIngestionOpen(true)
      toast.success(`Brand "${project.name}" created`)
    } catch (err) {
      const msg = String(err)
      if (msg.includes('402')) {
        setShowNewProject(false)
        openUpgradeModal("You've reached your project limit. Upgrade to create more brands.")
      } else {
        setCreateError(msg)
        toast.error('Failed to create project')
      }
    } finally {
      setCreating(false)
    }
  }

  async function openChat(project: Project, chat: Chat) {
    setActiveProject(project)
    setActiveChat(chat)
    router.push(`/projects/${project.id}/chats/${chat.id}`)
    // Close sidebar on mobile after navigation
    setSidebarOpen(false)
  }

  async function newChat(project: Project) {
    try {
      const chat = await api.chats.create(project.id)
      setChats([chat, ...chats])
      openChat(project, chat)
    } catch (err) {
      console.error(err)
      toast.error('Failed to create chat')
    }
  }

  async function handleRenameProject(project: Project, name: string) {
    try {
      await api.projects.update(project.id, { name })
      upsertProject({ ...project, name })
      toast.success('Project renamed')
    } catch (err) {
      console.error(err)
      toast.error('Failed to rename project')
    }
  }

  async function handleDeleteProject(project: Project) {
    try {
      await api.projects.delete(project.id)
      removeProject(project.id)
      toast.success(`"${project.name}" deleted`)
      if (activeProject?.id === project.id) {
        router.push('/')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete project')
    }
  }

  async function handleRenameChat(chat: Chat, name: string) {
    if (!activeProject) return
    try {
      await api.chats.rename(activeProject.id, chat.id, name)
      upsertChat({ ...chat, name })
      toast.success('Chat renamed')
    } catch (err) {
      console.error(err)
      toast.error('Failed to rename chat')
    }
  }

  async function handleDeleteChat(chat: Chat) {
    if (!activeProject) return
    try {
      await api.chats.delete(activeProject.id, chat.id)
      removeChat(chat.id)
      toast.success('Chat deleted')
      if (params.chatId === chat.id) {
        const remaining = chats.filter((c) => c.id !== chat.id)
        if (remaining.length > 0) {
          openChat(activeProject, remaining[0])
        } else {
          router.push('/')
        }
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete chat')
    }
  }

  async function handleSignOut() {
    await signOut(auth)
    router.replace('/login')
  }

  // Close on Escape key (mobile UX)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSidebarOpen])

  const isDark = resolvedTheme === 'dark'

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          // Base layout
          'flex flex-col w-60 shrink-0 border-r border-border bg-card h-screen z-50',
          // Desktop: always in-flow
          'md:relative md:translate-x-0 md:flex',
          // Mobile: fixed overlay, slide in/out
          'fixed inset-y-0 left-0 transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <span className="text-base font-bold tracking-tight">LEO</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewProject(true)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="New project"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
            {/* Close button — mobile only */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors md:hidden"
              title="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
                {createError && <p className="text-xs text-red-500 break-all">{createError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={createProject}
                    disabled={creating || !newProjectName.trim()}
                    className="flex-1 rounded-md bg-primary text-primary-foreground py-1 text-xs font-medium disabled:opacity-50"
                  >
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    onClick={() => { setShowNewProject(false); setCreateError('') }}
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
          {projectsLoading ? (
            <div className="px-3 py-2 space-y-1">
              {[80, 65, 72].map((w) => (
                <div key={w} className="flex items-center gap-2 px-2 py-2">
                  <Skeleton className="h-3 w-3 rounded shrink-0" />
                  <Skeleton className={`h-3 rounded`} style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Layers className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-xs text-muted-foreground">No projects yet.</p>
              <button onClick={() => setShowNewProject(true)} className="mt-2 text-xs text-primary underline underline-offset-2">
                Create your first brand
              </button>
            </div>
          ) : null}

          {!projectsLoading && projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              isActive={activeProject?.id === project.id}
              activeChatId={params.chatId}
              chats={activeProject?.id === project.id ? chats : []}
              onOpenChat={(chat) => openChat(project, chat)}
              onNewChat={() => newChat(project)}
              onRename={(name) => handleRenameProject(project, name)}
              onDelete={() => handleDeleteProject(project)}
              onRenameChat={handleRenameChat}
              onDeleteChat={handleDeleteChat}
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
        <div className="border-t border-border p-3 space-y-1">
          {/* Usage bar */}
          {billingStatus && (
            <div className="px-1 mb-2 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="capitalize">{billingStatus.plan} plan</span>
                <span>{billingStatus.messages.used}/{billingStatus.messages.limit >= 999 ? '∞' : billingStatus.messages.limit} msgs</span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    billingStatus.messages.used / billingStatus.messages.limit >= 0.9 ? 'bg-red-500'
                    : billingStatus.messages.used / billingStatus.messages.limit >= 0.7 ? 'bg-amber-500'
                    : 'bg-primary',
                  )}
                  style={{
                    width: billingStatus.messages.limit >= 999
                      ? '5%'
                      : `${Math.min((billingStatus.messages.used / billingStatus.messages.limit) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => router.push('/settings')}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>

          {/* Billing */}
          <button
            onClick={() => router.push('/billing')}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Plans & Billing</span>
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="truncate text-xs">{user?.email ?? 'Sign out'}</span>
          </button>
        </div>
      </aside>
    </>
  )
}

// ---------------------------------------------------------------------------
// Hamburger toggle — render this in any page header for mobile
// ---------------------------------------------------------------------------

export function SidebarToggle({ className }: { className?: string }) {
  const { setSidebarOpen } = useAppStore()
  return (
    <button
      onClick={() => setSidebarOpen(true)}
      className={cn(
        'md:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
        className,
      )}
      title="Open sidebar"
    >
      <Menu className="w-4 h-4" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// ProjectRow
// ---------------------------------------------------------------------------

interface ProjectRowProps {
  project: Project
  isActive: boolean
  activeChatId?: string
  chats: Chat[]
  onSelect: () => void
  onOpenChat: (chat: Chat) => void
  onNewChat: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onRenameChat: (chat: Chat, name: string) => void
  onDeleteChat: (chat: Chat) => void
}

function ProjectRow({
  project, isActive, activeChatId, chats,
  onSelect, onOpenChat, onNewChat,
  onRename, onDelete, onRenameChat, onDeleteChat,
}: ProjectRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(project.name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function saveEdit() {
    if (draft.trim() && draft !== project.name) onRename(draft.trim())
    setEditing(false)
  }

  function startDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDelete(true)
  }

  return (
    <div>
      {/* Project header row */}
      <div
        className={cn(
          'group flex items-center gap-1 w-full px-3 py-2 transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="flex-1 min-w-0 text-xs bg-transparent border-b border-primary focus:outline-none py-0.5"
            onClick={(e) => e.stopPropagation()}
          />
        ) : confirmDelete ? (
          <span className="flex-1 min-w-0 text-xs truncate text-destructive">Delete &quot;{project.name}&quot;?</span>
        ) : (
          <button
            onClick={onSelect}
            className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
          >
            <ChevronDown
              className={cn(
                'w-3 h-3 shrink-0 transition-transform',
                isActive ? 'rotate-0' : '-rotate-90',
              )}
            />
            <span className="text-xs font-medium truncate">{project.name}</span>
          </button>
        )}

        {confirmDelete ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); setConfirmDelete(false) }}
              className="text-[10px] text-destructive hover:underline"
            >
              Yes
            </button>
            <span className="text-muted-foreground/40 text-[10px]">/</span>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              No
            </button>
          </div>
        ) : !editing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={startEdit}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Rename"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={startDelete}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onNewChat() }}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="New chat"
            >
              <PlusIcon className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Chat list — only shown when project is active */}
      {isActive && (
        <div className="pb-1">
          {chats.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onOpen={() => onOpenChat(chat)}
              onRename={(name) => onRenameChat(chat, name)}
              onDelete={() => onDeleteChat(chat)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatRow
// ---------------------------------------------------------------------------

interface ChatRowProps {
  chat: Chat
  isActive: boolean
  onOpen: () => void
  onRename: (name: string) => void
  onDelete: () => void
}

function ChatRow({ chat, isActive, onOpen, onRename, onDelete }: ChatRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(chat.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(chat.name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function saveEdit() {
    if (draft.trim() && draft !== chat.name) onRename(draft.trim())
    setEditing(false)
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-1 pl-6 pr-2 py-1.5 mx-1 rounded-md transition-colors',
        isActive
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
    >
      <MessageSquare className="w-3 h-3 shrink-0" />

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="flex-1 min-w-0 text-xs bg-transparent border-b border-primary focus:outline-none py-0.5"
          onClick={(e) => e.stopPropagation()}
        />
      ) : confirmDelete ? (
        <>
          <span className="flex-1 min-w-0 text-xs truncate text-destructive">Delete?</span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); setConfirmDelete(false) }}
              className="text-[10px] text-destructive hover:underline"
            >
              Yes
            </button>
            <span className="text-muted-foreground/40 text-[10px]">/</span>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              No
            </button>
          </div>
        </>
      ) : (
        <>
          <button onClick={onOpen} className="flex-1 min-w-0 text-left">
            <span className="text-xs truncate block">{chat.name}</span>
          </button>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={startEdit}
              className="p-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground"
              title="Rename"
            >
              <Pencil className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
              className="p-0.5 rounded hover:bg-background text-muted-foreground hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
