'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { ProjectCreate } from '@/types'

// ---------------------------------------------------------------------------
// Platform SVG icons
// ---------------------------------------------------------------------------

function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#ig)" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4" stroke="url(#ig)" strokeWidth="1.5" />
      <circle cx="17.5" cy="6.5" r="1" fill="url(#ig)" />
      <defs>
        <linearGradient id="ig" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f09433" /><stop offset="25%" stopColor="#e6683c" />
          <stop offset="50%" stopColor="#dc2743" /><stop offset="75%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" fill="#1877F2" className="w-4 h-4">
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.79-4.697 4.532-4.697 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  )
}

function IconLinkedIn() {
  return (
    <svg viewBox="0 0 24 24" fill="#0A66C2" className="w-4 h-4">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function IconTikTok() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function IconYouTube() {
  return (
    <svg viewBox="0 0 24 24" fill="#FF0000" className="w-4 h-4">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function IconThreads() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.582-1.288-.878-2.309-.88h-.05c-.832 0-1.983.228-2.72 1.173l-1.696-1.24c.926-1.269 2.355-1.956 4.006-1.989 1.402.013 3.195.554 4.026 2.394.52 1.13.718 2.563.515 4.352.82.568 1.461 1.285 1.896 2.284.764 1.756.785 4.57-1.29 6.601C18.063 23.195 15.7 23.979 12.186 24zM10.1 16.001c.07 1.317 1.015 1.865 2.02 1.811.895-.048 1.594-.434 2.08-1.149.42-.624.648-1.518.66-2.63a11.24 11.24 0 0 0-2.557-.175c-1.83.105-2.22.88-2.203 2.143z" />
    </svg>
  )
}

function IconPinterest() {
  return (
    <svg viewBox="0 0 24 24" fill="#E60023" className="w-4 h-4">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  )
}

function IconSnapchat() {
  return (
    <svg viewBox="0 0 24 24" fill="#FFFC00" stroke="#000" strokeWidth="0.3" className="w-4 h-4">
      <path d="M12.166.006C10.015.006 5.709.56 3.756 4.904c-.63 1.39-.478 3.784-.398 5.088l-.002.034c-.2.113-.43.17-.667.17-.31 0-.63-.1-.89-.176l-.04-.012a1.24 1.24 0 0 0-.32-.053c-.65 0-1.2.41-1.2.91 0 .63.68.97 1.35 1.13.077.017.387.082.684.082.094 0 .185-.007.272-.023-.03.057-.06.116-.094.178-.326.6-.773 1.422-1.716 2.075a.764.764 0 0 0-.355.64c0 .255.13.49.357.647.49.33 1.37.56 2.53.68.1.26.226.88.595.88.18 0 .38-.07.57-.14.44-.17 1.05-.39 1.98-.39.83 0 1.56.27 2.38.78.7.44 1.48.95 2.77.95s2.08-.51 2.78-.95c.82-.51 1.55-.78 2.38-.78.93 0 1.54.22 1.98.39.19.07.39.14.57.14.37 0 .49-.62.6-.88 1.16-.12 2.04-.35 2.53-.68a.793.793 0 0 0 .356-.648.764.764 0 0 0-.355-.64c-.943-.653-1.39-1.475-1.716-2.075a1.726 1.726 0 0 1-.094-.178c.087.016.178.023.272.023.297 0 .607-.065.684-.082.67-.16 1.35-.5 1.35-1.13 0-.5-.55-.91-1.2-.91-.107 0-.214.018-.32.053l-.04.012c-.26.076-.58.176-.89.176-.237 0-.467-.057-.667-.17l-.002-.034c.08-1.304.232-3.698-.398-5.088C18.29.56 13.984.006 12.166.006z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SocialLinkField {
  key: keyof ProjectCreate
  label: string
  placeholder: string
  icon: React.ReactNode
  required?: boolean
}

const SOCIAL_FIELDS: SocialLinkField[] = [
  { key: 'websiteUrl',   label: 'Website',   placeholder: 'https://yourbrand.com',          icon: <IconGlobe />,    required: true },
  { key: 'instagramUrl', label: 'Instagram', placeholder: 'https://instagram.com/yourbrand', icon: <IconInstagram />, required: true },
  { key: 'facebookUrl',  label: 'Facebook',  placeholder: 'https://facebook.com/yourbrand',  icon: <IconFacebook /> },
  { key: 'linkedinUrl',  label: 'LinkedIn',  placeholder: 'https://linkedin.com/company/yourbrand', icon: <IconLinkedIn /> },
  { key: 'tiktokUrl',   label: 'TikTok',   placeholder: 'https://tiktok.com/@yourbrand',    icon: <IconTikTok /> },
  { key: 'xUrl',        label: 'X (Twitter)', placeholder: 'https://x.com/yourbrand',       icon: <IconX /> },
  { key: 'youtubeUrl',  label: 'YouTube',   placeholder: 'https://youtube.com/@yourbrand',  icon: <IconYouTube /> },
  { key: 'threadsUrl',  label: 'Threads',   placeholder: 'https://threads.net/@yourbrand',  icon: <IconThreads /> },
  { key: 'pinterestUrl',label: 'Pinterest', placeholder: 'https://pinterest.com/yourbrand', icon: <IconPinterest /> },
  { key: 'snapchatUrl', label: 'Snapchat',  placeholder: 'https://snapchat.com/add/yourbrand', icon: <IconSnapchat /> },
]

interface ModelOption { label: string; value: string }

const CONTENT_MODELS: ModelOption[] = [
  { label: 'Claude Sonnet', value: 'claude-sonnet-4-6' },
  { label: 'GPT-4o',        value: 'gpt-4o' },
  { label: 'Gemini Pro',    value: 'gemini-pro' },
]
const IMAGE_MODELS: ModelOption[] = [
  { label: 'DALL-E 3', value: 'dall-e-3' },
]
const VIDEO_MODELS: ModelOption[] = [
  { label: 'Gemini Flash', value: 'gemini-flash' },
  { label: 'GPT-4o',       value: 'gpt-4o' },
]
const PROMPT_MODELS: ModelOption[] = [
  { label: 'Claude Opus', value: 'claude-opus-4-6' },
  { label: 'GPT-4o',      value: 'gpt-4o' },
  { label: 'Llama',       value: 'llama-3-70b' },
]

// ---------------------------------------------------------------------------
// Step indicators
// ---------------------------------------------------------------------------

const BUSINESS_STEPS = ['Brand', 'Links', 'Models']
const PERSONAL_STEPS = ['You', 'Models']

function StepDots({ current, projectType }: { current: number; projectType: 'business' | 'personal' }) {
  const steps = projectType === 'personal' ? PERSONAL_STEPS : BUSINESS_STEPS
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={cn(
            'flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold transition-all',
            i < current  ? 'bg-primary text-primary-foreground' :
            i === current ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' :
                            'bg-muted text-muted-foreground',
          )}>
            {i < current ? <Check className="w-3 h-3" /> : i + 1}
          </div>
          <span className={cn(
            'text-xs',
            i === current ? 'text-foreground font-medium' : 'text-muted-foreground',
          )}>{label}</span>
          {i < steps.length - 1 && <div className="w-6 h-px bg-border" />}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export function ProjectWizard() {
  const router = useRouter()
  const {
    wizardOpen, setWizardOpen,
    projects, setProjects, setActiveProject,
    setChats, setActiveChat,
    setIngestionOpen, openUpgradeModal,
  } = useAppStore()

  // Type selection (step -1 before the numbered flow)
  const [projectType, setProjectType] = useState<'business' | 'personal' | null>(null)
  const [step, setStep] = useState(-1)   // -1 = type selection
  const [submitting, setSubmitting] = useState(false)

  // Shared
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // Business-only: social links
  const [socialLinks, setSocialLinks] = useState<Partial<Record<keyof ProjectCreate, string>>>({})
  const [socialErrors, setSocialErrors] = useState<Partial<Record<keyof ProjectCreate, string>>>({})

  // Personal-only
  const [linkedinUrl, setLinkedinUrl] = useState('')

  // Models (both)
  const [contentModel, setContentModel] = useState('claude-sonnet-4-6')
  const [imageModel,   setImageModel]   = useState('dall-e-3')
  const [videoModel,   setVideoModel]   = useState('gemini-flash')
  const [promptModel,  setPromptModel]  = useState('claude-opus-4-6')

  if (!wizardOpen) return null

  function handleClose() {
    if (submitting) return
    setWizardOpen(false)
    resetState()
  }

  function resetState() {
    setProjectType(null)
    setStep(-1)
    setName('')
    setDescription('')
    setSocialLinks({})
    setSocialErrors({})
    setLinkedinUrl('')
    setContentModel('claude-sonnet-4-6')
    setImageModel('dall-e-3')
    setVideoModel('gemini-flash')
    setPromptModel('claude-opus-4-6')
  }

  // Business: Step 0 → Step 1
  function goToLinks() {
    if (!name.trim()) return
    setStep(1)
  }

  // Business: Step 1 → Step 2
  function goToModels() {
    const errors: Partial<Record<keyof ProjectCreate, string>> = {}
    if (!socialLinks.websiteUrl?.trim())   errors.websiteUrl   = 'Website URL is required'
    if (!socialLinks.instagramUrl?.trim()) errors.instagramUrl = 'Instagram URL is required'
    setSocialErrors(errors)
    if (Object.keys(errors).length > 0) return
    setStep(2)
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      if (projectType === 'personal') {
        // Personal brand project
        const payload: ProjectCreate = {
          name: name.trim(),
          projectType: 'personal',
          linkedinUrl: linkedinUrl.trim() || undefined,
          contentModel,
          imageModel,
          videoModel,
          promptModel,
        }

        const project = await api.projects.create(payload)
        setProjects([project, ...projects])
        setActiveProject(project)

        // Create initial Personal Core
        await api.persona.initCore(project.id, {
          fullName: name.trim(),
          linkedinUrl: linkedinUrl.trim() || undefined,
        })

        // Create a default chat
        const chat = await api.chats.create(project.id, 'New Chat')
        setChats([chat])
        setActiveChat(chat)

        setWizardOpen(false)
        resetState()

        // Navigate to the interview onboarding page
        router.push(`/projects/${project.id}/personal-brand/onboarding`)
        toast.success(`Personal brand "${project.name}" created! Let's build your identity.`)
      } else {
        // Business brand project (existing flow)
        const payload: ProjectCreate = {
          name: name.trim(),
          description: description.trim() || undefined,
          projectType: 'business',
          ...socialLinks,
          contentModel,
          imageModel,
          videoModel,
          promptModel,
        }

        const project = await api.projects.create(payload)
        setProjects([project, ...projects])
        setActiveProject(project)

        const chat = await api.chats.create(project.id, 'New Chat')
        setChats([chat])
        setActiveChat(chat)

        setWizardOpen(false)
        resetState()

        router.push(`/projects/${project.id}/chats/${chat.id}`)

        if (payload.websiteUrl || payload.instagramUrl) {
          setTimeout(() => setIngestionOpen(true), 400)
        }

        toast.success(`Brand "${project.name}" created!`)
      }
    } catch (err) {
      const msg = String(err)
      if (msg.includes('402')) {
        setWizardOpen(false)
        openUpgradeModal("You've reached your project limit. Upgrade to create more brands.")
      } else {
        toast.error('Failed to create project')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="font-semibold text-sm">New Brand</h2>
          {!submitting && (
            <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6">
          <StepDots current={step} />

          <AnimatePresence mode="wait">
            {/* ── Step 1: Name & Description ── */}
            {step === 0 && (
              <motion.div
                key="step-name"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <p className="text-sm font-medium mb-1">Brand name <span className="text-destructive">*</span></p>
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) goToLinks() }}
                    placeholder="e.g. Acme Coffee Co."
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Description <span className="text-muted-foreground text-xs">(optional)</span></p>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this brand sell or stand for?"
                    rows={3}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={goToLinks}
                    disabled={!name.trim()}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Social Links ── */}
            {step === 1 && (
              <motion.div
                key="step-links"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <p className="text-xs text-muted-foreground mb-3">
                  LEO will scrape these to build your Brand Core. Required fields are marked <span className="text-destructive">*</span>.
                </p>

                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {SOCIAL_FIELDS.map((field) => {
                    const val = (socialLinks[field.key] as string) ?? ''
                    const err = socialErrors[field.key]
                    const hasVal = val.trim().length > 0
                    return (
                      <div key={field.key}>
                        <div className={cn(
                          'flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors',
                          err
                            ? 'border-destructive bg-destructive/5'
                            : hasVal
                            ? 'border-primary/50 bg-primary/5'
                            : field.required
                            ? 'border-input bg-background'
                            : 'border-input bg-background opacity-70 focus-within:opacity-100',
                        )}>
                          <span className="shrink-0">{field.icon}</span>
                          <input
                            type="url"
                            placeholder={field.placeholder}
                            value={val}
                            onChange={(e) => {
                              setSocialLinks((prev) => ({ ...prev, [field.key]: e.target.value }))
                              if (err) setSocialErrors((prev) => ({ ...prev, [field.key]: undefined }))
                            }}
                            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/50 min-w-0"
                          />
                          {field.required && <span className="text-destructive text-xs shrink-0">*</span>}
                          {hasVal && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </div>
                        {err && <p className="text-xs text-destructive mt-0.5 pl-1">{err}</p>}
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    onClick={() => setStep(0)}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={goToModels}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Model Selection ── */}
            {step === 2 && (
              <motion.div
                key="step-models"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-xs text-muted-foreground mb-3">
                  Choose the AI models LEO will use for each task type. These can be changed anytime in project settings.
                </p>

                {[
                  { label: 'Content Planning',  options: CONTENT_MODELS, value: contentModel, set: setContentModel },
                  { label: 'Image Generation',  options: IMAGE_MODELS,   value: imageModel,   set: setImageModel },
                  { label: 'Video Planning',    options: VIDEO_MODELS,   value: videoModel,   set: setVideoModel },
                  { label: 'Prompt Generation', options: PROMPT_MODELS,  value: promptModel,  set: setPromptModel },
                ].map(({ label, options, value, set }) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground shrink-0 w-36">{label}</p>
                    <select
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ))}

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                    ) : (
                      <>Create Brand <Check className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
