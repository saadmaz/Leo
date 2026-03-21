/**
 * API client — thin wrapper around fetch for all backend communication.
 *
 * Design principles:
 *  - All requests are authenticated via Firebase ID tokens (injected by authHeaders()).
 *  - REST operations (get/post/patch/del) are generic and typed at call sites.
 *  - SSE streaming uses a shared readSSEStream() helper to avoid duplication
 *    and ensure consistent buffer handling across chat and ingestion.
 *  - AbortSignal support lets callers cancel in-flight requests (important
 *    for cleaning up when a component unmounts mid-stream).
 */

import { auth } from './firebase'
import type {
  BillingStatus,
  BrandCore,
  Chat,
  ImageAttachment,
  IngestionEvent,
  Message,
  Project,
  ProjectCreate,
  StreamEvent,
} from '@/types'

// All backend requests are proxied through Next.js rewrites defined in
// next.config.js so the browser never talks to the backend directly.
const API = '/api/backend'

// ---------------------------------------------------------------------------
// Auth headers
// ---------------------------------------------------------------------------

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser
  const token = user ? await user.getIdToken() : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// ---------------------------------------------------------------------------
// Core HTTP helpers
// ---------------------------------------------------------------------------

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: await authHeaders(),
    signal,
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function patch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function del(path: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
    signal,
  })
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}: ${await res.text()}`)
}

// ---------------------------------------------------------------------------
// Shared SSE stream reader
// ---------------------------------------------------------------------------

/**
 * Read a Server-Sent Events stream from a ReadableStream, parsing each
 * `data: ...` line as JSON and dispatching to the appropriate callback.
 *
 * This is used by both streamMessage() and streamIngestion() so the
 * buffering and parsing logic lives in exactly one place.
 *
 * @param reader   ReadableStreamDefaultReader obtained from response.body.
 * @param onEvent  Called for each parsed event object.
 * @param onDone   Called when the sentinel `data: [DONE]` is received OR
 *                 when the stream closes naturally (done === true).
 */
async function readSSEStream<TEvent>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: TEvent) => void,
  onDone: () => void,
): Promise<void> {
  const decoder = new TextDecoder()
  // Incomplete line fragments are buffered here across read() calls.
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE lines are separated by \n. The last element may be an incomplete
      // line; keep it in the buffer for the next iteration.
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue

        const raw = line.slice(6).trim()

        // The [DONE] sentinel signals the end of the logical stream.
        if (raw === '[DONE]') {
          onDone()
          return
        }

        try {
          const event = JSON.parse(raw) as TEvent
          onEvent(event)
        } catch {
          // Malformed JSON — skip the line. The backend logs these.
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  // Stream closed without an explicit [DONE] — treat as completion.
  onDone()
}

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------

export const api = {
  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------
  projects: {
    list: (signal?: AbortSignal) => get<Project[]>('/projects', signal),
    get: (id: string, signal?: AbortSignal) => get<Project>(`/projects/${id}`, signal),
    create: (body: ProjectCreate, signal?: AbortSignal) =>
      post<Project>('/projects', body, signal),
    update: (id: string, body: Partial<ProjectCreate>, signal?: AbortSignal) =>
      patch<Project>(`/projects/${id}`, body, signal),
    delete: (id: string, signal?: AbortSignal) => del(`/projects/${id}`, signal),
  },

  // -------------------------------------------------------------------------
  // Chats
  // -------------------------------------------------------------------------
  chats: {
    list: (projectId: string, signal?: AbortSignal) =>
      get<Chat[]>(`/projects/${projectId}/chats`, signal),
    get: (projectId: string, chatId: string, signal?: AbortSignal) =>
      get<Chat>(`/projects/${projectId}/chats/${chatId}`, signal),
    create: (projectId: string, name?: string, signal?: AbortSignal) =>
      post<Chat>(`/projects/${projectId}/chats`, { name: name ?? 'New Chat' }, signal),
    rename: (projectId: string, chatId: string, name: string, signal?: AbortSignal) =>
      patch<Chat>(`/projects/${projectId}/chats/${chatId}`, { name }, signal),
    delete: (projectId: string, chatId: string, signal?: AbortSignal) =>
      del(`/projects/${projectId}/chats/${chatId}`, signal),
    messages: (projectId: string, chatId: string, signal?: AbortSignal) =>
      get<Message[]>(`/projects/${projectId}/chats/${chatId}/messages`, signal),
  },

  // -------------------------------------------------------------------------
  // Chat streaming (SSE)
  // -------------------------------------------------------------------------

  /**
   * Send a user message and stream the assistant's response via SSE.
   *
   * @param signal  Optional AbortSignal to cancel the request (e.g. on
   *                component unmount or when the user hits "Stop").
   */
  async streamMessage(
    projectId: string,
    chatId: string,
    content: string,
    callbacks: {
      onDelta: (text: string) => void
      onDone: () => void
      onError: (err: string) => void
    },
    signal?: AbortSignal,
    channel?: string | null,
    images?: Pick<ImageAttachment, 'base64' | 'mediaType'>[],
  ): Promise<void> {
    const user = auth.currentUser
    if (!user) { callbacks.onError('Not authenticated'); return }

    const token = await user.getIdToken()

    let res: Response
    try {
      res = await fetch(`${API}/projects/${projectId}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content,
          ...(channel ? { channel } : {}),
          ...(images && images.length > 0 ? { images } : {}),
        }),
        signal,
      })
    } catch (err) {
      // AbortError is expected when signal.abort() is called — don't surface it as an error.
      if (err instanceof DOMException && err.name === 'AbortError') return
      callbacks.onError(String(err))
      return
    }

    if (!res.ok) { callbacks.onError(`${res.status}: ${await res.text()}`); return }

    const reader = res.body?.getReader()
    if (!reader) { callbacks.onError('No readable stream in response'); return }

    await readSSEStream<StreamEvent>(
      reader,
      (event) => {
        if (event.type === 'delta') callbacks.onDelta(event.content)
        if (event.type === 'error') callbacks.onError(event.error)
      },
      callbacks.onDone,
    )
  },

  // -------------------------------------------------------------------------
  // Brand Core
  // -------------------------------------------------------------------------
  brandCore: {
    get: (projectId: string, signal?: AbortSignal) =>
      get<{ brandCore: BrandCore | null; ingestionStatus: string | null }>(
        `/projects/${projectId}/brand-core`,
        signal,
      ),
    update: (projectId: string, data: Partial<BrandCore>, signal?: AbortSignal) =>
      patch<{ brandCore: BrandCore }>(`/projects/${projectId}/brand-core`, data, signal),
    clear: (projectId: string, signal?: AbortSignal) =>
      del(`/projects/${projectId}/brand-core`, signal),
  },

  // -------------------------------------------------------------------------
  // Brand ingestion streaming (SSE)
  // -------------------------------------------------------------------------

  /**
   * Start brand ingestion and stream progress events via SSE.
   *
   * @param signal  Optional AbortSignal to cancel mid-ingestion.
   */
  async streamIngestion(
    projectId: string,
    body: {
      websiteUrl?: string
      instagramHandle?: string
      facebookUrl?: string
      tiktokUrl?: string
      linkedinUrl?: string
      xUrl?: string
      youtubeUrl?: string
    },
    callbacks: {
      onStep: (step: import('@/types').IngestionStep) => void
      onProgress: (pct: number) => void
      onDone: (brandCore: BrandCore) => void
      onError: (message: string) => void
    },
    signal?: AbortSignal,
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
        signal,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      callbacks.onError(String(err))
      return
    }

    if (!res.ok) { callbacks.onError(`${res.status}: ${await res.text()}`); return }

    const reader = res.body?.getReader()
    if (!reader) { callbacks.onError('No stream'); return }

    await readSSEStream<IngestionEvent>(
      reader,
      (event) => {
        if (event.type === 'step')     callbacks.onStep(event)
        if (event.type === 'progress') callbacks.onProgress(event.pct)
        if (event.type === 'done')     callbacks.onDone(event.brandCore)
        if (event.type === 'error')    callbacks.onError(event.message)
      },
      () => {/* ingestion done is signalled via the 'done' event type, not [DONE] sentinel */},
    )
  },

  // -------------------------------------------------------------------------
  // Assets
  // -------------------------------------------------------------------------

  async uploadLogo(projectId: string, file: File): Promise<{ url: string }> {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')
    const token = await user.getIdToken()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API}/projects/${projectId}/assets/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
    return res.json()
  },

  // -------------------------------------------------------------------------
  // Billing
  // -------------------------------------------------------------------------
  billing: {
    status: (signal?: AbortSignal) => get<BillingStatus>('/billing/status', signal),
    checkout: (plan: 'pro' | 'agency', signal?: AbortSignal) =>
      post<{ url: string }>('/billing/checkout', { plan }, signal),
    portal: (signal?: AbortSignal) =>
      post<{ url: string }>('/billing/portal', {}, signal),
  },

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------
  health: (signal?: AbortSignal) => get<{ status: string }>('/health', signal),
}
