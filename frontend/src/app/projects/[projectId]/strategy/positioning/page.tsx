'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MessageSquare, ChevronLeft, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { SidebarToggle } from '@/components/layout/sidebar'
import { PositioningChat } from '@/components/pillar1/PositioningChat'
import { api } from '@/lib/api'
import { usePillar1Store } from '@/stores/pillar1-store'
import type { Pillar1Message } from '@/types'

export default function PositioningPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const store = usePillar1Store()
  const abortRef = useRef<AbortController | null>(null)

  const [context, setContext] = useState('')
  const [sessionStarted, setSessionStarted] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')

  async function startSession() {
    try {
      const res = await api.pillar1.startPositioning(projectId, { context: context.trim() || undefined })
      store.setPositioningDocId(res.doc_id)
      store.setPositioningStage(0)
      store.setPositioningMessages([])
      setSessionStarted(true)
      toast.success('Workshop started!')
    } catch {
      toast.error('Failed to start positioning workshop')
    }
  }

  async function sendMessage(message: string) {
    const docId = store.positioningDocId
    if (!docId) return

    // Optimistically add user message
    const userMsg: Pillar1Message = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    }
    store.appendPositioningMessage(userMsg)
    store.clearPositioningStreamText()
    setIsStreaming(true)
    setStreamingText('')

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      await api.pillar1.streamPositioningMessage(
        projectId,
        docId,
        message,
        {
          onDelta: (text) => {
            setStreamingText((prev) => prev + text)
          },
          onStageAdvance: (newStage, label) => {
            store.setPositioningStage(newStage)
            toast.info(`Stage advanced: ${label}`)
          },
          onSaved: () => {
            toast.success('Positioning statement complete!')
          },
          onError: (msg) => {
            toast.error(msg)
          },
          onDone: () => {
            // Save assistant message from accumulated stream text
            const finalText = streamingText
            if (finalText) {
              const assistantMsg: Pillar1Message = {
                id: `local-assistant-${Date.now()}`,
                role: 'assistant',
                content: finalText,
                created_at: new Date().toISOString(),
              }
              store.appendPositioningMessage(assistantMsg)
            }
            setStreamingText('')
            setIsStreaming(false)
          },
        },
        abortRef.current.signal,
      )
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') toast.error('Message failed')
      setIsStreaming(false)
    }
  }

  if (!sessionStarted) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="border-b border-border px-6 py-4 flex items-center gap-3">
          <SidebarToggle />
          <button onClick={() => router.push(`/projects/${projectId}/strategy`)} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <MessageSquare className="w-4 h-4 text-primary" />
          <div>
            <h1 className="font-semibold">Positioning Workshop</h1>
            <p className="text-xs text-muted-foreground">7-stage guided conversation · 5 credits/message</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full space-y-4">
            <div className="text-center">
              <MessageSquare className="w-10 h-10 text-primary mx-auto mb-3" />
              <h2 className="font-semibold text-lg">Start Your Workshop</h2>
              <p className="text-sm text-muted-foreground mt-1">
                A 7-stage guided conversation to craft your brand positioning statement.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Context (optional)</label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Any background context you'd like LEO to know before we start..."
                rows={3}
                className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <button
              onClick={startSession}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Start Workshop
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <button onClick={() => router.push(`/projects/${projectId}/strategy`)} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <MessageSquare className="w-4 h-4 text-primary" />
        <div>
          <h1 className="font-semibold">Positioning Workshop</h1>
          <p className="text-xs text-muted-foreground">5 credits per message</p>
        </div>
      </div>
      <PositioningChat
        messages={store.positioningMessages}
        currentStage={store.positioningStage}
        isStreaming={isStreaming}
        streamingContent={streamingText}
        onSend={sendMessage}
        className="flex-1"
      />
    </div>
  )
}
