'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  MessageCircle, Send, Loader2, RefreshCw, Sparkles,
  Database, FileText, Users, BarChart2, X, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, type BrandChatMessage, type BrandChatSource } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  { icon: <BarChart2 className="w-3.5 h-3.5" />, text: 'What is my top performing content type?' },
  { icon: <Users className="w-3.5 h-3.5" />,    text: 'Who are my main competitors and what makes them different?' },
  { icon: <FileText className="w-3.5 h-3.5" />, text: 'What content should I create this week?' },
  { icon: <Sparkles className="w-3.5 h-3.5" />, text: 'Summarise my brand voice and tone' },
  { icon: <MessageCircle className="w-3.5 h-3.5" />, text: 'What topics resonate most with my audience?' },
  { icon: <BarChart2 className="w-3.5 h-3.5" />,text: 'Which platform should I focus on to grow faster?' },
]

// ---------------------------------------------------------------------------
// Source chip
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  brand_core:  'Brand Core',
  content:     'Library',
  competitor:  'Competitors',
  analytics:   'Analytics',
}

function SourceChip({ source }: { source: BrandChatSource }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
      {SOURCE_LABELS[source.type] ?? source.type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ msg }: { msg: BrandChatMessage & { streaming?: boolean } }) {
  const isUser = msg.role === 'user'
  return (
    <div className={cn('flex gap-3', isUser && 'justify-end')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      )}
      <div className={cn('max-w-[78%] space-y-1.5', isUser && 'items-end flex flex-col')}>
        <div className={cn(
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-card border border-border rounded-tl-sm',
        )}>
          <span className="whitespace-pre-wrap">{msg.content}</span>
          {msg.streaming && (
            <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse rounded-sm align-middle" />
          )}
        </div>
        {/* Source citations */}
        {!isUser && msg.sources && msg.sources.length > 0 && !msg.streaming && (
          <div className="flex flex-wrap gap-1 px-1">
            {[...new Set(msg.sources.map((s) => s.type))].map((type) => (
              <SourceChip key={type} source={{ id: type, type, text: '' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BrandChatPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [messages, setMessages] = useState<(BrandChatMessage & { streaming?: boolean })[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    api.brandChat.history(projectId)
      .then((r) => setMessages(r.messages))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [projectId])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  async function handleIndex() {
    setIndexing(true)
    try {
      const { indexed } = await api.brandChat.index(projectId)
      toast.success(`Brand data indexed — ${indexed} chunks ready`)
    } catch {
      toast.error('Indexing failed. Check that brand data exists.')
    } finally {
      setIndexing(false)
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return

    const userMsg: BrandChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      createdAt: new Date().toISOString(),
    }
    const streamingId = `streaming-${Date.now()}`
    const assistantMsg: BrandChatMessage & { streaming: boolean } = {
      id: streamingId,
      role: 'assistant',
      content: '',
      sources: [],
      createdAt: new Date().toISOString(),
      streaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setStreaming(true)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      await api.brandChat.send(
        projectId,
        text.trim(),
        {
          onDelta: (delta) => {
            setMessages((prev) =>
              prev.map((m) => m.id === streamingId
                ? { ...m, content: m.content + delta }
                : m,
              )
            )
          },
          onSources: (sources) => {
            setMessages((prev) =>
              prev.map((m) => m.id === streamingId
                ? { ...m, sources }
                : m,
              )
            )
          },
          onError: (err) => {
            toast.error(err)
            setMessages((prev) =>
              prev.map((m) => m.id === streamingId
                ? { ...m, content: 'Sorry, something went wrong. Please try again.', streaming: false }
                : m,
              )
            )
          },
          onDone: () => {
            setMessages((prev) =>
              prev.map((m) => m.id === streamingId ? { ...m, streaming: false } : m)
            )
            setStreaming(false)
          },
        },
        ctrl.signal,
      )
    } catch {
      setStreaming(false)
      setMessages((prev) =>
        prev.map((m) => m.id === streamingId ? { ...m, streaming: false } : m)
      )
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = !historyLoading && messages.length === 0

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <SidebarToggle />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <MessageCircle className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Brand Q&amp;A</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Ask anything about your brand</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleIndex}
            disabled={indexing}
            title="Re-index brand data for RAG"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {indexing
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Database className="w-3 h-3" />}
            {indexing ? 'Indexing…' : 'Sync Data'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {historyLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : isEmpty ? (
          /* Empty state with suggestions */
          <div className="flex flex-col items-center gap-6 py-10 max-w-lg mx-auto">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="font-semibold text-base">Brand Intelligence</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ask questions about your brand, content performance, competitors, or strategy.
                Leo searches your brand data to give grounded, specific answers.
              </p>
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s.text)}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                >
                  <span className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                    {s.icon}
                  </span>
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors flex-1 leading-relaxed">
                    {s.text}
                  </span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-200 w-full">
              <Database className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span>Click <strong>Sync Data</strong> first to index your brand content, library, and competitor data.</span>
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        {!isEmpty && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {SUGGESTIONS.slice(0, 3).map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s.text)}
                disabled={streaming}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-40"
              >
                {s.icon}
                <span className="truncate max-w-[160px]">{s.text}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your brand, content, competitors, or strategy…"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 placeholder:text-muted-foreground/50 max-h-32 overflow-y-auto"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={streaming || !input.trim()}
            className="shrink-0 w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {streaming
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Answers are grounded in your brand data. Press <kbd className="px-1 py-px border border-border rounded text-[9px]">Enter</kbd> to send, <kbd className="px-1 py-px border border-border rounded text-[9px]">Shift+Enter</kbd> for newline.
        </p>
      </div>
    </div>
  )
}
