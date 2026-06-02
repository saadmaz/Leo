'use client'

import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ChannelKey =
  | 'instagram'
  | 'linkedin'
  | 'twitter'
  | 'tiktok'
  | 'meta_ads'
  | 'google_ads'
  | 'email'

export interface Channel {
  key: ChannelKey
  label: string
  short: string
  /** @deprecated use short for display; retained for backward compat */
  icon?: string
}

export const CHANNELS: Channel[] = [
  { key: 'instagram',  label: 'Instagram',   short: 'IG',   icon: '📸' },
  { key: 'linkedin',   label: 'LinkedIn',    short: 'LI',   icon: '💼' },
  { key: 'twitter',    label: 'X / Twitter', short: 'X',    icon: '𝕏'  },
  { key: 'tiktok',     label: 'TikTok',      short: 'TT',   icon: '🎵' },
  { key: 'meta_ads',   label: 'Meta Ads',    short: 'Meta', icon: '📢' },
  { key: 'google_ads', label: 'Google Ads',  short: 'Ads',  icon: '🔍' },
  { key: 'email',      label: 'Email',       short: 'Mail', icon: '✉️'  },
]

interface ChannelSelectorProps {
  value: ChannelKey | null
  onChange: (channel: ChannelKey | null) => void
}

export function ChannelSelector({ value, onChange }: ChannelSelectorProps) {
  return (
    <div className="relative flex items-center gap-1 overflow-hidden">
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none pr-6">
        {/* General — icon only */}
        <button
          title="General"
          onClick={() => onChange(null)}
          className={cn(
            'shrink-0 flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
            value === null
              ? 'bg-primary/15 text-primary border border-primary/30'
              : 'bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent',
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>

        {CHANNELS.map((ch) => (
          <button
            key={ch.key}
            title={ch.label}
            onClick={() => onChange(value === ch.key ? null : ch.key)}
            className={cn(
              'shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
              value === ch.key
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent',
            )}
          >
            {ch.short}
          </button>
        ))}
      </div>

      {/* Fade indicator — more chips available */}
      <div className="absolute right-0 inset-y-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
    </div>
  )
}
