'use client'

import { Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OptimisticMessage } from '@/types'

interface MessageCardProps {
  message: OptimisticMessage
}

export function MessageCard({ message }: MessageCardProps) {
  const isAssistant = message.role === 'assistant'

  return (
    <div className={cn('w-full py-3 animate-in fade-in duration-300', isAssistant ? '' : '')}>
      <div className={cn('flex gap-4 max-w-3xl mx-auto px-4', !isAssistant && 'flex-row-reverse')}>
        {/* Avatar */}
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 text-xs',
            isAssistant ? 'bg-primary/5 text-primary' : 'bg-secondary text-muted-foreground',
          )}
        >
          {isAssistant ? <Sparkles className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
        </div>

        {/* Content */}
        <div className={cn('flex flex-col min-w-0 flex-1', !isAssistant && 'items-end')}>
          <div
            className={cn(
              'text-[15px] leading-relaxed whitespace-pre-wrap',
              isAssistant
                ? 'text-foreground'
                : 'bg-secondary/60 text-foreground px-4 py-2.5 rounded-2xl max-w-[85%] border border-border/20',
            )}
          >
            {message.content}
            {message.pending && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-foreground/60 rounded-sm animate-pulse align-middle" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
