'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { signOut } from 'firebase/auth'
import {
  PlusIcon, MessageSquare, ChevronDown, LogOut, Layers,
  CreditCard, Pencil, Trash2, Check, X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { auth } from '@/lib/firebase'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { Project, Chat } from '@/types'

// ---------------------------------------------------------------------------
// Sidebar shell
// ---------------------------------------------------------------------------

export function Sidebar() {
  const router = useRouter()
  const params = useParams<{ projectId?: string; chatId?: string }>()

  const {
    user, projects, setProjects, activeProject, setActiveProject,
    chats, setChats, setActiveChat, setIngestionOpen,
    billingStatus, openUpgradeModal,
    upsertProject, removeProject, upsertChat, removeChat,
  } = useAppStore()

  const [creating, setCreating] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [createError, setCreateError] = useState('')

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
    } catch (err) {
      const msg = String(err)
      if (msg.includes('402')) {
        setShowNewProject(false)
        openUpgradeModal("You've reached your project limit. Upgrade to create more brands.")
      } else {
        setCreateError(msg)
      }
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
    } catch (err) { console.error(err) }
  }

  async function handleRenameProject(project: Project, name: string) {
    try {
      await api.projects.update(project.id, { name })
      upsertProject({ ...project, name })
    } catch (err) { console.error(err) }
  }

  async function handleDeleteProject(project: Project) {
    try {
      await api.projects.delete(project.id)
      removeProject(project.id)
      if (activeProject?.id === project.id) {
        router.push('/')
      }
    } catch (err) { console.error(err) }
  }

  async function handleRenameChat(chat: Chat, name: string) {
    if (!activeProject) return
    try {
      await api.chats.rename(activeProject.id, chat.id, name)
      upsertChat({ ...chat, name })
    } catch (err) { console.error(err) }
  }

  async function handleDeleteChat(chat: Chat) {
    if (!activeProject) return
    try {
      await api.chats.delete(activeProject.id, chat.id)
      removeChat(chat.id)
      if (params.chatId === chat.id) {
        const remaining = chats.filter((c) => c.id !== chat.id)
        if (remaining.length > 0) {
          openChat(activeProject, remaining[0])
        } else {
          router.push('/')
        }
      }
    } catch (err) { console.error(err) }
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
        {projects.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Layers className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-xs text-muted-foreground">No projects yet.</p>
            <button onClick={() => setShowNewProject(true)} className="mt-2 text-xs text-primary underline underline-offset-2">
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
      <div className="border-t border-border p-3 space-y-2">
        {billingStatus && (
          <div className="px-1 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="capitalize">{billingStatus.plan} plan</span>
              <span>{billingStatus.messages.used}/{billingStatus.messages.limit >= 999 ? '∞' : billingStatus.messages.limit} msgs</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  billingStatus.messages.used / billingStatus.messages.limit >= 0.9 ? 'bg-red-500'
                  : billingStatus.messages.used / billingStatus.messages.limit >= 0.7 ? 'bg-amber-500'
                  : 'bg-primary'
                }`}
                style={{
                  width: billingStatus.messages.limit >= 999
                    ? '5%'
                    : `${Math.min((billingStatus.messages.used / billingStatus.messages.limit) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}
        <button
          onClick={() => router.push('/billing')}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Plans & Billing</span>
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="truncate text-xs">{user?.email ?? 'Sign out'}</span>
        </button>
      </div>
    </aside>
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
      <div className={cn(
        'group flex items-center gap-1 w-full px-3 py-2 transition-colors',
        isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
      )}>
        {editing ? (
          <>
            <input
              ref={inputRef}
              autoFocus
              className="flex-1 min-w-0 rounded border border-input bg-background px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
              onBlur={saveEdit}
            />
            <button onClick={() => setEditing(false)} className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </>
        ) : confirmDelete ? (
          <div className="flex-1 flex items-center gap-1.5">
            <span className="text-xs text-destructive flex-1 truncate">Delete {project.name}?</span>
            <button onClick={() => { onDelete(); setConfirmDelete(false) }} className="text-xs text-destructive hover:underline shrink-0">Yes</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:underline shrink-0">No</button>
          </div>
        ) : (
          <>
            <button onClick={onSelect} className="flex items-center gap-2 flex-1 min-w-0 text-left text-sm font-medium">
              <ChevronDown className={cn('w-3 h-3 shrink-0 transition-transform', isActive ? '' : '-rotate-90')} />
              <span className="truncate">{project.name}</span>
            </button>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={startEdit} className="p-0.5 rounded hover:bg-muted" title="Rename">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={startDelete} className="p-0.5 rounded hover:bg-muted text-destructive/70 hover:text-destructive" title="Delete">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Chat list (expanded when active) */}
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
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  isActive={activeChatId === chat.id}
                  onOpen={() => onOpenChat(chat)}
                  onRename={(name) => onRenameChat(chat, name)}
                  onDelete={() => onDeleteChat(chat)}
                />
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

// ---------------------------------------------------------------------------
// ChatRow
// ---------------------------------------------------------------------------

function ChatRow({
  chat, isActive, onOpen, onRename, onDelete,
}: {
  chat: Chat
  isActive: boolean
  onOpen: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
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

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/5">
        <span className="text-xs text-destructive flex-1 truncate">Delete?</span>
        <button onClick={() => { onDelete(); setConfirmDelete(false) }} className="text-xs text-destructive hover:underline shrink-0">Yes</button>
        <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:underline shrink-0">No</button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-1 py-0.5">
        <input
          ref={inputRef}
          autoFocus
          className="flex-1 min-w-0 rounded border border-input bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
          onBlur={saveEdit}
        />
        <button onClick={saveEdit} className="shrink-0 p-0.5 text-primary"><Check className="w-3 h-3" /></button>
        <button onClick={() => setEditing(false)} className="shrink-0 p-0.5 text-muted-foreground"><X className="w-3 h-3" /></button>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-0.5">
      <button
        onClick={onOpen}
        className={cn(
          'flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1 rounded-md text-left text-xs transition-colors',
          isActive ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )}
      >
        <MessageSquare className="w-3 h-3 shrink-0" />
        <span className="truncate">{chat.name}</span>
      </button>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pr-1">
        <button onClick={startEdit} className="p-0.5 rounded hover:bg-muted text-muted-foreground" title="Rename">
          <Pencil className="w-2.5 h-2.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }} className="p-0.5 rounded hover:bg-muted text-destructive/60 hover:text-destructive" title="Delete">
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  )
}
