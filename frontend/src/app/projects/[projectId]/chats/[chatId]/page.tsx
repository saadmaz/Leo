'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Zap, ChevronRight, ChevronDown, ChevronUp, Cpu, Megaphone } from 'lucide-react'
import { SidebarToggle } from '@/components/layout/sidebar'
import { MessageCard } from '@/components/chat/message-card'
import { PromptComposer } from '@/components/chat/prompt-composer'
import { BrandCorePanel } from '@/components/brand-core/brand-core-panel'
import { IngestionOverlay } from '@/components/brand-core/ingestion-overlay'
import { BrandVoiceScorerPanel } from '@/components/brand-tools/brand-voice-scorer-panel'
import { HashtagPanel } from '@/components/brand-tools/hashtag-panel'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/lib/api'
import type { ImageAttachment, OptimisticMessage } from '@/types'

/** Generate a unique ephemeral id for optimistic messages. */
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}


export default function ChatPage() {
  const params = useParams<{ projectId: string; chatId: string }>()
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [hintsOpen, setHintsOpen] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)

  const MESSAGES_PAGE_SIZE = 50

  const {
    user,
    activeProject,
    messages, setMessages, addMessage, appendDelta, finaliseMessage,
    isStreaming, setIsStreaming,
    streamController, setStreamController,
    setBrandCorePanelOpen, setIngestionOpen,
    upsertChat, openUpgradeModal,
    activeChannel, setActiveChannel,
    setCampaignPanelOpen,
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
    setHasMoreMessages(false)
    setMessagesLoading(true)
    api.chats
      .messages(params.projectId, params.chatId)
      .then((msgs) => {
        setHasMoreMessages(msgs.length >= MESSAGES_PAGE_SIZE)
        setMessages(
          msgs.map((m): OptimisticMessage => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          }))
        )
      })
      .catch(console.error)
      .finally(() => setMessagesLoading(false))
  }, [params.projectId, params.chatId, setMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLoadEarlier() {
    const oldest = useAppStore.getState().messages[0]
    if (!oldest?.createdAt || !params.projectId || !params.chatId) return
    setLoadingEarlier(true)
    try {
      const older = await api.chats.messages(params.projectId, params.chatId, oldest.createdAt)
      setHasMoreMessages(older.length >= MESSAGES_PAGE_SIZE)
      setMessages([
        ...older.map((m): OptimisticMessage => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
        ...useAppStore.getState().messages,
      ])
    } catch (err) {
      console.error('Failed to load earlier messages:', err)
    } finally {
      setLoadingEarlier(false)
    }
  }

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

  async function handleSubmit(content: string, attachments: ImageAttachment[] = []) {
    if ((!content.trim() && attachments.length === 0) || isStreaming) return
    setInput('')

    // Add optimistic user message immediately so the UI feels responsive.
    addMessage({ id: newId(), role: 'user', content })

    const assistantId = newId()
    addMessage({ id: assistantId, role: 'assistant', content: '', pending: true })
    setIsStreaming(true)

    // Create a new AbortController for this stream so we can cancel it.
    const controller = new AbortController()
    setStreamController(controller)

    // Strip previewUrl (blob URL) before sending to the backend — only base64+mediaType needed.
    const imagePayload = attachments.map(({ base64, mediaType }) => ({ base64, mediaType }))

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
          setIsStreaming(false)
          setStreamController(null)
          if (err.includes('402')) {
            // Remove the pending assistant bubble
            finaliseMessage(assistantId, '')
            openUpgradeModal("You've used all your messages for this month. Upgrade to keep chatting.")
          } else {
            finaliseMessage(assistantId, 'Something went wrong — please try again.')
          }
        },
      },
      controller.signal,
      activeChannel,
      imagePayload.length > 0 ? imagePayload : undefined,
    )
  }

  /** Re-send the last user message to get a fresh assistant response. */
  async function handleRegenerate() {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser || isStreaming) return
    // Remove the last assistant message (the one being regenerated)
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (lastAssistant) {
      setMessages(messages.filter((m) => m.id !== lastAssistant.id))
    }
    await handleSubmit(lastUser.content)
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
    <>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-3 sm:px-6 py-3 border-b border-border bg-card shrink-0">
          <SidebarToggle />
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{activeProject?.name ?? 'LEO'}</span>

          <div className="flex-1" />

          {/* Campaigns shortcut */}
          {activeProject && (
            <button
              onClick={() => setCampaignPanelOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border border-border text-muted-foreground text-xs hover:border-primary/40 hover:text-foreground transition-colors"
            >
              <Megaphone className="w-3 h-3" />
              Campaigns
            </button>
          )}

          {/* Active model badge */}
          {activeProject?.contentModel && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground text-[11px] font-mono">
              <Cpu className="w-3 h-3" />
              {activeProject.contentModel.replace('claude-', '').replace('-latest', '')}
            </div>
          )}

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
            {/* Skeleton loaders while history is fetching */}
            {messagesLoading && (
              <div className="space-y-6 py-4">
                {[
                  { role: 'user', lines: [60] },
                  { role: 'assistant', lines: [100, 85, 70] },
                  { role: 'user', lines: [45] },
                  { role: 'assistant', lines: [100, 90] },
                ].map((item, i) => (
                  <div key={i} className={`flex gap-4 px-4 ${item.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <Skeleton className="w-8 h-8 shrink-0 rounded-lg" />
                    <div className={`flex flex-col gap-2 ${item.role === 'user' ? 'items-end' : ''}`} style={{ maxWidth: '65%' }}>
                      {item.lines.map((w, j) => (
                        <Skeleton key={j} className="h-4 rounded" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!messagesLoading && messages.length === 0 && !isStreaming && (
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

                {/* Suggestion chips */}
                <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                  {(hasBrandCore ? [
                    'Write 5 Instagram captions',
                    'Create a campaign brief',
                    'Generate a content calendar for this week',
                    "What's my brand tone?",
                    'Write a promotional email',
                    'Analyse our brand positioning',
                  ] : [
                    'What can LEO do for my brand?',
                    'Write 5 Instagram captions',
                    'Create a content calendar',
                    'Write ad copy for Meta',
                  ]).map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {prompt}
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

                {/* What can LEO do? collapsible */}
                <div className="max-w-xs text-left">
                  <button
                    onClick={() => setHintsOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
                  >
                    {hintsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    What can LEO do?
                  </button>
                  <AnimatePresence>
                    {hintsOpen && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 space-y-1.5 overflow-hidden text-left"
                      >
                        {[
                          'Generate on-brand captions, ad copy & emails',
                          'Build campaign briefs and content calendars',
                          'Analyse and refine your brand voice',
                          'Generate images from prompts (DALL-E 3)',
                          'Switch channels — Instagram, LinkedIn, TikTok & more',
                        ].map((item) => (
                          <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="text-primary mt-0.5 shrink-0">✦</span>
                            {item}
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* Load earlier button — shown when there are more messages above */}
            {!messagesLoading && hasMoreMessages && messages.length > 0 && (
              <div className="flex justify-center py-2">
                <button
                  onClick={handleLoadEarlier}
                  disabled={loadingEarlier}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40"
                >
                  {loadingEarlier
                    ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />Loading…</>
                    : 'Load earlier messages'}
                </button>
              </div>
            )}

            {!messagesLoading && (
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <MessageCard
                      message={msg}
                      isLast={idx === messages.length - 1}
                      onRegenerate={!isStreaming ? handleRegenerate : undefined}
                      projectId={params.projectId}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <PromptComposer
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isStreaming}
          onStop={handleStop}
          activeChannel={activeChannel}
          onChannelChange={setActiveChannel}
          brandName={activeProject?.name}
        />
      </div>

      {/* Panels — rendered outside the scroll container */}
      <BrandCorePanel />
      <IngestionOverlay />
      <BrandVoiceScorerPanel projectId={params.projectId} />
      <HashtagPanel />
    </>
  )
}
