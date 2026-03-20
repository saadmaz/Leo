'use client'

import type { ChannelKey } from './channel-selector'

// ---------------------------------------------------------------------------
// Template definitions per channel
// ---------------------------------------------------------------------------

const TEMPLATES: Record<string, string[]> = {
  // General (no channel selected)
  general: [
    'Write 5 Instagram captions',
    'Generate a campaign brief',
    'Write Meta ad copy (3 variants)',
    'What content themes should we focus on?',
    'Create a 1-month content calendar',
    'Analyse our brand positioning',
  ],
  instagram: [
    'Write 5 feed captions',
    'Write a Reels script',
    'Generate 10 hashtags',
    'Write a carousel post (5 slides)',
    'Suggest 5 content ideas for this week',
    'Write a Story sequence (5 frames)',
  ],
  linkedin: [
    'Write a thought leadership post',
    'Repurpose a blog post into a LinkedIn post',
    'Write a company update post',
    'Generate 5 post ideas for this month',
    'Write a product launch announcement',
    'Create a carousel post outline (10 slides)',
  ],
  twitter: [
    'Write a 7-tweet thread',
    'Generate 5 punchy tweets',
    'Write a product announcement tweet',
    'Create a poll tweet',
    'Write a thread on our brand story',
    'Generate 5 engagement-bait questions',
  ],
  tiktok: [
    'Write a TikTok script (30 s)',
    'Suggest 5 trending video concepts',
    'Write a product demo script',
    'Write a "Did you know?" video script',
    'Generate 5 TikTok video hooks',
    'Write a before/after transformation script',
  ],
  meta_ads: [
    'Write 3 ad variants (A/B/C)',
    'Write a retargeting ad',
    'Write a carousel ad (5 cards)',
    'Write a lead generation ad',
    'Generate 5 headline options',
    'Write a brand awareness ad',
  ],
  google_ads: [
    'Write a Responsive Search Ad (15 headlines)',
    'Generate 5 ad headlines',
    'Write 4 ad descriptions',
    'Write a competitor comparison ad',
    'Generate keyword ideas for this campaign',
    'Write a Performance Max asset group',
  ],
  email: [
    'Write a promotional email',
    'Write a welcome email',
    'Write a product launch email',
    'Write an abandoned cart email',
    'Generate 5 subject line options',
    'Write a re-engagement email',
  ],
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TemplateBarProps {
  channel: ChannelKey | null
  brandName?: string
  onSelect: (prompt: string) => void
}

export function TemplateBar({ channel, brandName, onSelect }: TemplateBarProps) {
  const key = channel ?? 'general'
  const templates = TEMPLATES[key] ?? TEMPLATES.general

  // Personalise with brand name when available
  function personalise(t: string) {
    return brandName ? t : t
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {templates.map((t) => (
        <button
          key={t}
          onClick={() => onSelect(personalise(t))}
          className="shrink-0 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
        >
          {t}
        </button>
      ))}
    </div>
  )
}
