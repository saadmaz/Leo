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
  BlogPostMeta,
  EmailItem,
  HashtagResult,
  MetaTagsResult,
  PerformanceRecord,
  ProjectAnalytics,
  ProjectCreate,
  ProjectInsight,
  PublishQueueDay,
  ProjectMember,
  ContentTemplate,
  ContentPlanItem,
  GeneratedImage,
  ReviewDecision,
  ReviewHistoryEntry,
  StreamEvent,
  StyleGuide,
  TransformResult,
  WebsiteCopySection,
  ContentMetrics,
  AnalyticsOverview,
  ContentPerformanceRow,
  AnalyticsTrends,
  ActivityEvent,
  WeeklyDigest,
  ContentScoreResult,
  MonitorAlert,
  ResearchReport,
  ContentGap,
  ContentTopic,
  DiscoveredCompetitor,
  DiscoveredInfluencer,
  CompetitiveStrategy,
  CompetitorReport,
  Post,
  PostCreate,
  PostUpdate,
  CreditsStatus,
  CreditTransaction,
  DeepSearchHistory,
} from '@/types'

// All backend requests are proxied through Next.js rewrites defined in
// next.config.js so the browser never talks to the backend directly.
const API = '/api/backend'

// ---------------------------------------------------------------------------
// Intelligence stream event type
// ---------------------------------------------------------------------------

export type IntelligenceStreamEvent =
  | { type: 'step'; message: string; icon: string; detail?: string; competitor?: string }
  | { type: 'result'; competitors?: DiscoveredCompetitor[]; refreshed?: { name: string; platforms_scraped: string[] }[] }
  | { type: 'error'; message: string }

// ---------------------------------------------------------------------------
// Auth headers
// ---------------------------------------------------------------------------

async function authHeaders(): Promise<HeadersInit> {
  // Wait for Firebase to restore the persisted auth session before reading
  // currentUser — without this, requests made on initial page load race against
  // auth initialisation and arrive with no token, causing 401s.
  await auth.authStateReady()
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

async function extractErrorMessage(res: Response): Promise<string> {
  const text = await res.text()
  if (res.status === 402) {
    try {
      const json = JSON.parse(text)
      const detail = json?.detail
      if (typeof detail === 'object' && detail?.message) return detail.message as string
      if (typeof detail === 'string') return detail
    } catch { /* fall through */ }
  }
  return `${res.status === 402 ? 'Insufficient credits' : `${res.status}`}: ${text}`
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: await authHeaders(),
    signal,
  })
  if (!res.ok) throw new Error(await extractErrorMessage(res))
  return res.json()
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(await extractErrorMessage(res))
  return res.json()
}

async function patch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(await extractErrorMessage(res))
  return res.json()
}

async function del(path: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
    signal,
  })
  if (!res.ok) throw new Error(await extractErrorMessage(res))
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
// SSE streaming helpers
// ---------------------------------------------------------------------------

async function streamPost<TEvent>(
  path: string,
  body: unknown,
  onEvent: (event: TEvent) => void,
  onDone: () => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Accept': 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`)
  if (!res.body) { onDone(); return }
  await readSSEStream(res.body.getReader(), onEvent, onDone)
}

async function streamGet<TEvent>(
  path: string,
  onEvent: (event: TEvent) => void,
  onDone: () => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API}${path}`, {
    headers: { ...(await authHeaders()), 'Accept': 'text/event-stream' },
    signal,
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`)
  if (!res.body) { onDone(); return }
  await readSSEStream(res.body.getReader(), onEvent, onDone)
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
  // Posts
  // -------------------------------------------------------------------------
  posts: {
    list: (projectId: string, signal?: AbortSignal) =>
      get<Post[]>(`/projects/${projectId}/posts`, signal),
    get: (projectId: string, postId: string, signal?: AbortSignal) =>
      get<Post>(`/projects/${projectId}/posts/${postId}`, signal),
    create: (projectId: string, body: PostCreate, signal?: AbortSignal) =>
      post<Post>(`/projects/${projectId}/posts`, body, signal),
    update: (projectId: string, postId: string, body: PostUpdate, signal?: AbortSignal) =>
      patch<Post>(`/projects/${projectId}/posts/${postId}`, body, signal),
    delete: (projectId: string, postId: string, signal?: AbortSignal) =>
      del(`/projects/${projectId}/posts/${postId}`, signal),
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
      onToolCall?: (tool: string, query: string) => void
      onToolResult?: (tool: string, preview: string) => void
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

    if (!res.ok) { callbacks.onError(await extractErrorMessage(res)); return }

    const reader = res.body?.getReader()
    if (!reader) { callbacks.onError('No readable stream in response'); return }

    await readSSEStream<StreamEvent>(
      reader,
      (event) => {
        if (event.type === 'delta') callbacks.onDelta(event.content)
        if (event.type === 'error') callbacks.onError(event.error)
        if (event.type === 'tool_call') callbacks.onToolCall?.(event.tool, event.query)
        if (event.type === 'tool_result') callbacks.onToolResult?.(event.tool, event.preview)
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

    if (!res.ok) { callbacks.onError(await extractErrorMessage(res)); return }

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
    update: (projectId: string, campaignId: string, body: { contentPacks?: Record<string, unknown>; name?: string }, signal?: AbortSignal) =>
      patch<Campaign>(`/projects/${projectId}/campaigns/${campaignId}`, body, signal),
    duplicate: (projectId: string, campaignId: string, signal?: AbortSignal) =>
      post<Campaign>(`/projects/${projectId}/campaigns/${campaignId}/duplicate`, {}, signal),
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

    if (!res.ok) { callbacks.onError(await extractErrorMessage(res)); return }

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

    aiPrompt: (
      projectId: string,
      body: { brief: string; platform?: string; style?: string },
      signal?: AbortSignal,
    ) => post<{ prompt: string }>(`/projects/${projectId}/generate/ai-prompt`, body, signal),
  },

  // -------------------------------------------------------------------------
  images: {
    list: (projectId: string, signal?: AbortSignal) =>
      get<{ images: GeneratedImage[]; count: number }>(
        `/projects/${projectId}/images`,
        signal,
      ),

    save: (
      projectId: string,
      body: { dataUrl: string; prompt: string; aspectRatio?: string; style?: string; platform?: string },
      signal?: AbortSignal,
    ) => post<GeneratedImage>(`/projects/${projectId}/images`, body, signal),

    delete: (projectId: string, imageId: string, signal?: AbortSignal) =>
      del(`/projects/${projectId}/images/${imageId}`, signal),
  },

  // -------------------------------------------------------------------------
  planner: {
    generate: (
      projectId: string,
      body: { duration?: string; platforms?: string[]; goal?: string; postsPerWeek?: number },
      signal?: AbortSignal,
    ) =>
      post<{ items: ContentPlanItem[]; count: number }>(
        `/projects/${projectId}/planner/generate`,
        body,
        signal,
      ),

    apply: (
      projectId: string,
      items: ContentPlanItem[],
      mode: 'library' | 'calendar' = 'library',
      signal?: AbortSignal,
    ) =>
      post<{ saved: number; total: number; mode: string }>(
        `/projects/${projectId}/planner/apply`,
        { items, mode },
        signal,
      ),
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
    updateRole: (projectId: string, uid: string, role: string) =>
      patch<ProjectMember>(`/projects/${projectId}/members/${uid}`, { role }),
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
      competitors: { name: string; website?: string; instagram?: string; facebook?: string; tiktok?: string; linkedin?: string; youtube?: string }[],
      onEvent: (event: IntelligenceStreamEvent) => void,
      onDone: () => void,
      signal?: AbortSignal,
    ) => streamPost(`/projects/${projectId}/intelligence/refresh`, { competitors }, onEvent, onDone, signal),

    strategy: (projectId: string, signal?: AbortSignal) =>
      get<CompetitiveStrategy>(`/projects/${projectId}/intelligence/strategy`, signal),

    report: (projectId: string, competitorName: string, signal?: AbortSignal) =>
      get<CompetitorReport>(`/projects/${projectId}/intelligence/competitors/${encodeURIComponent(competitorName)}/report`, signal),
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

    bulkSchedule: (
      projectId: string,
      itemIds: string[],
      startDate: string,
      signal?: AbortSignal,
    ) =>
      post<{ scheduled: number; errors: number }>(
        `/projects/${projectId}/content-library/bulk-schedule`,
        { item_ids: itemIds, start_date: startDate },
        signal,
      ),
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

    if (!res.ok) { callbacks.onError(await extractErrorMessage(res)); return }

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
    logMetrics: (projectId: string, itemId: string, metrics: ContentMetrics) =>
      post<ContentMetrics>(`/projects/${projectId}/analytics/${itemId}/metrics`, metrics),
    getOverview: (projectId: string) =>
      get<AnalyticsOverview>(`/projects/${projectId}/analytics/overview`),
    getContent: (projectId: string) =>
      get<ContentPerformanceRow[]>(`/projects/${projectId}/analytics/content`),
    getTrends: (projectId: string) =>
      get<AnalyticsTrends>(`/projects/${projectId}/analytics/trends`),
    getActivity: (projectId: string) =>
      get<ActivityEvent[]>(`/projects/${projectId}/analytics/activity`),
    getAiSummary: (projectId: string) =>
      get<{ summary: string }>(`/projects/${projectId}/analytics/ai-summary`),
    compare: (projectId: string, period: '7d' | '30d' = '7d') =>
      get<{ period_days: number; library: { current: number; previous: number; pct_change: number | null }; calendar: { current: number; previous: number; pct_change: number | null } }>(`/projects/${projectId}/analytics/compare?period=${period}`),
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

  // -------------------------------------------------------------------------
  // Publishing Queue (Phase 4)
  // -------------------------------------------------------------------------
  publishQueue: {
    get: (projectId: string, signal?: AbortSignal) =>
      get<{ days: PublishQueueDay[]; total: number }>(
        `/projects/${projectId}/publish-queue`,
        signal,
      ),
  },

  // -------------------------------------------------------------------------
  // Hashtag Research (Phase 4)
  // -------------------------------------------------------------------------
  hashtags: {
    suggest: (
      projectId: string,
      topic: string,
      platform: string,
      content?: string,
      signal?: AbortSignal,
    ) =>
      post<HashtagResult>(
        `/projects/${projectId}/hashtags/suggest`,
        { topic, platform, content },
        signal,
      ),
  },

  // -------------------------------------------------------------------------
  // AI Proactive Insights (Phase 4)
  // -------------------------------------------------------------------------
  insights: {
    get: (projectId: string, signal?: AbortSignal) =>
      get<{ insights: ProjectInsight[] }>(`/projects/${projectId}/insights`, signal),
  },

  // -------------------------------------------------------------------------
  // SEO Studio (Phase 5)
  // -------------------------------------------------------------------------
  seo: {
    metaTags: (
      projectId: string,
      pageTitle: string,
      pageDescription: string,
      pageType: string,
      signal?: AbortSignal,
    ) =>
      post<MetaTagsResult>(
        `/projects/${projectId}/seo/meta-tags`,
        { page_title: pageTitle, page_description: pageDescription, page_type: pageType },
        signal,
      ),

    websiteCopy: (
      projectId: string,
      pageType: string,
      context?: string,
      signal?: AbortSignal,
    ) =>
      post<{ sections: WebsiteCopySection[] }>(
        `/projects/${projectId}/seo/website-copy`,
        { page_type: pageType, context },
        signal,
      ),
  },

  // -------------------------------------------------------------------------
  // Email Studio (Phase 5)
  // -------------------------------------------------------------------------
  emails: {
    sequence: (
      projectId: string,
      sequenceType: string,
      goal: string,
      productOrService: string,
      signal?: AbortSignal,
    ) =>
      post<{ sequence: EmailItem[] }>(
        `/projects/${projectId}/emails/sequence`,
        { sequence_type: sequenceType, goal, product_or_service: productOrService },
        signal,
      ),

    single: (
      projectId: string,
      emailType: string,
      context: string,
      signal?: AbortSignal,
    ) =>
      post<EmailItem>(
        `/projects/${projectId}/emails/single`,
        { email_type: emailType, context },
        signal,
      ),
  },

  // -------------------------------------------------------------------------
  // Brand Style Guide (Phase 5)
  // -------------------------------------------------------------------------
  styleGuide: {
    generate: (projectId: string, signal?: AbortSignal) =>
      post<StyleGuide>(`/projects/${projectId}/brand/style-guide`, {}, signal),
  },

  // -------------------------------------------------------------------------
  // Content Templates (Phase 6)
  // -------------------------------------------------------------------------
  templates: {
    list: (projectId: string, category?: string, signal?: AbortSignal) =>
      get<{ templates: ContentTemplate[] }>(
        `/projects/${projectId}/templates${category ? `?category=${category}` : ''}`,
        signal,
      ),

    create: (
      projectId: string,
      data: Omit<ContentTemplate, 'id' | 'createdAt' | 'updatedAt'>,
      signal?: AbortSignal,
    ) =>
      post<ContentTemplate>(`/projects/${projectId}/templates`, data, signal),

    update: (
      projectId: string,
      templateId: string,
      data: Partial<Pick<ContentTemplate, 'name' | 'description' | 'body' | 'placeholders' | 'hashtags' | 'tags'>>,
      signal?: AbortSignal,
    ) =>
      patch<ContentTemplate>(`/projects/${projectId}/templates/${templateId}`, data, signal),

    delete: (projectId: string, templateId: string, signal?: AbortSignal) =>
      del(`/projects/${projectId}/templates/${templateId}`, signal),
  },

  // -------------------------------------------------------------------------
  // Approval Workflow (Phase 6)
  // -------------------------------------------------------------------------
  approval: {
    submitForReview: (projectId: string, itemId: string, note?: string, signal?: AbortSignal) =>
      post<ContentLibraryItem>(
        `/projects/${projectId}/content-library/${itemId}/submit-review`,
        { note },
        signal,
      ),

    decide: (
      projectId: string,
      itemId: string,
      decision: ReviewDecision,
      note?: string,
      signal?: AbortSignal,
    ) =>
      post<ContentLibraryItem>(
        `/projects/${projectId}/content-library/${itemId}/review`,
        { decision, note },
        signal,
      ),

    queue: (projectId: string, signal?: AbortSignal) =>
      get<{ items: ContentLibraryItem[]; count: number }>(
        `/projects/${projectId}/review-queue`,
        signal,
      ),

    history: (projectId: string, itemId: string, signal?: AbortSignal) =>
      get<{ history: ReviewHistoryEntry[] }>(
        `/projects/${projectId}/content-library/${itemId}/review-history`,
        signal,
      ),
  },

  // -------------------------------------------------------------------------
  // Blog Post SSE stream (Phase 5)
  // -------------------------------------------------------------------------
  async streamBlogPost(
    projectId: string,
    body: {
      topic: string
      keywords?: string[]
      tone?: string
      word_count?: number
    },
    onMeta: (meta: BlogPostMeta) => void,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const headers = await authHeaders()
    const res = await fetch(`${API}/projects/${projectId}/seo/blog-post`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) throw new Error(`Blog post stream failed: ${res.status}`)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (!raw || raw === '[DONE]') continue
        try {
          const evt = JSON.parse(raw)
          if (evt.type === 'meta') onMeta(evt as BlogPostMeta)
          else if (evt.type === 'chunk') onChunk(evt.text)
        } catch { /* skip malformed */ }
      }
    }
  },

  // Reports — Phase 10
  reports: {
    getDigest: (projectId: string) =>
      get<WeeklyDigest>(`/projects/${projectId}/reports/digest`),
    scoreContent: (projectId: string, itemIds: string[]) =>
      post<Record<string, ContentScoreResult>>(`/projects/${projectId}/reports/score-content`, { item_ids: itemIds }),
  },

  // ---------------------------------------------------------------------------
  // Brand Monitoring (Exa + Tavily)
  // ---------------------------------------------------------------------------
  monitoring: {
    run: (projectId: string) =>
      post<{ alerts_saved: number; scan_summary: { total: number; new_alerts: number } }>(
        `/projects/${projectId}/monitor/run`,
        {},
      ),
    alerts: (projectId: string, params?: { unread_only?: boolean; days?: number; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.unread_only) qs.set('unread_only', 'true')
      if (params?.days !== undefined) qs.set('days', String(params.days))
      if (params?.limit !== undefined) qs.set('limit', String(params.limit))
      const q = qs.toString()
      return get<{ alerts: MonitorAlert[] }>(`/projects/${projectId}/monitor/alerts${q ? `?${q}` : ''}`)
    },
    markRead: (projectId: string, alertId: string) =>
      post<{ updated: boolean }>(`/projects/${projectId}/monitor/alerts/${alertId}/read`, {}),
  },

  // ---------------------------------------------------------------------------
  // Research Reports (Exa async deep-research)
  // ---------------------------------------------------------------------------
  research: {
    start: (projectId: string, topic: string, report_type?: string) =>
      post<{ report_id: string; status: string; task_id?: string }>(
        `/projects/${projectId}/reports/research/start`,
        { topic, report_type },
      ),
    status: (projectId: string, reportId: string) =>
      get<ResearchReport>(`/projects/${projectId}/reports/research/${reportId}/status`),
    list: (projectId: string) =>
      get<{ reports: ResearchReport[] }>(`/projects/${projectId}/reports/research`),
    get: (projectId: string, reportId: string) =>
      get<ResearchReport>(`/projects/${projectId}/reports/research/${reportId}`),
    delete: (projectId: string, reportId: string) =>
      del(`/projects/${projectId}/reports/research/${reportId}`),
  },

  // ---------------------------------------------------------------------------
  // SEO & Competitor Discovery (Exa + Tavily)
  // ---------------------------------------------------------------------------
  seoIntel: {
    contentGaps: (projectId: string, competitors: string[], topic?: string) =>
      post<{ gaps: ContentGap[]; total_gaps: number }>(
        `/projects/${projectId}/seo/content-gaps`,
        { competitors, topic },
      ),
    contentTopics: (projectId: string, gaps: ContentGap[], num_topics?: number) =>
      post<{ topics: ContentTopic[]; total: number }>(
        `/projects/${projectId}/seo/content-topics`,
        { gaps, num_topics },
      ),
    discoverCompetitors: (
      projectId: string,
      onEvent: (event: IntelligenceStreamEvent) => void,
      onDone: () => void,
      signal?: AbortSignal,
    ) => streamGet(`/projects/${projectId}/intelligence/discover-competitors`, onEvent, onDone, signal),
    discoverInfluencers: (
      projectId: string,
      topic: string,
      platform: string,
      audience_size?: string,
      location?: string,
    ) =>
      post<{ influencers: DiscoveredInfluencer[]; total: number; topic: string; platform: string }>(
        `/projects/${projectId}/influencers/discover`,
        { topic, platform, audience_size: audience_size ?? 'micro', location },
      ),
  },

  // -------------------------------------------------------------------------
  // Credits
  // -------------------------------------------------------------------------
  credits: {
    getBalance: () => get<CreditsStatus>('/credits/balance'),
    getHistory: (limit = 20) => get<{ transactions: CreditTransaction[] }>(`/credits/history?limit=${limit}`),
  },

  // -------------------------------------------------------------------------
  // Deep Search
  // -------------------------------------------------------------------------
  deepSearch: {
    run: async (
      projectId: string,
      query: string,
      scrapeTopN: number = 3,
      onEvent: (event: Record<string, unknown>) => void,
      onDone: () => void,
      onError: (msg: string) => void,
    ) => {
      const headers = await authHeaders()
      const res = await fetch(`${API}/projects/${projectId}/deep-search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, scrape_top_n: scrapeTopN }),
      })
      if (!res.ok) throw new Error(`Deep search failed: ${res.status}`)
      const reader = res.body?.getReader()
      if (!reader) { onError('No stream'); return }
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') { onDone(); return }
          try { onEvent(JSON.parse(payload)) } catch { /* skip */ }
        }
      }
      onDone()
    },
    history: (projectId: string) =>
      get<{ results: DeepSearchHistory[] }>(`/projects/${projectId}/deep-search/history`),
  },
}
