'use client'

import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import type { BrandProfile } from '@/types'

interface BrandProfileCardProps {
  brandProfile: BrandProfile
  onContinue: () => void
  onEdit: (field: string, value: string) => void
  loading?: boolean
}

export function BrandProfileCard({ brandProfile, onContinue, loading }: BrandProfileCardProps) {
  const typeLabels: Record<string, string> = {
    educational: '📚 Educational',
    stats: '📊 Stats / Data',
    product: '🛍️ Product',
    story: '💬 Story',
    viral_hook: '🔥 Viral Hook',
    tips: '💡 Tips',
    social_proof: '🙌 Social Proof',
    lead_magnet: '🎯 Lead Magnet',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3 w-full max-w-sm"
    >
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
          Brand Profile
        </p>
        <p className="text-sm text-foreground font-medium">
          Here&apos;s what I found about your brand:
        </p>
      </div>

      {/* Colour swatches */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full border border-border shadow-sm"
          style={{ background: brandProfile.primary_color }}
          title="Primary colour"
        />
        <div
          className="w-6 h-6 rounded-full border border-border shadow-sm"
          style={{ background: brandProfile.secondary_color }}
          title="Secondary colour"
        />
        <div
          className="w-6 h-6 rounded-full border border-border shadow-sm"
          style={{ background: brandProfile.background_color }}
          title="Background colour"
        />
        <span className="text-xs text-muted-foreground ml-1">
          {brandProfile.primary_color} · {brandProfile.secondary_color}
        </span>
      </div>

      {/* Font names */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div><span className="font-medium text-foreground">Heading:</span> {brandProfile.heading_font}</div>
        <div><span className="font-medium text-foreground">Body:</span> {brandProfile.body_font}</div>
      </div>

      {/* Tone */}
      <div className="flex flex-wrap gap-1.5">
        {brandProfile.personality.map((trait) => (
          <span
            key={trait}
            className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium"
          >
            {trait}
          </span>
        ))}
      </div>

      {/* Instagram style */}
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Instagram style:</span>{' '}
        {brandProfile.instagram_aesthetic}
      </div>

      {/* Suggested type */}
      <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Suggested carousel type: </span>
        <span className="font-semibold text-primary">
          {typeLabels[brandProfile.suggested_carousel_type] ?? brandProfile.suggested_carousel_type}
        </span>
      </div>

      <button
        onClick={onContinue}
        disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading questions…</>
        ) : (
          'Looks right, continue →'
        )}
      </button>
    </motion.div>
  )
}
