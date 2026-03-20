'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Zap, MessageSquare, ArrowRight, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    icon: <Sparkles className="w-4 h-4" />,
    title: 'Create your brand',
    description: 'Give your brand a name — LEO will create a workspace for it.',
  },
  {
    icon: <Zap className="w-4 h-4" />,
    title: 'Build your Brand Core',
    description: 'Paste your website or Instagram URL. LEO extracts your tone, visuals, and messaging.',
  },
  {
    icon: <MessageSquare className="w-4 h-4" />,
    title: 'Start creating',
    description: 'Ask for captions, ad copy, campaign briefs, or content calendars — all on-brand.',
  },
]

export function OnboardingCard() {
  const router = useRouter()
  const { setProjects, projects, setActiveProject, setChats, setActiveChat, setIngestionOpen } = useAppStore()

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!name.trim() || loading) return
    setLoading(true)
    try {
      const project = await api.projects.create({ name: name.trim() })
      setProjects([project, ...projects])
      setActiveProject(project)
      const chat = await api.chats.create(project.id, 'New Chat')
      setChats([chat])
      setActiveChat(chat)
      router.push(`/projects/${project.id}/chats/${chat.id}`)
      setTimeout(() => setIngestionOpen(true), 400)
      toast.success(`Brand "${project.name}" created — let's build your Brand Core!`)
    } catch (err) {
      toast.error(String(err).includes('402')
        ? 'Project limit reached — upgrade to create more brands.'
        : 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-lg mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Welcome to LEO</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto">
          Your brand-aware AI marketing co-pilot. Get started in under 2 minutes.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-8">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className={cn(
              'flex items-start gap-4 p-4 rounded-xl border transition-colors',
              i === 0
                ? 'border-primary/30 bg-primary/5'
                : 'border-border bg-card opacity-60',
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
              i === 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}>
              {i + 1}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-medium', i !== 0 && 'text-muted-foreground')}>
                  {step.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create form */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <p className="text-sm font-medium">Name your brand</p>
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder="e.g. Acme Coffee Co."
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Get started
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
