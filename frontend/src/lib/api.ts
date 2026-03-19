import { auth } from './firebase'
import type { BrandCore, Chat, IngestionEvent, Message, Project, ProjectCreate, StreamEvent } from '@/types'

const API = '/api/backend'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser
  const token = user ? await user.getIdToken() : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}: ${await res.text()}`)
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export const api = {
  projects: {
    list: () => get<Project[]>('/projects'),
    get: (id: string) => get<Project>(`/projects/${id}`),
    create: (body: ProjectCreate) => post<Project>('/projects', body),
    update: (id: string, body: Partial<ProjectCreate>) => patch<Project>(`/projects/${id}`, body),
    delete: (id: string) => del(`/projects/${id}`),
  },

  chats: {
    list: (projectId: string) => get<Chat[]>(`/projects/${projectId}/chats`),
    get: (projectId: string, chatId: string) =>
      get<Chat>(`/projects/${projectId}/chats/${chatId}`),
    create: (projectId: string, name?: string) =>
      post<Chat>(`/projects/${projectId}/chats`, { name: name ?? 'New Chat' }),
    rename: (projectId: string, chatId: string, name: string) =>
      patch<Chat>(`/projects/${projectId}/chats/${chatId}`, { name }),
    delete: (projectId: string, chatId: string) =>
      del(`/projects/${projectId}/chats/${chatId}`),
    messages: (projectId: string, chatId: string) =>
      get<Message[]>(`/projects/${projectId}/chats/${chatId}/messages`),
  },

  async streamMessage(
    projectId: string,
    chatId: string,
    content: string,
    callbacks: {
      onDelta: (text: string) => void
      onDone: () => void
      onError: (err: string) => void
    },
  ): Promise<void> {
    const user = auth.currentUser
    if (!user) { callbacks.onError('Not authenticated'); return }

    const token = await user.getIdToken()

    let res: Response
    try {
      res = await fetch(`${API}/projects/${projectId}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      })
    } catch (err) {
      callbacks.onError(String(err))
      return
    }

    if (!res.ok) { callbacks.onError(`${res.status}: ${await res.text()}`); return }

    const reader = res.body?.getReader()
    if (!reader) { callbacks.onError('No readable stream in response'); return }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') { callbacks.onDone(); return }
          try {
            const event = JSON.parse(raw) as StreamEvent
            if (event.type === 'delta') callbacks.onDelta(event.content)
            if (event.type === 'error') callbacks.onError(event.error)
          } catch { /* skip malformed */ }
        }
      }
    } finally {
      reader.releaseLock()
    }
    callbacks.onDone()
  },

  brandCore: {
    get: (projectId: string) =>
      get<{ brandCore: BrandCore | null; ingestionStatus: string | null }>(
        `/projects/${projectId}/brand-core`,
      ),
    update: (projectId: string, data: Partial<BrandCore>) =>
      patch<{ brandCore: BrandCore }>(`/projects/${projectId}/brand-core`, data),
    clear: (projectId: string) =>
      del(`/projects/${projectId}/brand-core`),
  },

  async streamIngestion(
    projectId: string,
    body: { websiteUrl?: string; instagramHandle?: string },
    callbacks: {
      onStep: (step: import('@/types').IngestionStep) => void
      onProgress: (pct: number) => void
      onDone: (brandCore: BrandCore) => void
      onError: (message: string) => void
    },
  ): Promise<void> {
    const user = auth.currentUser
    if (!user) { callbacks.onError('Not authenticated'); return }
    const token = await user.getIdToken()

    let res: Response
    try {
      res = await fetch(`${API}/projects/${projectId}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
    } catch (err) {
      callbacks.onError(String(err))
      return
    }

    if (!res.ok) { callbacks.onError(`${res.status}: ${await res.text()}`); return }

    const reader = res.body?.getReader()
    if (!reader) { callbacks.onError('No stream'); return }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') return
          try {
            const event = JSON.parse(raw) as IngestionEvent
            if (event.type === 'step') callbacks.onStep(event)
            if (event.type === 'progress') callbacks.onProgress(event.pct)
            if (event.type === 'done') callbacks.onDone(event.brandCore)
            if (event.type === 'error') callbacks.onError(event.message)
          } catch { /* skip malformed */ }
        }
      }
    } finally {
      reader.releaseLock()
    }
  },

  health: () => get<{ status: string }>('/health'),
}
