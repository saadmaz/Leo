'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { ArrowUp, Loader2, Square, ChevronDown, Paperclip, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChannelSelector, type ChannelKey } from './channel-selector'
import { TemplateBar } from './template-bar'
import type { ImageAttachment } from '@/types'

interface PromptComposerProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (value: string, attachments: ImageAttachment[]) => void
  disabled?: boolean
  onStop?: () => void
  activeChannel: ChannelKey | null
  onChannelChange: (channel: ChannelKey | null) => void
  brandName?: string
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE_MB = 5

/** Convert a File to a base64 string (no data-URL prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the "data:image/...;base64," prefix
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showChannels, setShowChannels] = useState(false)
  const [attachments, setAttachments] = useState<ImageAttachment[]>([])
  const [attachError, setAttachError] = useState<string | null>(null)

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
      if ((value.trim() || attachments.length > 0) && !disabled) {
        handleSend()
      }
    }
  }

  function handleTemplateSelect(prompt: string) {
    onChange(prompt)
    textareaRef.current?.focus()
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setAttachError(null)

    const newAttachments: ImageAttachment[] = []
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setAttachError(`${file.name}: unsupported type. Use JPEG, PNG, GIF, or WebP.`)
        continue
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setAttachError(`${file.name}: exceeds ${MAX_SIZE_MB} MB limit.`)
        continue
      }
      const base64 = await fileToBase64(file)
      newAttachments.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        name: file.name,
        base64,
        mediaType: file.type,
        previewUrl: URL.createObjectURL(file),
      })
    }

    setAttachments((prev) => [...prev, ...newAttachments])
    // Reset input so the same file can be re-attached if removed
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((a) => a.id !== id)
    })
  }

  function handleSend() {
    onSubmit(value, attachments)
    setAttachments([])
    setAttachError(null)
  }

  const isStreaming = disabled
  const canStop = isStreaming && !!onStop
  const canSend = !isStreaming && (!!value.trim() || attachments.length > 0)
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

        {/* Image attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {attachments.map((att) => (
              <div key={att.id} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={att.previewUrl}
                  alt={att.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Attachment error */}
        {attachError && (
          <p className="text-xs text-destructive px-1">{attachError}</p>
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

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {/* Paperclip button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            title="Attach image"
            className={cn(
              'absolute right-10 bottom-2.5 flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
              isStreaming
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            <Paperclip className="h-3.5 w-3.5" />
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
              onClick={() => { if (canSend) handleSend() }}
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
