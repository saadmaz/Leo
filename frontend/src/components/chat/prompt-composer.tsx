'use client'

import { useRef, useEffect, useCallback } from 'react'
import { ArrowUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromptComposerProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (value: string) => void
  disabled?: boolean
}

export function PromptComposer({ value, onChange, onSubmit, disabled }: PromptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
            disabled={disabled}
            className="w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm focus:outline-none placeholder:text-muted-foreground/50 leading-relaxed"
          />
          <button
            onClick={() => onSubmit(value)}
            disabled={!value.trim() || disabled}
            className={cn(
              'absolute right-2.5 bottom-2.5 flex h-7 w-7 items-center justify-center rounded-lg transition-all',
              value.trim() && !disabled
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground/40 cursor-not-allowed',
            )}
          >
            {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/40">
          LEO can make mistakes. Always verify important brand decisions.
        </p>
      </div>
    </div>
  )
}
