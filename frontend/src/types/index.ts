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
  projectType?: 'business' | 'personal'
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
  projectType?: 'business' | 'personal'
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

export interface StreamStatus {
  type: 'status'
  message: string
}

export type StreamEvent = StreamDelta | StreamError | StreamToolCall | StreamToolResult | StreamStatus

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
  // Enriched fields
  data_snapshot?: {
    followers?: Record<string, number>
    avg_engagement?: Record<string, number>
    top_themes?: string[]
  }
  key_evidence?: string[]
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
  timeframe?: string
  effort?: 'low' | 'medium' | 'high'
}

export interface StrategyQuickWin {
  action: string
  why_now: string
  expected_result: string
}

export interface StrategyChannelPlatform {
  priority: 'primary' | 'secondary' | 'deprioritize'
  rationale: string
  recommended_formats: string[]
  posting_frequency: string
  content_angles: string[]
}

export interface CompetitiveStrategy {
  executive_summary: string
  market_snapshot?: {
    total_competitors: number
    market_maturity: string
    top_channels: string[]
    key_trends: string[]
    data_points: string[]
  }
  brand_position: {
    strengths: string[]
    vulnerabilities: string[]
    differentiation: string
    evidence?: string[]
  }
  competitor_breakdown: CompetitorStrategyBreakdown[]
  channel_strategy?: Record<string, StrategyChannelPlatform>
  content_strategy?: {
    themes_to_own: string[]
    themes_to_attack: string[]
    formats: Array<{ format: string; platform: string; rationale: string }>
  }
  battlegrounds: StrategyBattleground[]
  action_plan: StrategyAction[]
  quick_wins: StrategyQuickWin[] | string[]
  data_sources?: string[]
}

// ---------------------------------------------------------------------------
// Competitor Profiles — 5-Dimension Classification
// ---------------------------------------------------------------------------

export type GeographicScope = 'Local' | 'Regional' | 'National' | 'Global'
export type SizeTier = 'Micro' | 'SMB' | 'Mid-Market' | 'Enterprise'
export type Directness = 'Direct' | 'Indirect' | 'Substitute'
export type MarketPosition = 'Market Leader' | 'Challenger' | 'Niche Player' | 'New Entrant'
export type OverlapScore = 'Low' | 'Medium' | 'High'
export type ConfidenceScore = 'Low' | 'Medium' | 'High'
export type ProfileStatus = 'analyzing' | 'complete' | 'error'

export interface CompetitorProfile {
  id: string
  competitor_name: string
  website: string
  status: ProfileStatus

  // Dimension 1 — Geographic Scope
  geographic_scope?: GeographicScope
  geographic_locations?: string[]
  geographic_evidence?: string

  // Dimension 2 — Size & Revenue
  size_tier?: SizeTier
  employee_count?: string
  revenue_range?: string
  size_evidence?: string

  // Dimension 3 — Directness
  directness?: Directness
  directness_reason?: string
  overlap_score?: OverlapScore

  // Dimension 4 — Market Position
  market_position?: MarketPosition
  market_position_signals?: string[]

  // Dimension 5 — Customer Segment
  customer_segment_tags?: string[]
  segment_evidence?: string

  // Meta
  confidence_score?: ConfidenceScore
  sources_used?: string[]
  executive_summary?: string
  error?: string
  last_updated?: string
  createdAt?: string
  updatedAt?: string
}

export type ClassifyStreamEvent =
  | { type: 'step'; step: string; message: string; profile_id?: string }
  | { type: 'complete'; profile: CompetitorProfile }
  | { type: 'error'; message: string; profile_id?: string }

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
  title?: string | null
  media_url?: string | null
  media_type?: string | null  // 'image' | 'video' | 'blog' | 'carousel'
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
  keywords?: string[]
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
  logo_url?: string
  type?: 'company' | 'influencer' | 'creator' | 'media'
  segments?: string[]
  geography?: 'Local' | 'Regional' | 'National' | 'Global'
  estimated_revenue_range?: string
  social_hints?: {
    instagram?: string
    facebook?: string
    tiktok?: string
    linkedin?: string
    youtube?: string
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
  evidence?: string
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
    // Source companion fields
    description_source?: string
    size_source?: string
    founded_source?: string
    location_source?: string
    revenue_source?: string
    funding_source?: string
  }
  platform_metrics: CompetitorReportPlatformMetric[]
  growth_trajectory: Array<{ month: string; followers_total: number; engagement_index: number }>
  revenue_trajectory: Array<{ period: string; value: number; basis?: string }>
  content_mix: Array<{ type: string; percentage: number }>
  vs_brand_scorecard: CompetitorReportScorecard[]
  what_they_do_better: Array<{
    area: string
    detail: string
    impact: string
    how_to_respond: string
    evidence?: string
  }>
  their_strategy: {
    core_message: string
    content_pillars: string[]
    posting_cadence: string
    cta_strategy: string
    audience_focus: string
    notable_tactics?: string[]
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
  recent_news_highlights?: Array<{
    headline: string
    date: string
    url: string
    implication: string
  }>
  data_sources?: string[]
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

export interface CreditTransaction {
  id: string
  type: 'debit' | 'credit'
  amount: number
  action: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Funnel Strategy Engine
// ---------------------------------------------------------------------------

export type FunnelType = 'tofu' | 'mofu' | 'bofu' | 'full' | 'retention'
export type StrategyStatus = 'intake' | 'researching' | 'generating' | 'complete'

export interface StrategyQuestion {
  index: number
  text: string
  placeholder?: string
  type?: 'funnel_selector' | 'text'
  options?: string[]
}

export interface ResearchStep {
  step: string
  label: string
  status: 'running' | 'done' | 'skipped'
}

export interface ResearchSearch {
  query: string
  source: string
  engine: string
  results: string[]
  result_count: number
  status: 'searching' | 'done'
}

export interface StrategySection {
  heading: string
  content: string
}

export interface MarketingStrategy {
  id: string
  projectId: string
  sessionId: string
  version: number
  title: string
  funnelType: FunnelType
  fullMarkdown: string
  sections: StrategySection[]
  isActive: boolean
  intakeAnswers: Record<string, string>
  createdAt: string
}

export interface StrategyQAPair {
  questionText: string
  answer: string
}

export interface StrategySession {
  sessionId: string
  status: StrategyStatus
  funnelType: FunnelType | null
  intakeAnswers: Record<string, string>
  intakeQA: StrategyQAPair[]
  currentQuestion: StrategyQuestion | null
  questionNumber: number
  totalQuestions: number
  researchSteps: ResearchStep[]
  researchSearches: ResearchSearch[]
  streamedMarkdown: string
  savedStrategy: MarketingStrategy | null
}

// SSE events emitted by the strategy research endpoint
export type StrategyResearchEvent =
  | { type: 'research_step'; step: string; label: string; status: 'running' | 'done' | 'skipped' }
  | { type: 'research_search'; query: string; source: string; engine: string; results: string[]; result_count: number; status: 'searching' | 'done' }
  | { type: 'research_complete' }
  | { type: 'error'; message: string }

// SSE events emitted by the strategy generate endpoint
export type StrategyGenerateEvent =
  | { type: 'delta'; content: string }
  | { type: 'strategy_saved'; strategy_id: string; title: string; version: number }
  | { type: 'error'; message: string }

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

// ---------------------------------------------------------------------------
// Carousel Studio
// ---------------------------------------------------------------------------

export interface BrandProfile {
  domain?: string
  logo_url?: string
  primary_color: string
  secondary_color: string
  background_color: string
  heading_font: string
  body_font: string
  tone: string
  formality: string
  personality: string[]
  avoid_words: string[]
  dominant_content_type: string
  instagram_aesthetic: string
  audience_signal: string
  suggested_carousel_type: string
  tagline?: string
}

export interface CarouselIntakeOption {
  value: string
  label: string
  description: string
  recommended?: boolean
}

export interface CarouselIntakeQuestion {
  index: number | string
  text: string
  options?: CarouselIntakeOption[]
  type?: 'free_text'
  placeholder?: string
}

export interface CarouselSlide {
  index: number
  type: string
  background: 'LIGHT_BG' | 'DARK_BG' | 'GRADIENT'
  tag: string
  headline: string
  body: string
  component: 'stat_block' | 'feature_list' | 'numbered_steps' | 'quote_box' | 'cta_centred' | 'none'
  component_data: Record<string, unknown>
}

export interface Carousel {
  id: string
  project_id: string
  session_id?: string
  title: string
  carousel_type: string
  format: 'portrait' | 'square' | 'landscape' | 'stories'
  design_style: string
  slide_count: number
  html_content?: string
  slide_data?: CarouselSlide[]
  colour_system?: Record<string, string>
  heading_font?: string
  body_font?: string
  cover_png_url?: string
  zip_url?: string
  slide_urls?: string[]
  version: number
  status: 'draft' | 'approved' | 'exported'
  created_at: string
  updated_at?: string
}

export interface CarouselSession {
  sessionId: string
  status: 'intake' | 'generating' | 'complete'
  intakeAnswers: Record<string, string>
  currentQuestion: CarouselIntakeQuestion | null
  questionNumber: number
  totalQuestions: number
  brandProfile: BrandProfile | null
  scrapingSteps: { message: string; done: boolean }[]
  scraping: boolean
  carouselId?: string
  htmlContent?: string
  slideCount?: number
}

// SSE events from carousel scrape endpoint
export type CarouselScrapeEvent =
  | { type: 'step'; message: string; done: boolean }
  | { type: 'done'; brand_profile: BrandProfile; cached?: boolean }
  | { type: 'error'; message: string }

// SSE events from carousel generate endpoint
export type CarouselGenerateEvent =
  | { type: 'status'; message: string }
  | { type: 'done'; carousel_id: string; html_content: string; slide_count: number; title: string }
  | { type: 'error'; message: string }

// SSE events from carousel export endpoint
export type CarouselExportEvent =
  | { type: 'progress'; slide: number; total: number }
  | { type: 'status'; message: string }
  | { type: 'done'; zip_url: string | null; slide_urls: string[]; slide_count: number }
  | { type: 'error'; message: string }

// ---------------------------------------------------------------------------
// Competitor Deep Research — 7-Layer Intelligence Engine
// ---------------------------------------------------------------------------

export interface CompetitorInput {
  name: string
  website?: string
  domain?: string
  instagram?: string
  tiktok?: string
  facebook?: string
  linkedin?: string
  youtube?: string
}

export interface CompetitorOverview {
  headline: string
  value_prop: string
  target_customer: string
  tone: string
  pricing_model: string
  price_anchor: string
  top_claims: string[]
  trust_signals: string[]
  threat_level: 'high' | 'medium' | 'low'
  strengths_vs_us: string[]
  weaknesses_vs_us: string[]
}

export interface CompetitorPaidAds {
  ads_found: number
  most_used_hook: string
  dominant_cta: string
  primary_offer: string
  ad_formats: { image: number; video: number; carousel: number }
  messaging_themes: string[]
  longest_running_ad: { copy: string; days_active: number }
  target_audience_signals: string
  estimated_ad_budget_signal: 'low' | 'medium' | 'high'
  winning_angle: string
}

export interface CompetitorSocialContent {
  platforms_scraped: string[]
  posting_frequency: Record<string, string>
  best_performing_format: string
  top_content_themes: string[]
  best_posting_times: string[]
  avg_engagement_rate: string
  caption_style: string
  top_hashtags: string[]
  content_they_avoid: string[]
  viral_content_pattern: string
  weaknesses: string[]
  platform_raw: Record<string, { followers: number; post_count: number; top_hashtags: string[] }>
}

export interface CompetitorSEO {
  seo_strength: 'low' | 'medium' | 'high'
  indexed_pages: number
  ranking_keywords: string[]
  google_ads_running: boolean
  google_ad_message: string
  autocomplete_signals: string[]
  trending_vs_us: 'growing' | 'declining' | 'stable'
  seo_gap_for_us: string
}

export interface CompetitorSentiment {
  overall_sentiment: 'positive' | 'mixed' | 'negative' | 'unknown'
  top_praise: string[]
  top_complaints: string[]
  feature_requests: string[]
  churn_signals: string[]
  brand_loyalty_signals: string[]
  unmet_needs: string[]
}

export interface CompetitorContentMap {
  owned_topics: string[]
  publishing_frequency: string
  content_format_preference: string
  topics_they_avoid: string[]
  seo_content_pillars: string[]
  our_opportunity_topics: string[]
}

export interface CompetitorSWOT {
  strengths: string[]
  weaknesses: string[]
  opportunities_for_us: string[]
  threats_to_us: string[]
  positioning_summary: string
  how_they_win_customers: string
  how_we_beat_them: string
  threat_level: 'high' | 'medium' | 'low'
  steal_this: {
    tactic: string
    why_it_works: string
    our_version: string
  }
}

export interface DeepResearchReport {
  id: string
  run_id: string
  project_id: string
  competitor: CompetitorInput & { logo_url?: string }
  overview: CompetitorOverview
  paid_ads: CompetitorPaidAds
  social_content: CompetitorSocialContent
  seo: CompetitorSEO
  sentiment: CompetitorSentiment
  content_map: CompetitorContentMap
  strategic_swot: CompetitorSWOT
  created_at: string
}

export interface DeepResearchReportSummary {
  id: string
  run_id: string
  competitor: CompetitorInput & { logo_url?: string }
  threat_level: 'high' | 'medium' | 'low'
  created_at: string
}

export interface CompetitorMonitor {
  id: string
  project_id: string
  competitor: CompetitorInput
  frequency: 'weekly' | 'monthly'
  is_active: boolean
  last_run_at: string | null
  last_snapshot: Record<string, unknown>
  has_significant_changes: boolean
  created_at: string
  updated_at: string
}

export interface MonitorChangeAlert {
  id: string
  monitor_id: string
  type: 'new_ads_launched' | 'ads_pulled' | 'frequency_change' | 'new_content_theme' | 'content_spike'
  description: string
  is_significant: boolean
  created_at: string
}


// SSE events from deep research endpoint
export type DeepResearchEvent =
  | { type: 'run_started'; run_id: string; competitor_count: number }
  | { type: 'competitor_started'; name: string }
  | { type: 'layer_started'; layer: number; name: string; message: string }
  | { type: 'layer_done'; layer: number; name: string }
  | { type: 'competitor_done'; name: string; report_id: string }
  | { type: 'research_complete'; run_id: string; reports: { id: string; name: string }[] }
  | { type: 'error'; message: string }

// ---------------------------------------------------------------------------
// Personal Branding Module
// ---------------------------------------------------------------------------

export interface PersonaExpertiseTopic {
  topic: string
  depth: 1 | 2 | 3
  differentiatingAngle?: string
}

export interface PersonaAudience {
  role?: string
  industry?: string
  painPoints: string[]
  goals: string[]
  primaryPlatforms: string[]
}

export interface PersonaContentPillar {
  name: string
  description?: string
  contentAngles: string[]
  percentage: number
}

export interface PersonaPlatformConfig {
  focusLevel: 'primary' | 'secondary' | 'passive'
  postsPerWeek: number
  contentTypes: string[]
  toneAdjustment?: string
}

export interface PersonalCore {
  projectId: string
  fullName: string
  headline?: string
  linkedinUrl?: string
  positioningStatement?: string
  uniqueAngle?: string
  originStory?: string
  values: string[]
  credentialHighlights: string[]
  expertiseTopics: PersonaExpertiseTopic[]
  avoidedTopics: string[]
  targetAudience?: PersonaAudience
  secondaryAudiences: PersonaAudience[]
  contentPillars: PersonaContentPillar[]
  platformStrategy: Record<string, PersonaPlatformConfig>
  brandGoals: string[]
  goal90Day?: string
  goal12Month?: string
  admiredVoices: string[]
  antiVoices: string[]
  nicheTiredTopics: string[]
  // Interview state
  interviewStatus: 'not_started' | 'in_progress' | 'complete'
  interviewAnswers: Record<string, string>
  interviewProgress: number
  // Enrichment
  enrichmentStatus: 'pending' | 'running' | 'complete' | 'error'
  completenessScore: number
  version: number
  createdAt?: string
  updatedAt?: string
}

export interface PersonalVoiceProfile {
  projectId: string
  formalityLevel: number
  sentenceLength: 'short' | 'medium' | 'long' | 'mixed'
  emotionalRegister: 'analytical' | 'warm' | 'direct' | 'storytelling' | 'provocative'
  signaturePhrases: string[]
  avoidedPhrases: string[]
  punctuationStyle: string
  writingPatterns?: string[]
  writingSamples: string[]
  approvedOutputs: { content: string; platform: string; editedByUser: boolean; approvedAt: string }[]
  accuracyScore: number
  toneVariants: Record<string, { formalityAdjustment: number; notes: string }>
  lastCalibrated?: string
}

export type VoiceCalibrationEvent =
  | { type: 'step'; label: string; status: 'running' | 'done' | 'error' }
  | { type: 'progress'; pct: number }
  | { type: 'done'; voiceProfile: PersonalVoiceProfile }
  | { type: 'error'; message: string }

export interface InterviewQuestion {
  key: string
  module: string
  moduleLabel: string
  prompt: string
  hint?: string
  chips: string[]
}

export interface InterviewNextResponse {
  question: InterviewQuestion | null
  progress: number
  answeredCount: number
  totalCount: number
  interviewStatus: 'not_started' | 'in_progress' | 'complete'
}

export type PersonalCoreExtractionEvent =
  | { type: 'step'; label: string; status: 'running' | 'done' | 'error' }
  | { type: 'progress'; pct: number }
  | { type: 'done'; personalCore: PersonalCore }
  | { type: 'error'; message: string }

// ---------------------------------------------------------------------------
// Content Engine types
// ---------------------------------------------------------------------------

export type ContentPlatform = 'linkedin' | 'instagram' | 'twitter' | 'tiktok' | 'threads' | 'youtube'

export interface GeneratedPost {
  type: 'post' | 'story' | 'opinion' | 'article'
  platform: ContentPlatform | string
  content: string
  voiceAccuracyScore: number
  generatedAt: string
  topic?: string
  originalStory?: string
  take?: string
  wordCount?: number
}

export interface OpinionQuestions {
  type: 'questions'
  take: string
  questions: string[]
}

export interface GeneratedBios {
  type: 'bios'
  bios: {
    linkedin?: { headline: string; aboutPreview: string; aboutFull: string }
    instagram?: { bio: string; linkLabel: string }
    twitter?: { bio: string }
    tiktok?: { bio: string }
  }
  generatedAt: string
}

export interface ReformattedContent {
  type: 'reformat'
  sourcePlatform: ContentPlatform
  originalContent: string
  platforms: Record<string, { content: string; notes: string }>
  generatedAt: string
}

export type ContentEngineEvent =
  | { type: 'step'; label: string; status: 'running' | 'done' | 'error' }
  | { type: 'progress'; pct: number }
  | { type: 'done'; result: GeneratedPost | OpinionQuestions | GeneratedBios | ReformattedContent }
  | { type: 'error'; message: string }

// ---------------------------------------------------------------------------
// Publishing (Ayrshare)
// ---------------------------------------------------------------------------

export interface ConnectedPlatform {
  platform: string
  username: string
  displayName: string
  isActive: boolean
  profileUrl: string
}

export interface PublishingProfile {
  profileKey: string
  title: string
  createdAt: string
  connectedPlatforms: ConnectedPlatform[]
}

export interface PublishedPost {
  id: string
  projectId: string
  post: string
  platforms: string[]
  scheduledAt: string | null
  status: 'published' | 'scheduled' | 'failed'
  ayrsharePostId?: string
  createdAt: string
}

export interface AyrsharePostResult {
  id?: string
  status?: string
  postIds?: Record<string, string>
  errors?: Record<string, string>
}
