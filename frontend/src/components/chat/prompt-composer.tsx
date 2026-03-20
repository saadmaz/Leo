'use client'

import { useRef, useEffect, useCallback } from 'react'
import { ArrowUp, Loader2, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromptComposerProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (value: string) => void
  /** True while the assistant is streaming a response. */
  disabled?: boolean
  /**
   * Called when the user clicks the Stop button during a stream.
   * If provided, the button is shown (as a square icon) while disabled=true.
   * If omitted, the composer shows a spinner and no stop affordance.
   */
  onStop?: () => void
}

export function PromptComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  onStop,
}: PromptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /** Grow the textarea up to 200px then scroll internally. */
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  useEffect(() => { adjustHeight() }, [value, adjustHeight])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled) onSubmit(value)
    }
  }

  // Determine the action button state:
  //  - streaming + onStop available → red Stop button
  //  - streaming + no onStop        → grey spinner (no action)
  //  - idle + text present          → blue Send button
  //  - idle + empty                 → disabled Send button
  const isStreaming = disabled
  const canStop = isStreaming && !!onStop
  const canSend = !isStreaming && !!value.trim()

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div className="relative rounded-xl border border-border/60 bg-card shadow-sm focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-all">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message LEO…"
            rows={1}
            // Keep the textarea interactive during streaming so the user can
            // type their next message while waiting for the response to finish.
            disabled={false}
            className="w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm focus:outline-none placeholder:text-muted-foreground/50 leading-relaxed"
          />

          {canStop ? (
            // Stop button — shown during streaming when a cancellation handler is provided.
            <button
              onClick={onStop}
              title="Stop generating"
              className="absolute right-2.5 bottom-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : isStreaming ? (
            // Spinner — shown during streaming when no stop handler is provided.
            <div className="absolute right-2.5 bottom-2.5 flex h-7 w-7 items-center justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/40" />
            </div>
          ) : (
            // Send button — normal idle state.
            <button
              onClick={() => { if (canSend) onSubmit(value) }}
              disabled={!canSend}
              title="Send message"
              className={cn(
                'absolute right-2.5 bottom-2.5 flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                canSend
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground/40 cursor-not-allowed',
              )}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] text-muted-foreground/40">
          LEO can make mistakes. Always verify important brand decisions.
        </p>
      </div>
    </div>
  )
}
