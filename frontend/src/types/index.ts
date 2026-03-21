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
