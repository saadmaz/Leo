'use client'

import { useState } from 'react'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { OptimisticMessage } from '@/types'
import { ArtifactCard, parseArtifacts } from './artifact-cards'

interface MessageCardProps {
  message: OptimisticMessage
  isLast?: boolean
  onRegenerate?: () => void
  projectId?: string
}

export function MessageCard({ message, isLast, onRegenerate, projectId }: MessageCardProps) {
  const isAssistant = message.role === 'assistant'
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'approved' | 'rejected' | null>(null)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // For assistant messages: strip artifact blocks from text, collect cards
  const { clean, artifacts } = isAssistant
    ? parseArtifacts(message.content)
    : { clean: message.content, artifacts: [] }

  function handleCopy() {
    navigator.clipboard.writeText(clean || message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleApprove() {
    if (!projectId || feedback) return
    setFeedback('approved')
    try {
      await api.memory.feedback(projectId, {
        type: 'approve',
        original: (clean || message.content).slice(0, 500),
      })
    } catch {
      // non-critical — don't surface to user
    }
  }

  async function handleReject() {
    if (!projectId || feedback) return
    setShowRejectInput(true)
  }

  async function submitReject() {
    if (!projectId) return
    setFeedback('rejected')
    setShowRejectInput(false)
    try {
      await api.memory.feedback(projectId, {
        type: 'reject',
        original: (clean || message.content).slice(0, 500),
        reason: rejectReason || undefined,
      })
      toast.success("LEO will avoid this in future responses.")
    } catch {
      // non-critical
    }
    setRejectReason('')
  }

  return (
    <div className="w-full py-3">
      <div className={cn('flex gap-4 max-w-3xl mx-auto px-4', !isAssistant && 'flex-row-reverse')}>
        {/* Avatar */}
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 text-xs mt-0.5',
            isAssistant ? 'bg-primary/5 text-primary' : 'bg-secondary text-muted-foreground',
          )}
        >
          {isAssistant ? <Image src="/Leo-agent.png" alt="LEO" width={20} height={20} className="rounded-md" /> : <User className="h-3.5 w-3.5" />}
        </div>

        {/* Content */}
        <div className={cn('flex flex-col min-w-0 flex-1', !isAssistant && 'items-end')}>
          {isAssistant ? (
            /* --- Assistant: markdown + artifacts --- */
            <div className="w-full group/msg">
              {(clean || message.pending) && (
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }) {
                        const isBlock = className?.includes('language-')
                        return isBlock ? (
                          <code
                            className="block bg-muted rounded-lg px-4 py-3 text-[13px] font-mono overflow-x-auto"
                            {...props}
                          >
                            {children}
                          </code>
                        ) : (
                          <code
                            className="bg-muted px-1.5 py-0.5 rounded text-[13px] font-mono"
                            {...props}
                          >
                            {children}
                          </code>
                        )
                      },
                      p({ children }) {
                        return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
                      },
                      ul({ children }) {
                        return <ul className="mb-3 space-y-1 list-disc list-inside">{children}</ul>
                      },
                      ol({ children }) {
                        return <ol className="mb-3 space-y-1 list-decimal list-inside">{children}</ol>
                      },
                      li({ children }) {
                        return <li className="text-sm">{children}</li>
                      },
                      h1({ children }) {
                        return <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h1>
                      },
                      h2({ children }) {
                        return <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>
                      },
                      h3({ children }) {
                        return <h3 className="text-sm font-semibold mb-1.5 mt-3 first:mt-0">{children}</h3>
                      },
                      blockquote({ children }) {
                        return (
                          <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">
                            {children}
                          </blockquote>
                        )
                      },
                      strong({ children }) {
                        return <strong className="font-semibold text-foreground">{children}</strong>
                      },
                      hr() {
                        return <hr className="my-3 border-border" />
                      },
                    }}
                  >
                    {clean}
                  </ReactMarkdown>
                  {message.pending && (
                    <span className="inline-block w-2 h-4 ml-0.5 bg-foreground/60 rounded-sm animate-pulse align-middle" />
                  )}
                </div>
              )}

              {/* Artifact cards — only render when message is fully streamed */}
              {!message.pending && artifacts.map((artifact, i) => (
                <ArtifactCard key={i} artifact={artifact} />
              ))}

              {/* Action bar — copy + regenerate + memory feedback */}
              {!message.pending && (clean || artifacts.length > 0) && (
                <div className="mt-2 space-y-1.5">
                  <div className={cn(
                    'flex items-center gap-1 transition-opacity',
                    isLast ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100',
                  )}>
                    <button
                      onClick={handleCopy}
                      title="Copy response"
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>

                    {isLast && onRegenerate && (
                      <button
                        onClick={onRegenerate}
                        title="Regenerate response"
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate</span>
                      </button>
                    )}

                    {/* Memory feedback — only when projectId is available */}
                    {projectId && (
                      <div className="flex items-center gap-0.5 ml-auto">
                        <button
                          onClick={handleApprove}
                          title="Good response — LEO will do more of this"
                          className={cn(
                            'p-1.5 rounded-md text-xs transition-colors',
                            feedback === 'approved'
                              ? 'text-green-500 bg-green-500/10'
                              : 'text-muted-foreground hover:text-green-500 hover:bg-muted',
                          )}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={handleReject}
                          title="Bad response — LEO will avoid this"
                          className={cn(
                            'p-1.5 rounded-md text-xs transition-colors',
                            feedback === 'rejected'
                              ? 'text-red-500 bg-red-500/10'
                              : 'text-muted-foreground hover:text-red-500 hover:bg-muted',
                          )}
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Reject reason input */}
                  {showRejectInput && (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitReject()
                          if (e.key === 'Escape') { setShowRejectInput(false); setRejectReason('') }
                        }}
                        placeholder="What was wrong? (optional, press Enter)"
                        className="flex-1 text-xs bg-muted border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        onClick={submitReject}
                        className="text-xs px-2 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                      >
                        Send
                      </button>
                      <button
                        onClick={() => { setShowRejectInput(false); setRejectReason('') }}
                        className="p-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* --- User: plain bubble --- */
            <div className="bg-secondary/60 text-foreground px-4 py-2.5 rounded-2xl max-w-[85%] border border-border/20 text-[15px] leading-relaxed whitespace-pre-wrap">
              {message.content}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
