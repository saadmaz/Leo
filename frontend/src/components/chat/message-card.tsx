'use client'

import { useState } from 'react'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

// ---------------------------------------------------------------------------
// Code block with language badge + copy button
// ---------------------------------------------------------------------------

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const lang = className?.replace('language-', '') ?? ''

  function handleCopy() {
    const text = typeof children === 'string' ? children : String(children ?? '')
    navigator.clipboard.writeText(text.trimEnd())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-border/60 bg-[#0d0d0d] dark:bg-[#0d0d0d]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.04] border-b border-border/40">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          {lang || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        >
          {copied
            ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
            : <><Copy className="w-3 h-3" /><span>Copy</span></>
          }
        </button>
      </div>
      {/* Code body */}
      <code className="block px-4 py-3 text-[13px] font-mono leading-relaxed text-slate-200 overflow-x-auto whitespace-pre">
        {children}
      </code>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline code
// ---------------------------------------------------------------------------

function InlineCode({ children }: { children?: React.ReactNode }) {
  return (
    <code className="bg-muted/80 border border-border/50 px-1.5 py-0.5 rounded-md text-[12.5px] font-mono text-foreground">
      {children}
    </code>
  )
}

// ---------------------------------------------------------------------------
// MessageCard
// ---------------------------------------------------------------------------

export function MessageCard({ message, isLast, onRegenerate, projectId }: MessageCardProps) {
  const isAssistant = message.role === 'assistant'
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'approved' | 'rejected' | null>(null)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

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
    } catch { /* non-critical */ }
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
      toast.success('Leo will avoid this in future responses.')
    } catch { /* non-critical */ }
    setRejectReason('')
  }

  // -------------------------------------------------------------------------
  // User message
  // -------------------------------------------------------------------------
  if (!isAssistant) {
    return (
      <div className="w-full py-2 flex justify-end px-4">
        <div className="flex items-end gap-2.5 max-w-[78%]">
          <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-sm text-[14px] leading-relaxed whitespace-pre-wrap shadow-sm">
            {message.content}
          </div>
          <div className="w-7 h-7 shrink-0 rounded-full bg-secondary border border-border/40 flex items-center justify-center mb-0.5">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Assistant message
  // -------------------------------------------------------------------------
  return (
    <div className="w-full py-3 px-4">
      <div className="flex gap-3 max-w-3xl mx-auto">
        {/* Avatar */}
        <div className="w-8 h-8 shrink-0 rounded-xl bg-primary/5 border border-border/50 flex items-center justify-center mt-0.5 overflow-hidden">
          <Image src="/Leo-agent.png" alt="LEO" width={20} height={20} className="rounded-md" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 group/msg">
          {(clean || message.pending) && (
            <div className={cn(
              'prose prose-sm dark:prose-invert max-w-none',
              'text-[14px] leading-[1.75] text-foreground',
            )}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Code blocks
                  code({ className, children, ...props }) {
                    const isBlock = className?.includes('language-')
                    return isBlock
                      ? <CodeBlock className={className}>{children}</CodeBlock>
                      : <InlineCode {...props}>{children}</InlineCode>
                  },

                  // Paragraphs
                  p({ children }) {
                    return <p className="mb-3.5 last:mb-0 leading-[1.75] text-[14px]">{children}</p>
                  },

                  // Lists — ul uses dot marker, ol uses native counter
                  ul({ children }) {
                    return <ul className="mb-3.5 space-y-1.5 pl-1 list-none">{children}</ul>
                  },
                  ol({ children }) {
                    return <ol className="mb-3.5 space-y-1.5 list-decimal list-outside ml-5">{children}</ol>
                  },
                  li({ ordered, children }: { ordered?: boolean; children?: React.ReactNode }) {
                    return ordered ? (
                      <li className="text-[14px] leading-relaxed pl-1">{children}</li>
                    ) : (
                      <li className="text-[14px] leading-relaxed flex gap-2 items-start">
                        <span className="mt-[0.58em] w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0 flex-none" />
                        <span>{children}</span>
                      </li>
                    )
                  },

                  // Headings
                  h1({ children }) {
                    return <h1 className="text-[18px] font-bold mb-3 mt-5 first:mt-0 text-foreground tracking-tight">{children}</h1>
                  },
                  h2({ children }) {
                    return <h2 className="text-[15px] font-semibold mb-2.5 mt-4 first:mt-0 text-foreground tracking-tight">{children}</h2>
                  },
                  h3({ children }) {
                    return <h3 className="text-[13.5px] font-semibold mb-2 mt-3 first:mt-0 text-foreground/90">{children}</h3>
                  },

                  // Blockquote
                  blockquote({ children }) {
                    return (
                      <blockquote className="my-3 pl-3.5 border-l-[3px] border-primary/40 text-muted-foreground italic text-[13.5px] leading-relaxed bg-muted/20 py-1 rounded-r-lg">
                        {children}
                      </blockquote>
                    )
                  },

                  // Strong / em
                  strong({ children }) {
                    return <strong className="font-semibold text-foreground">{children}</strong>
                  },
                  em({ children }) {
                    return <em className="italic text-foreground/80">{children}</em>
                  },

                  // HR
                  hr() {
                    return <hr className="my-4 border-border/50" />
                  },

                  // Tables
                  table({ children }) {
                    return (
                      <div className="my-3 overflow-x-auto rounded-xl border border-border">
                        <table className="w-full text-[13px] border-collapse">{children}</table>
                      </div>
                    )
                  },
                  thead({ children }) {
                    return <thead className="bg-muted/50 border-b border-border">{children}</thead>
                  },
                  tbody({ children }) {
                    return <tbody className="divide-y divide-border/50">{children}</tbody>
                  },
                  tr({ children }) {
                    return <tr className="hover:bg-muted/20 transition-colors">{children}</tr>
                  },
                  th({ children }) {
                    return <th className="px-3.5 py-2.5 text-left font-semibold text-foreground text-[12px] uppercase tracking-wide">{children}</th>
                  },
                  td({ children }) {
                    return <td className="px-3.5 py-2.5 text-foreground/80">{children}</td>
                  },

                  // Links
                  a({ children, href }) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2 hover:text-primary/80 decoration-primary/40 transition-colors"
                      >
                        {children}
                      </a>
                    )
                  },
                }}
              >
                {clean}
              </ReactMarkdown>

              {/* Streaming cursor */}
              {message.pending && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-block w-[3px] h-[1.1em] ml-0.5 bg-primary/70 rounded-sm align-middle"
                />
              )}
            </div>
          )}

          {/* Artifact cards */}
          {!message.pending && artifacts.map((artifact, i) => (
            <ArtifactCard key={i} artifact={artifact} />
          ))}

          {/* Action bar */}
          {!message.pending && (clean || artifacts.length > 0) && (
            <div className="mt-3 space-y-2">
              <div className={cn(
                'flex items-center gap-0.5 transition-opacity duration-150',
                isLast ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100',
              )}>
                {/* Copy */}
                <ActionButton onClick={handleCopy} title="Copy response">
                  {copied
                    ? <><Check className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-500">Copied</span></>
                    : <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>
                  }
                </ActionButton>

                {/* Regenerate */}
                {isLast && onRegenerate && (
                  <ActionButton onClick={onRegenerate} title="Regenerate response">
                    <RefreshCw className="w-3.5 h-3.5" /><span>Retry</span>
                  </ActionButton>
                )}

                {/* Feedback */}
                {projectId && (
                  <div className="flex items-center gap-0.5 ml-auto">
                    <button
                      onClick={handleApprove}
                      title="Good response"
                      className={cn(
                        'p-1.5 rounded-lg text-xs transition-all',
                        feedback === 'approved'
                          ? 'text-emerald-500 bg-emerald-500/10'
                          : 'text-muted-foreground/60 hover:text-emerald-500 hover:bg-emerald-500/10',
                      )}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleReject}
                      title="Bad response"
                      className={cn(
                        'p-1.5 rounded-lg text-xs transition-all',
                        feedback === 'rejected'
                          ? 'text-red-500 bg-red-500/10'
                          : 'text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10',
                      )}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Reject reason input */}
              <AnimatePresence>
                {showRejectInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      autoFocus
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') submitReject()
                        if (e.key === 'Escape') { setShowRejectInput(false); setRejectReason('') }
                      }}
                      placeholder="What was wrong? (optional, press Enter)"
                      className="flex-1 text-xs bg-muted border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    />
                    <button
                      onClick={submitReject}
                      className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                    >
                      Send
                    </button>
                    <button
                      onClick={() => { setShowRejectInput(false); setRejectReason('') }}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small reusable action button
// ---------------------------------------------------------------------------

function ActionButton({ onClick, title, children }: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-all font-medium"
    >
      {children}
    </button>
  )
}
