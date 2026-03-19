import { create } from 'zustand'
import type { AppUser, Chat, OptimisticMessage, Project } from '@/types'

interface AppState {
  // Auth
  user: AppUser | null
  setUser: (user: AppUser | null) => void

  // Projects
  projects: Project[]
  activeProject: Project | null
  setProjects: (projects: Project[]) => void
  setActiveProject: (project: Project | null) => void
  upsertProject: (project: Project) => void
  removeProject: (id: string) => void

  // Chats
  chats: Chat[]
  activeChat: Chat | null
  setChats: (chats: Chat[]) => void
  setActiveChat: (chat: Chat | null) => void
  upsertChat: (chat: Chat) => void
  removeChat: (id: string) => void

  // Messages
  messages: OptimisticMessage[]
  setMessages: (messages: OptimisticMessage[]) => void
  appendDelta: (id: string, delta: string) => void
  addMessage: (msg: OptimisticMessage) => void
  finaliseMessage: (id: string, content: string) => void

  // UI
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // Projects
  projects: [],
  activeProject: null,
  setProjects: (projects) => set({ projects }),
  setActiveProject: (activeProject) => set({ activeProject }),
  upsertProject: (project) =>
    set((s) => ({
      projects: s.projects.some((p) => p.id === project.id)
        ? s.projects.map((p) => (p.id === project.id ? project : p))
        : [project, ...s.projects],
      activeProject: s.activeProject?.id === project.id ? project : s.activeProject,
    })),
  removeProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProject: s.activeProject?.id === id ? null : s.activeProject,
    })),

  // Chats
  chats: [],
  activeChat: null,
  setChats: (chats) => set({ chats }),
  setActiveChat: (activeChat) => set({ activeChat, messages: [] }),
  upsertChat: (chat) =>
    set((s) => ({
      chats: s.chats.some((c) => c.id === chat.id)
        ? s.chats.map((c) => (c.id === chat.id ? chat : c))
        : [chat, ...s.chats],
      activeChat: s.activeChat?.id === chat.id ? chat : s.activeChat,
    })),
  removeChat: (id) =>
    set((s) => ({
      chats: s.chats.filter((c) => c.id !== id),
      activeChat: s.activeChat?.id === id ? null : s.activeChat,
    })),

  // Messages
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendDelta: (id, delta) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + delta } : m,
      ),
    })),
  finaliseMessage: (id, content) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content, pending: false } : m,
      ),
    })),

  // UI
  isStreaming: false,
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}))
