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
  BrandDriftResult,
  BrandVoiceScore,
  BulkGenerateEvent,
  CalendarEntry,
  Campaign,
  CampaignEvent,
  CampaignGenerateRequest,
  Chat,
  CompetitorSnapshot,
  ContentLibraryItem,
  ContentPrediction,
  ImageAttachment,
  IngestionEvent,
  MemoryFeedbackItem,
  Message,
  Project,
  PerformanceRecord,
  ProjectAnalytics,
  ProjectCreate,
  ProjectMember,
  StreamEvent,
  TransformResult,
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
    messages: (projectId: string, chatId: string, before?: string, signal?: AbortSignal) =>
      get<Message[]>(
        `/projects/${projectId}/chats/${chatId}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`,
        signal,
      ),
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
  // Campaigns
  // -------------------------------------------------------------------------
  campaigns: {
    list: (projectId: string, signal?: AbortSignal) =>
      get<Campaign[]>(`/projects/${projectId}/campaigns`, signal),
    get: (projectId: string, campaignId: string, signal?: AbortSignal) =>
      get<Campaign>(`/projects/${projectId}/campaigns/${campaignId}`, signal),
    delete: (projectId: string, campaignId: string, signal?: AbortSignal) =>
      del(`/projects/${projectId}/campaigns/${campaignId}`, signal),
  },

  async streamCampaignGenerate(
    projectId: string,
    body: CampaignGenerateRequest,
    callbacks: {
      onStep: (step: import('@/types').IngestionStep) => void
      onProgress: (pct: number) => void
      onDone: (campaign: Campaign, campaignId: string) => void
      onError: (message: string) => void
    },
    signal?: AbortSignal,
  ): Promise<void> {
    const user = auth.currentUser
    if (!user) { callbacks.onError('Not authenticated'); return }
    const token = await user.getIdToken()

    let res: Response
    try {
      res = await fetch(`${API}/projects/${projectId}/campaigns/generate`, {
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

    await readSSEStream<CampaignEvent>(
      reader,
      (event) => {
        if (event.type === 'step')     callbacks.onStep(event)
        if (event.type === 'progress') callbacks.onProgress(event.pct)
        if (event.type === 'done')     callbacks.onDone(event.campaign, event.campaignId)
        if (event.type === 'error')    callbacks.onError(event.message)
      },
      () => {},
    )
  },

  // -------------------------------------------------------------------------
  // Generate (image, etc.)
  // -------------------------------------------------------------------------
  generate: {
    image: (
      projectId: string,
      body: { prompt: string; style?: string; aspectRatio?: string },
      signal?: AbortSignal,
    ) => post<{ url: string }>(`/projects/${projectId}/generate/image`, body, signal),
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
  // Team members
  // -------------------------------------------------------------------------
  members: {
    list: (projectId: string, signal?: AbortSignal) =>
      get<ProjectMember[]>(`/projects/${projectId}/members`, signal),
    invite: (projectId: string, email: string, role: string, signal?: AbortSignal) =>
      post<ProjectMember>(`/projects/${projectId}/members`, { email, role }, signal),
    remove: (projectId: string, uid: string, signal?: AbortSignal) =>
      del(`/projects/${projectId}/members/${uid}`, signal),
  },

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------
  health: (signal?: AbortSignal) => get<{ status: string }>('/health', signal),

  // -------------------------------------------------------------------------
  // Intelligence — Phase 1
  // -------------------------------------------------------------------------
  intelligence: {
    get: (projectId: string, signal?: AbortSignal) =>
      get<{ snapshots: CompetitorSnapshot[] }>(`/projects/${projectId}/intelligence`, signal),

    refresh: (
      projectId: string,
      competitors: { name: string; instagram?: string; facebook?: string; tiktok?: string }[],
      signal?: AbortSignal,
    ) =>
      post<{ refreshed: { name: string; platforms_scraped: string[] }[] }>(
        `/projects/${projectId}/intelligence/refresh`,
        { competitors },
        signal,
      ),
  },

  // -------------------------------------------------------------------------
  // Brand Voice Scorer
  // -------------------------------------------------------------------------
  brandVoice: {
    score: (
      projectId: string,
      text: string,
      signal?: AbortSignal,
    ) =>
      post<BrandVoiceScore>(`/projects/${projectId}/brand-voice/score`, { text }, signal),
  },

  // -------------------------------------------------------------------------
  // Content Performance Predictor
  // -------------------------------------------------------------------------
  contentPredict: {
    predict: (
      projectId: string,
      content: string,
      platform: string,
      signal?: AbortSignal,
    ) =>
      post<ContentPrediction>(
        `/projects/${projectId}/content/predict`,
        { content, platform },
        signal,
      ),
  },

  // -------------------------------------------------------------------------
  // Brand Memory
  // -------------------------------------------------------------------------
  memory: {
    get: (projectId: string, signal?: AbortSignal) =>
      get<{ items: MemoryFeedbackItem[]; summary: string; count: number }>(
        `/projects/${projectId}/memory`,
        signal,
      ),

    feedback: (
      projectId: string,
      body: {
        type: 'edit' | 'approve' | 'reject' | 'instruction'
        original?: string
        edited?: string
        reason?: string
        instruction?: string
        platform?: string
      },
      signal?: AbortSignal,
    ) =>
      post<{ saved: boolean }>(`/projects/${projectId}/memory/feedback`, body, signal),
  },

  // -------------------------------------------------------------------------
  // Brand Drift Detector
  // -------------------------------------------------------------------------
  drift: {
    check: (projectId: string, ownContent: string[], signal?: AbortSignal) =>
      post<BrandDriftResult>(
        `/projects/${projectId}/drift/check`,
        { own_content: ownContent },
        signal,
      ),
  },

  // -------------------------------------------------------------------------
  // Content Library
  // -------------------------------------------------------------------------
  contentLibrary: {
    list: (
      projectId: string,
      filters?: { platform?: string; status?: string; type?: string; limit?: number },
      signal?: AbortSignal,
    ) => {
      const params = new URLSearchParams()
      if (filters?.platform) params.set('platform', filters.platform)
      if (filters?.status) params.set('status', filters.status)
      if (filters?.type) params.set('type', filters.type)
      if (filters?.limit) params.set('limit', String(filters.limit))
      const qs = params.toString()
      return get<{ items: ContentLibraryItem[] }>(
        `/projects/${projectId}/content-library${qs ? `?${qs}` : ''}`,
        signal,
      )
    },
    save: (
      projectId: string,
      item: {
        platform: string
        type: string
        content: string
        hashtags?: string[]
        metadata?: Record<string, unknown>
        status?: string
        tags?: string[]
      },
      signal?: AbortSignal,
    ) => post<ContentLibraryItem>(`/projects/${projectId}/content-library`, item, signal),

    update: (
      projectId: string,
      itemId: string,
      updates: { status?: string; content?: string; tags?: string[]; scheduledAt?: string },
      signal?: AbortSignal,
    ) => patch<ContentLibraryItem>(`/projects/${projectId}/content-library/${itemId}`, updates, signal),

    delete: (projectId: string, itemId: string, signal?: AbortSignal) =>
      del(`/projects/${projectId}/content-library/${itemId}`, signal),
  },

  // -------------------------------------------------------------------------
  // Content Operations
  // -------------------------------------------------------------------------
  contentOps: {
    recycle: (
      projectId: string,
      content: string,
      platform: string,
      count?: number,
      signal?: AbortSignal,
    ) =>
      post<{ variants: { content: string; hashtags: string[]; angle: string; hook: string }[] }>(
        `/projects/${projectId}/content/recycle`,
        { content, platform, count: count ?? 3 },
        signal,
      ),

    transform: (
      projectId: string,
      content: string,
      targetPlatforms: string[],
      signal?: AbortSignal,
    ) =>
      post<TransformResult>(
        `/projects/${projectId}/content/transform`,
        { content, target_platforms: targetPlatforms },
        signal,
      ),
  },

  // -------------------------------------------------------------------------
  // Bulk Content Generation (SSE)
  // -------------------------------------------------------------------------
  async streamBulkGenerate(
    projectId: string,
    body: {
      platforms: string[]
      count_per_platform?: number
      themes?: string[]
      period?: string
      goal?: string
    },
    callbacks: {
      onItem: (item: BulkGenerateEvent & { type: 'item' }) => void
      onProgress: (done: number, total: number) => void
      onDone: (total: number) => void
      onError: (err: string) => void
    },
    signal?: AbortSignal,
  ): Promise<void> {
    const user = auth.currentUser
    if (!user) { callbacks.onError('Not authenticated'); return }
    const token = await user.getIdToken()

    let res: Response
    try {
      res = await fetch(`${API}/projects/${projectId}/content/bulk-generate`, {
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

    await readSSEStream<BulkGenerateEvent>(
      reader,
      (event) => {
        if (event.type === 'item') callbacks.onItem(event as BulkGenerateEvent & { type: 'item' })
        if (event.type === 'progress') callbacks.onProgress(event.done, event.total)
        if (event.type === 'done') callbacks.onDone(event.total)
        if (event.type === 'error') callbacks.onError(event.error)
      },
      () => {},
    )
  },

  // -------------------------------------------------------------------------
  // Calendar
  // -------------------------------------------------------------------------
  calendar: {
    get: (
      projectId: string,
      fromDate?: string,
      toDate?: string,
      signal?: AbortSignal,
    ) => {
      const params = new URLSearchParams()
      if (fromDate) params.set('from_date', fromDate)
      if (toDate) params.set('to_date', toDate)
      const qs = params.toString()
      return get<{ entries: CalendarEntry[] }>(
        `/projects/${projectId}/calendar${qs ? `?${qs}` : ''}`,
        signal,
      )
    },

    generate: (
      projectId: string,
      body: {
        platforms: string[]
        period?: string
        goals?: string
        posts_per_week?: number
      },
      signal?: AbortSignal,
    ) =>
      post<{ entries: CalendarEntry[]; count: number }>(
        `/projects/${projectId}/calendar/generate`,
        body,
        signal,
      ),

    createEntry: (
      projectId: string,
      entry: {
        date: string
        platform: string
        content: string
        time?: string
        hashtags?: string[]
        type?: string
        status?: string
      },
      signal?: AbortSignal,
    ) =>
      post<CalendarEntry>(`/projects/${projectId}/calendar/entries`, entry, signal),

    updateEntry: (
      projectId: string,
      entryId: string,
      updates: { content?: string; date?: string; time?: string; status?: string },
      signal?: AbortSignal,
    ) =>
      patch<CalendarEntry>(`/projects/${projectId}/calendar/entries/${entryId}`, updates, signal),

    deleteEntry: (projectId: string, entryId: string, signal?: AbortSignal) =>
      del(`/projects/${projectId}/calendar/entries/${entryId}`, signal),
  },

  // -------------------------------------------------------------------------
  // Analytics & Performance (Phase 3)
  // -------------------------------------------------------------------------
  analytics: {
    get: (projectId: string, signal?: AbortSignal) =>
      get<ProjectAnalytics>(`/projects/${projectId}/analytics`, signal),
  },

  performance: {
    record: (
      projectId: string,
      itemId: string,
      data: PerformanceRecord,
      signal?: AbortSignal,
    ) =>
      post<{ id: string }>(
        `/projects/${projectId}/content-library/${itemId}/performance`,
        data,
        signal,
      ),
  },
}
