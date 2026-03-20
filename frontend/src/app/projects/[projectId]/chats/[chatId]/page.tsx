'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Zap, ChevronRight } from 'lucide-react'
import { Sidebar } from '@/components/layout/sidebar'
import { MessageCard } from '@/components/chat/message-card'
import { PromptComposer } from '@/components/chat/prompt-composer'
import { BrandCorePanel } from '@/components/brand-core/brand-core-panel'
import { IngestionOverlay } from '@/components/brand-core/ingestion-overlay'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/lib/api'
import type { OptimisticMessage } from '@/types'

/** Generate a unique ephemeral id for optimistic messages. */
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function starterPrompts(brandName?: string): string[] {
  const brand = brandName ?? 'my brand'
  return [
    `Write 5 Instagram captions for ${brand}`,
    `Generate a campaign brief for ${brand}`,
    `Write Meta ad copy for ${brand}`,
    `What content themes should ${brand} focus on?`,
  ]
}

export default function ChatPage() {
  const params = useParams<{ projectId: string; chatId: string }>()
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  const {
    user,
    activeProject,
    messages, setMessages, addMessage, appendDelta, finaliseMessage,
    isStreaming, setIsStreaming,
    streamController, setStreamController,
    setBrandCorePanelOpen, setIngestionOpen,
    upsertChat,
  } = useAppStore()

  // Whether this is the first message in the chat (used to refresh the chat name).
  const isFirstMessage = messages.length === 0

  // Redirect to login if unauthenticated.
  useEffect(() => {
    if (!user) router.replace('/login')
  }, [user, router])

  // Load message history whenever the chat changes.
  useEffect(() => {
    if (!params.projectId || !params.chatId) return
    setMessages([])
    api.chats
      .messages(params.projectId, params.chatId)
      .then((msgs) =>
        setMessages(
          msgs.map((m): OptimisticMessage => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }))
        )
      )
      .catch(console.error)
  }, [params.projectId, params.chatId, setMessages])

  // Abort any in-flight stream when navigating away from this chat.
  useEffect(() => {
    return () => {
      streamController?.abort()
      setStreamController(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.chatId])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  async function handleSubmit(content: string) {
    if (!content.trim() || isStreaming) return
    setInput('')

    // Add optimistic user message immediately so the UI feels responsive.
    addMessage({ id: newId(), role: 'user', content })

    const assistantId = newId()
    addMessage({ id: assistantId, role: 'assistant', content: '', pending: true })
    setIsStreaming(true)

    // Create a new AbortController for this stream so we can cancel it.
    const controller = new AbortController()
    setStreamController(controller)

    await api.streamMessage(
      params.projectId,
      params.chatId,
      content,
      {
        onDelta: (text) => appendDelta(assistantId, text),

        onDone: () => {
          // Read the final accumulated content from the store.
          const current = useAppStore.getState().messages.find((m) => m.id === assistantId)
          finaliseMessage(assistantId, current?.content ?? '')
          setIsStreaming(false)
          setStreamController(null)

          // Refresh chat name if this was the first message (backend auto-names it).
          if (isFirstMessage) {
            api.chats
              .get(params.projectId, params.chatId)
              .then((chat) => upsertChat(chat))
              .catch(() => {/* non-critical — the chat just keeps its old name */})
          }
        },

        onError: (err) => {
          console.error('Stream error:', err)
          finaliseMessage(assistantId, 'Something went wrong — please try again.')
          setIsStreaming(false)
          setStreamController(null)
        },
      },
      controller.signal,
    )
  }

  /** Cancel the active SSE stream. The onDone/onError callbacks clean up state. */
  function handleStop() {
    streamController?.abort()
    // Optimistically finalise the partial message so the UI doesn't hang.
    const current = useAppStore.getState().messages.findLast((m) => m.pending)
    if (current) {
      finaliseMessage(current.id, current.content || '_(generation stopped)_')
    }
    setIsStreaming(false)
    setStreamController(null)
  }

  const hasBrandCore = Boolean(activeProject?.brandCore)
  const isProcessing = activeProject?.ingestionStatus === 'processing'

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{activeProject?.name ?? 'LEO'}</span>

          <div className="flex-1" />

          {/* Brand Core pill button */}
          {activeProject && (
            isProcessing ? (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs"
              >
                <Zap className="w-3 h-3" />
                Building Brand Core…
              </motion.div>
            ) : hasBrandCore ? (
              <button
                onClick={() => setBrandCorePanelOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
              >
                <Zap className="w-3 h-3" />
                Brand Core
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={() => setIngestionOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-dashed border-border text-muted-foreground text-xs hover:border-primary hover:text-primary transition-colors"
              >
                <Zap className="w-3 h-3" />
                Build Brand Core
              </button>
            )
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-3xl px-4 py-8 space-y-1">
            {messages.length === 0 && !isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-5"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-border flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-lg font-semibold">
                    {activeProject ? `Chat about ${activeProject.name}` : 'Start a conversation'}
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {hasBrandCore
                      ? 'Brand Core is active. Ask for captions, campaign briefs, ad copy, or strategy.'
                      : 'Paste your website or Instagram URL — LEO will build your Brand Core automatically.'}
                  </p>
                </div>

                {/* Starter prompts */}
                <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                  {starterPrompts(activeProject?.name).map((p) => (
                    <button
                      key={p}
                      onClick={() => handleSubmit(p)}
                      className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {!hasBrandCore && !isProcessing && activeProject && (
                  <button
                    onClick={() => setIngestionOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/5 border border-primary/20 text-primary text-sm hover:bg-primary/10 transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    Build my Brand Core
                  </button>
                )}
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <MessageCard message={msg} />
                </motion.div>
              ))}
            </AnimatePresence>

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <PromptComposer
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isStreaming}
          onStop={handleStop}
        />
      </div>

      {/* Panels — rendered outside the scroll container */}
      <BrandCorePanel />
      <IngestionOverlay />
    </div>
  )
}
