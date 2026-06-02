'use client'

import { Zap, Search, Map } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandCore } from '@/types'

interface WelcomeMessageProps {
  brandName: string
  brandCore?: BrandCore | null
  onCapabilityClick: (prompt: string) => void
}

const CAPABILITIES = [
  {
    key: 'create',
    icon: Zap,
    label: 'Create',
    subtext: 'Content, captions, scripts, ad copy',
    prompt: (brand: string) =>
      `Help me create content for ${brand}. What format should we start with?`,
  },
  {
    key: 'research',
    icon: Search,
    label: 'Research',
    subtext: 'Competitors, keywords, market intelligence',
    prompt: (brand: string) =>
      `Research ${brand}&apos;s competitive landscape. Who are our main competitors and what are they doing?`,
  },
  {
    key: 'strategise',
    icon: Map,
    label: 'Strategise',
    subtext: 'Campaigns, GTM plans, brand positioning',
    prompt: (brand: string) =>
      `Help me build a marketing strategy for ${brand}. Let&apos;s start with our target audience.`,
  },
] as const

function getBrandSubtitle(brandCore: BrandCore | null | undefined): string | null {
  if (!brandCore) return null
  return brandCore.tagline ?? brandCore.messaging?.valueProp ?? null
}

export function WelcomeMessage({ brandName, brandCore, onCapabilityClick }: WelcomeMessageProps) {
  const subtitle = getBrandSubtitle(brandCore)

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-6">
      {/* Heading */}
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight">
          What are we building for {brandName}?
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {subtitle ?? (brandCore ? null : 'Start by telling me what you need today.')}
        </p>
      </div>

      {/* Capability cards */}
      <div className="grid grid-cols-3 gap-3 text-left">
        {CAPABILITIES.map(({ key, icon: Icon, label, subtext, prompt }) => (
          <button
            key={key}
            onClick={() => onCapabilityClick(prompt(brandName))}
            className={cn(
              'group bg-card/60 rounded-xl p-3 border border-border/50',
              'hover:bg-card hover:border-primary/30 hover:shadow-sm',
              'transition-all duration-150 text-left',
            )}
          >
            <Icon className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{subtext}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
