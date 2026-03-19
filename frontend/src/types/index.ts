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
  createdAt: string
  updatedAt: string
}

export interface ProjectCreate {
  name: string
  description?: string
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
// SSE Stream events
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
