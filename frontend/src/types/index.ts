// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AppUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

// ---------------------------------------------------------------------------
// Brand Core
// ---------------------------------------------------------------------------

export interface BrandTone {
  style?: string
  formality?: string
  keyPhrases?: string[]
  avoidedLanguage?: string[]
}

export interface BrandVisual {
  primaryColour?: string
  secondaryColours?: string[]
  fonts?: string[]
  imageStyle?: string
}

export interface BrandMessaging {
  valueProp?: string
  keyClaims?: string[]
}

export interface BrandCore {
  tone?: BrandTone
  visual?: BrandVisual
  themes?: string[]
  audience?: {
    demographics?: string
    interests?: string[]
  }
  tagline?: string
  messaging?: BrandMessaging
  competitors?: string[]
}

// ---------------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------------

export interface ProjectMember {
  uid: string
  email: string
  displayName: string
  role: 'admin' | 'editor' | 'viewer'
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface Project {
  id: string
  name: string
  description?: string
  ownerId: string
  brandCore?: BrandCore | null
  ingestionStatus?: 'pending' | 'processing' | 'complete' | 'error' | null
  // Social links
  websiteUrl?: string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
  linkedinUrl?: string | null
  tiktokUrl?: string | null
  xUrl?: string | null
  youtubeUrl?: string | null
  threadsUrl?: string | null
  pinterestUrl?: string | null
  snapchatUrl?: string | null
  // Model settings
  contentModel?: string | null
  imageModel?: string | null
  videoModel?: string | null
  promptModel?: string | null
  // Assets
  logoUrl?: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectCreate {
  name: string
  description?: string
  // Social links
  websiteUrl?: string
  instagramUrl?: string
  facebookUrl?: string
  linkedinUrl?: string
  tiktokUrl?: string
  xUrl?: string
  youtubeUrl?: string
  threadsUrl?: string
  pinterestUrl?: string
  snapchatUrl?: string
  // Model settings
  contentModel?: string
  imageModel?: string
  videoModel?: string
  promptModel?: string
}

// ---------------------------------------------------------------------------
// Chats
// ---------------------------------------------------------------------------

export interface Chat {
  id: string
  projectId: string
  name: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  chatId: string
  projectId: string
  role: MessageRole
  content: string
  createdAt: string
}

export interface OptimisticMessage {
  id: string
  role: MessageRole
  content: string
  pending?: boolean
  createdAt?: string  // ISO timestamp — used as pagination cursor for "Load earlier"
}

// ---------------------------------------------------------------------------
// SSE Stream events (chat)
// ---------------------------------------------------------------------------

export interface StreamDelta {
  type: 'delta'
  content: string
}

export interface StreamError {
  type: 'error'
  error: string
}

export type StreamEvent = StreamDelta | StreamError

// ---------------------------------------------------------------------------
// SSE Ingestion events
// ---------------------------------------------------------------------------

export interface IngestionStep {
  type: 'step'
  label: string
  status: 'running' | 'done' | 'error' | 'skipped'
  detail?: string
}

export interface IngestionProgress {
  type: 'progress'
  pct: number
}

export interface IngestionDone {
  type: 'done'
  brandCore: BrandCore
}

export interface IngestionError {
  type: 'error'
  message: string
}

export type IngestionEvent =
  | IngestionStep
  | IngestionProgress
  | IngestionDone
  | IngestionError

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export interface CampaignBrief {
  name: string
  objective: string
  audience: string
  channels: string[]
  timeline: string
  kpis: string[]
  budgetGuidance: string
  keyMessages: string[]
}

export interface CampaignCaption {
  text: string
  hashtags: string[]
}

export interface CampaignAdVariant {
  headline: string
  body: string
  cta: string
}

export interface CampaignContentPack {
  captions?: CampaignCaption[]
  adCopy?: CampaignAdVariant[]
}

export interface Campaign {
  id: string
  projectId: string
  name: string
  objective: string
  audience: string
  channels: string[]
  timeline: string
  status: 'generating' | 'ready' | 'error'
  brief?: CampaignBrief
  contentPacks?: Record<string, CampaignContentPack>
  createdAt: string
  updatedAt: string
}

export interface CampaignGenerateRequest {
  name: string
  objective: string
  audience: string
  channels: string[]
  timeline: string
  kpis: string[]
  budgetGuidance: string
}

// SSE events for campaign generation (same shape as ingestion events)
export interface CampaignDone {
  type: 'done'
  campaignId: string
  campaign: Campaign
}

export type CampaignEvent =
  | IngestionStep
  | IngestionProgress
  | CampaignDone
  | IngestionError

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export interface ImageAttachment {
  /** Client-side ephemeral id for list keys / removal. */
  id: string
  name: string
  /** Raw base64 string (no data-URL prefix). */
  base64: string
  /** MIME type: image/jpeg | image/png | image/gif | image/webp */
  mediaType: string
  /** Object URL for thumbnail preview (created with URL.createObjectURL). */
  previewUrl: string
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export type PlanTier = 'free' | 'pro' | 'agency'

export interface UsageCounter {
  used: number
  limit: number
  resetAt?: string | null
}

export interface BillingStatus {
  plan: PlanTier
  planLabel: string
  priceMonthly: number
  projects: UsageCounter
  messages: UsageCounter
  ingestions: UsageCounter
  campaigns?: { limit: number }
  stripeCustomerId?: string | null
  subscriptionStatus?: string | null
  currentPeriodEnd?: number | null
}

// ---------------------------------------------------------------------------
// Phase 1 Intelligence Types
// ---------------------------------------------------------------------------

export interface BrandVoiceScore {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  summary: string
  strengths: string[]
  issues: string[]
  suggestions: string[]
  on_brand_words: string[]
  off_brand_words: string[]
}

export interface ContentPrediction {
  score: number
  prediction: 'excellent' | 'above average' | 'average' | 'below average' | 'poor'
  hook_strength: number
  clarity: number
  cta_strength: number
  brand_alignment: number
  estimated_engagement: 'low' | 'medium' | 'high'
  best_posting_time: string
  reasons: string[]
  improvements: string[]
}

export interface CompetitorAnalysis {
  tone: string
  key_themes: string[]
  posting_style: string
  strengths: string[]
  weaknesses: string[]
  content_gaps: string[]
  top_hashtags: string[]
  engagement_patterns: string
}

export interface CompetitorSnapshot {
  id: string
  name: string
  scrapedAt: string
  platforms: Record<string, unknown>
  analysis?: CompetitorAnalysis
}

export interface MemoryFeedbackItem {
  id: string
  type: 'edit' | 'approve' | 'reject' | 'instruction'
  original?: string
  edited?: string
  reason?: string
  instruction?: string
  platform?: string
  createdAt: string
}

export interface BrandDriftResult {
  drift_score: number
  status: 'on_track' | 'minor_drift' | 'significant_drift' | 'off_brand' | 'no_data' | 'error'
  tone_drift: boolean
  theme_drift: boolean
  voice_drift: boolean
  issues: string[]
  recommendations: string[]
  positive_observations: string[]
}

// ---------------------------------------------------------------------------
// Phase 2 Content Operations Types
// ---------------------------------------------------------------------------

export type ContentLibraryStatus = 'draft' | 'approved' | 'scheduled' | 'posted'
export type ContentLibraryType = 'caption' | 'ad_copy' | 'video_script' | 'email' | 'image_prompt'

export interface ContentLibraryItem {
  id: string
  projectId: string
  platform: string
  type: ContentLibraryType
  content: string
  hashtags: string[]
  metadata: Record<string, unknown>
  status: ContentLibraryStatus
  tags: string[]
  scheduledAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface CalendarEntry {
  id: string
  projectId: string
  date: string           // YYYY-MM-DD
  time?: string          // HH:MM
  platform: string
  content: string
  hashtags: string[]
  type: string           // educational | brand_story | product | engagement
  content_format: string // post | story | reel | carousel
  status: string         // planned | drafted | approved | scheduled | posted
  contentLibraryItemId?: string | null
  createdAt: string
  updatedAt: string
}

export interface BulkGenerateItem {
  platform: string
  content: string
  hashtags: string[]
  type: string
  hook?: string
  headline?: string
  cta?: string
  status: 'draft'
}

export type BulkGenerateEvent =
  | { type: 'item'; item: BulkGenerateItem }
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; total: number }
  | { type: 'error'; error: string }

export interface RecycleVariant {
  content: string
  hashtags: string[]
  angle: string
  hook: string
}

export interface TransformResult {
  results: Record<string, { content: string; hashtags: string[]; notes: string }>
}

// ---------------------------------------------------------------------------
// Phase 3 — Analytics & Performance
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Phase 4 — Publishing Queue, Hashtags, Insights
// ---------------------------------------------------------------------------

export interface PublishQueueEntry {
  id: string
  date: string
  platform: string
  content: string
  hashtags: string[]
  time?: string
  status: string
  type?: string
  content_format?: string
}

export interface PublishQueueDay {
  date: string
  label: string
  entries: PublishQueueEntry[]
}

export interface HashtagTier {
  tag: string
  approx_posts: string
}

export interface HashtagResult {
  tiers: {
    mega: HashtagTier[]
    large: HashtagTier[]
    medium: HashtagTier[]
    niche: HashtagTier[]
  }
  strategy: string
  recommended_mix: string
}

export interface ProjectInsight {
  type: 'warning' | 'opportunity' | 'tip' | 'achievement'
  title: string
  body: string
  action: string
  priority: 'high' | 'medium' | 'low'
}

export interface PerformanceRecord {
  likes?: number
  comments?: number
  shares?: number
  reach?: number
  saves?: number
  engagement_rate?: number
  notes?: string
  platform_post_id?: string
}

export interface ProjectAnalytics {
  library: {
    total: number
    by_status: Record<string, number>
    by_platform: Record<string, number>
  }
  calendar: {
    upcoming_count: number
    upcoming: CalendarEntry[]
  }
  memory: {
    count: number
  }
  competitors: {
    count: number
    last_analysis: string | null
  }
  top_performers: {
    id: string
    platform: string
    content: string
    engagement_rate: number
    likes: number
    reach: number
  }[]
}
