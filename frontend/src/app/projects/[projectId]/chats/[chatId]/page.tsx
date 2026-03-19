'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { Sidebar } from '@/components/layout/sidebar'
import { MessageCard } from '@/components/chat/message-card'
import { PromptComposer } from '@/components/chat/prompt-composer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/lib/api'
import type { OptimisticMessage } from '@/types'

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
    messages,
    setMessages,
    addMessage,
    appendDelta,
    finaliseMessage,
    isStreaming,
    setIsStreaming,
  } = useAppStore()

  useEffect(() => {
    if (!user) router.replace('/login')
  }, [user, router])

  // Load message history when the chat changes
  useEffect(() => {
    if (!params.projectId || !params.chatId) return
    setMessages([])
    api.chats
      .messages(params.projectId, params.chatId)
      .then((msgs) => {
        setMessages(
          msgs.map((m): OptimisticMessage => ({ id: m.id, role: m.role, content: m.content })),
        )
      })
      .catch(console.error)
  }, [params.projectId, params.chatId, setMessages])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  async function handleSubmit(content: string) {
    if (!content.trim() || isStreaming) return

    setInput('')
    addMessage({ id: newId(), role: 'user', content })

    const assistantId = newId()
    addMessage({ id: assistantId, role: 'assistant', content: '', pending: true })
    setIsStreaming(true)

    await api.streamMessage(params.projectId, params.chatId, content, {
      onDelta: (text) => appendDelta(assistantId, text),
      onDone: () => {
        const current = useAppStore.getState().messages.find((m) => m.id === assistantId)
        finaliseMessage(assistantId, current?.content ?? '')
        setIsStreaming(false)
      },
      onError: (err) => {
        console.error('Stream error:', err)
        finaliseMessage(assistantId, 'Something went wrong — please try again.')
        setIsStreaming(false)
      },
    })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{activeProject?.name ?? 'LEO'}</span>
          {activeProject?.brandCore && (
            <span className="text-xs text-muted-foreground/60">✦ Brand Core active</span>
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
                    {activeProject?.brandCore
                      ? 'Brand Core is active. Ask for captions, campaign briefs, ad copy, or strategy.'
                      : 'Paste your website or Instagram URL — LEO will build your Brand Core automatically.'}
                  </p>
                </div>
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
        />
      </div>
    </div>
  )
}
