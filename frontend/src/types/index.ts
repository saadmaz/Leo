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
  joinedAt?: string
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

export interface StreamToolCall {
  type: 'tool_call'
  tool: string
  query: string
}

export interface StreamToolResult {
  type: 'tool_result'
  tool: string
  preview: string
}

export type StreamEvent = StreamDelta | StreamError | StreamToolCall | StreamToolResult

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
// Posts
// ---------------------------------------------------------------------------

export type PostStatus = 'open' | 'in_progress' | 'done' | 'archived'
export type PostPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Post {
  id: string
  projectId: string
  title: string
  body?: string
  status: PostStatus
  priority: PostPriority
  authorId: string
  authorEmail: string
  authorName: string
  tags: string[]
  dueDate?: string | null
  assignees: string[]
  createdAt: string
  updatedAt: string
}

export interface PostCreate {
  title: string
  body?: string
  status?: PostStatus
  priority?: PostPriority
  tags?: string[]
  dueDate?: string | null
  assignees?: string[]
}

export interface PostUpdate {
  title?: string
  body?: string
  status?: PostStatus
  priority?: PostPriority
  tags?: string[]
  dueDate?: string | null
  assignees?: string[]
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

export interface CompetitorWebAnalysis {
  recent_news_summary: string
  market_position: string
  momentum: string
  recent_moves: string[]
  opportunity: string
}

export interface CompetitorSnapshot {
  id: string
  name: string
  website?: string
  scrapedAt: string
  platforms: Record<string, unknown>
  analysis?: CompetitorAnalysis
  web_analysis?: CompetitorWebAnalysis
}

export interface CompetitorStrategyBreakdown {
  name: string
  threat_level: 'high' | 'medium' | 'low'
  what_they_do_better: string
  their_weakness: string
  how_to_beat_them: string
}

export interface StrategyBattleground {
  area: string
  our_position: 'winning' | 'competitive' | 'losing' | 'untapped'
  recommendation: string
}

export interface StrategyAction {
  priority: 'immediate' | 'short_term' | 'long_term'
  action: string
  rationale: string
  expected_impact: string
}

export interface CompetitiveStrategy {
  executive_summary: string
  brand_position: {
    strengths: string[]
    vulnerabilities: string[]
    differentiation: string
  }
  competitor_breakdown: CompetitorStrategyBreakdown[]
  battlegrounds: StrategyBattleground[]
  action_plan: StrategyAction[]
  quick_wins: string[]
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

export type ContentLibraryStatus = 'draft' | 'approved' | 'scheduled' | 'posted' | 'in_review'
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
  voice_score?: number | null
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

// ---------------------------------------------------------------------------
// Phase 5 — SEO Studio, Email Studio, Brand Style Guide
// ---------------------------------------------------------------------------

export interface BlogPostMeta {
  title: string
  description: string
  slug: string
  outline: string[]
}

export interface MetaTagsResult {
  tags: {
    title: string
    description: string
    og_title: string
    og_description: string
    og_type: string
    twitter_title: string
    twitter_description: string
    canonical_hint: string
    schema_type: string
    focus_keyword: string
  }
}

export interface WebsiteCopySection {
  name: string
  headline: string
  subheadline?: string
  body: string
  cta: string
}

export interface EmailItem {
  number: number
  send_day: number
  subject: string
  preview_text: string
  body: string
  cta_text: string
}

export interface StyleGuideSection {
  title: string
  content: string
}

export interface StyleGuide {
  summary: string
  sections: StyleGuideSection[]
}

// ---------------------------------------------------------------------------
// Phase 6 — Templates + Approval Workflow
// ---------------------------------------------------------------------------

export interface ContentTemplate {
  id: string
  name: string
  category: string
  platform?: string
  description?: string
  body: string
  placeholders: string[]
  hashtags: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type ReviewDecision = 'approved' | 'rejected' | 'changes_requested'

export interface ReviewHistoryEntry {
  id: string
  action: ReviewDecision | 'submitted'
  by: string
  note: string
  timestamp: string
}

// ---------------------------------------------------------------------------
// Phase 7 — Image Studio + AI Content Planner
// ---------------------------------------------------------------------------

export interface GeneratedImage {
  id: string
  dataUrl: string
  prompt: string
  aspectRatio: 'square' | 'landscape' | 'portrait'
  style: 'vivid' | 'natural'
  platform: string
  savedBy: string
  createdAt: string
}

export interface ContentPlanItem {
  date: string
  platform: string
  contentType: string
  topic: string
  contentAngle: string
  suggestedContent: string
  hashtags: string[]
  postingTime: string
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

// ---------------------------------------------------------------------------
// Phase 8 — Analytics & Activity Feed
// ---------------------------------------------------------------------------

export interface ContentMetrics {
  platform: string
  impressions: number
  reach: number
  clicks: number
  likes: number
  comments: number
  shares: number
}

export interface AnalyticsOverview {
  total_content: number
  total_posted: number
  avg_engagement: number
  total_impressions: number
  best_platform: string
  platform_breakdown: Record<string, number>
  top_content: { id: string; platform: string; engagement: number; impressions: number }[]
  has_metrics: boolean
}

export interface ContentPerformanceRow {
  id: string
  platform: string
  status: string
  created_at: string
  impressions: number
  reach: number
  clicks: number
  likes: number
  comments: number
  shares: number
  engagement: number
  has_metrics: boolean
}

export interface TrendPoint {
  date: string
  count: number
}

export interface PlatformBreakdown {
  platform: string
  count: number
}

export interface StatusBreakdown {
  status: string
  count: number
}

export interface AnalyticsTrends {
  daily_creation: TrendPoint[]
  platform_breakdown: PlatformBreakdown[]
  status_breakdown: StatusBreakdown[]
}

export interface ActivityEvent {
  id: string
  event_type: string
  user_email: string
  description: string
  timestamp: string
  metadata: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Phase 10 — Reports & Content Scoring
// ---------------------------------------------------------------------------

export interface WeeklyDigest {
  digest: string
  overview: AnalyticsOverview
  trends: AnalyticsTrends
  generated_at: string
}

export interface ContentScoreResult {
  score: number | null
  feedback?: string
  error?: string
}

// ---------------------------------------------------------------------------
// Exa + Tavily — Monitoring, Research, SEO, Discovery
// ---------------------------------------------------------------------------

export type AlertSentiment = 'positive' | 'negative' | 'neutral'

export interface MonitorAlert {
  id: string
  projectId: string
  title: string
  url: string
  snippet?: string
  source?: string
  sentiment: AlertSentiment
  subject?: string        // 'brand' | competitor name
  read: boolean
  savedAt: string
  publishedAt?: string
}

export interface ResearchReportSection {
  title: string
  content: string
}

export interface ResearchReport {
  id: string
  projectId: string
  topic: string
  report_type?: string
  status: 'pending' | 'processing' | 'complete' | 'error'
  title?: string
  summary?: string
  sections?: ResearchReportSection[]
  sources?: { title: string; url: string }[]
  error?: string
  createdAt: string
  completedAt?: string
}

export interface ContentGap {
  topic: string
  competitor?: string
  search_volume_estimate?: string
  brand_angle?: string
  priority?: 'high' | 'medium' | 'low'
  reasoning?: string
}

export interface ContentTopic {
  title: string
  platform: string
  content_type: string
  hook: string
  angle: string
  keywords?: string[]
  estimated_engagement?: string
  priority?: 'high' | 'medium' | 'low'
}

export interface DiscoveredCompetitor {
  name: string
  url: string
  relevance_score?: number
  description?: string
  why_competitor?: string
  location?: string
  funding_stage?: string
  funding_amount?: string
  what_they_do?: string
  key_advantage?: string
  employee_count?: string
  founded?: string
  industry?: string
  social_hints?: {
    instagram?: string
    linkedin?: string
    twitter?: string
  }
}

export interface DiscoveredInfluencer {
  name: string
  handle: string
  platform?: string
  followers?: string
  alignment_score?: number
  bio?: string
  content_themes?: string[]
  url?: string
}

export interface CompetitorReportPlatformMetric {
  platform: string
  followers: number
  is_estimated: boolean
  engagement_rate: number
  posts_per_week: number
  avg_likes: number
  avg_comments: number
  top_content_type: string
}

export interface CompetitorReportScorecard {
  dimension: string
  competitor: number
  brand: number
}

export interface CompetitorReport {
  company_profile: {
    description: string
    industry: string
    estimated_size: string
    founded_estimate: string
    hq_location: string
    funding_stage: string
    revenue_range: string
    business_model: string
  }
  platform_metrics: CompetitorReportPlatformMetric[]
  growth_trajectory: Array<{ month: string; followers_total: number; engagement_index: number }>
  revenue_trajectory: Array<{ period: string; value: number }>
  content_mix: Array<{ type: string; percentage: number }>
  vs_brand_scorecard: CompetitorReportScorecard[]
  what_they_do_better: Array<{
    area: string
    detail: string
    impact: string
    how_to_respond: string
  }>
  their_strategy: {
    core_message: string
    content_pillars: string[]
    posting_cadence: string
    cta_strategy: string
    audience_focus: string
  }
  opportunities: Array<{
    opportunity: string
    rationale: string
    action: string
    difficulty: 'easy' | 'medium' | 'hard'
    time_to_impact: string
  }>
  threat_assessment: {
    overall_threat: 'high' | 'medium' | 'low'
    threat_rationale: string
    areas_of_direct_competition: string[]
    areas_of_no_overlap: string[]
  }
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

export interface CreditsStatus {
  balance: number
  resetsAt: number       // Unix timestamp
  lifetimeUsed: number
  plan: PlanTier
  planAllotment: number  // credits per period
  period: 'daily' | 'monthly'
  costs: Record<string, number>
}

// ---------------------------------------------------------------------------
// Deep Search
// ---------------------------------------------------------------------------

export interface DeepSearchResult {
  title: string
  url: string
  snippet: string
  position: number
  source: 'serp'
}

export interface DeepSearchScrapedPage {
  source: 'firecrawl'
  url: string
  markdown: string
  extract: Record<string, unknown>
  metadata: Record<string, unknown>
}

export interface DeepSearchHistory {
  id: string
  query: string
  createdAt: string
  events: Array<{ type: string; data: unknown }>
}
