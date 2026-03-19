'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OptimisticMessage } from '@/types'
import { ArtifactCard, parseArtifacts } from './artifact-cards'

interface MessageCardProps {
  message: OptimisticMessage
}

export function MessageCard({ message }: MessageCardProps) {
  const isAssistant = message.role === 'assistant'

  // For assistant messages: strip artifact blocks from text, collect cards
  const { clean, artifacts } = isAssistant
    ? parseArtifacts(message.content)
    : { clean: message.content, artifacts: [] }

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
          {isAssistant ? <Sparkles className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
        </div>

        {/* Content */}
        <div className={cn('flex flex-col min-w-0 flex-1', !isAssistant && 'items-end')}>
          {isAssistant ? (
            /* --- Assistant: markdown + artifacts --- */
            <div className="w-full">
              {(clean || message.pending) && (
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Inline code
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
                      // Paragraphs
                      p({ children }) {
                        return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
                      },
                      // Lists
                      ul({ children }) {
                        return <ul className="mb-3 space-y-1 list-disc list-inside">{children}</ul>
                      },
                      ol({ children }) {
                        return <ol className="mb-3 space-y-1 list-decimal list-inside">{children}</ol>
                      },
                      li({ children }) {
                        return <li className="text-sm">{children}</li>
                      },
                      // Headings
                      h1({ children }) {
                        return <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h1>
                      },
                      h2({ children }) {
                        return <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>
                      },
                      h3({ children }) {
                        return <h3 className="text-sm font-semibold mb-1.5 mt-3 first:mt-0">{children}</h3>
                      },
                      // Blockquote
                      blockquote({ children }) {
                        return (
                          <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">
                            {children}
                          </blockquote>
                        )
                      },
                      // Strong / em
                      strong({ children }) {
                        return <strong className="font-semibold text-foreground">{children}</strong>
                      },
                      // Horizontal rule
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
