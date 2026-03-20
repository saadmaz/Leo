'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { ArrowUp, Loader2, Square, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChannelSelector, type ChannelKey } from './channel-selector'
import { TemplateBar } from './template-bar'

interface PromptComposerProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (value: string) => void
  disabled?: boolean
  onStop?: () => void
  activeChannel: ChannelKey | null
  onChannelChange: (channel: ChannelKey | null) => void
  brandName?: string
}

export function PromptComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  onStop,
  activeChannel,
  onChannelChange,
  brandName,
}: PromptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showChannels, setShowChannels] = useState(false)

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

  function handleTemplateSelect(prompt: string) {
    onChange(prompt)
    textareaRef.current?.focus()
  }

  const isStreaming = disabled
  const canStop = isStreaming && !!onStop
  const canSend = !isStreaming && !!value.trim()
  const channelLabel = activeChannel
    ? activeChannel.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null

  return (
    <div className="border-t border-border bg-background px-4 py-3 space-y-2">
      <div className="mx-auto max-w-3xl space-y-2">
        {/* Template bar — always visible */}
        <TemplateBar
          channel={activeChannel}
          brandName={brandName}
          onSelect={handleTemplateSelect}
        />

        {/* Channel selector — collapsible */}
        {showChannels && (
          <ChannelSelector value={activeChannel} onChange={(ch) => { onChannelChange(ch); setShowChannels(false) }} />
        )}

        {/* Composer input */}
        <div className="relative rounded-xl border border-border/60 bg-card shadow-sm focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-all">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message LEO…"
            rows={1}
            disabled={false}
            className="w-full resize-none bg-transparent px-4 py-3 pr-24 text-sm focus:outline-none placeholder:text-muted-foreground/50 leading-relaxed"
          />

          {/* Channel pill inside composer */}
          <button
            onClick={() => setShowChannels((v) => !v)}
            className={cn(
              'absolute left-3 bottom-2.5 flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
              activeChannel
                ? 'bg-primary/10 text-primary font-medium'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {channelLabel ?? 'Channel'}
            <ChevronDown className="w-2.5 h-2.5" />
          </button>

          {canStop ? (
            <button
              onClick={onStop}
              title="Stop generating"
              className="absolute right-2.5 bottom-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : isStreaming ? (
            <div className="absolute right-2.5 bottom-2.5 flex h-7 w-7 items-center justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/40" />
            </div>
          ) : (
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

        <p className="text-center text-[11px] text-muted-foreground/40">
          LEO can make mistakes. Always verify important brand decisions.
        </p>
      </div>
    </div>
  )
}
