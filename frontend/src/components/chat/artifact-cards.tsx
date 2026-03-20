'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Instagram, Megaphone, FileText, Palette, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArtifactType = 'captions' | 'ad_copy' | 'campaign_brief' | 'colour_palette' | 'content_calendar'

export interface CaptionsArtifact {
  type: 'captions'
  platform: string
  captions: { text: string; hashtags: string[] }[]
}

export interface AdCopyArtifact {
  type: 'ad_copy'
  platform: string
  variants: { headline: string; body: string; cta: string }[]
}

export interface CampaignBriefArtifact {
  type: 'campaign_brief'
  name: string
  objective: string
  audience: string
  channels: string[]
  timeline: string
  kpis: string[]
  budget_guidance: string
  key_messages: string[]
}

export interface ColourPaletteArtifact {
  type: 'colour_palette'
  colours: { hex: string; name: string; usage: string }[]
}

export interface ContentCalendarEntry {
  day: string
  platform: string
  content: string
  time?: string
  hashtags?: string[]
}

export interface ContentCalendarArtifact {
  type: 'content_calendar'
  period: string
  entries: ContentCalendarEntry[]
}

export type Artifact =
  | CaptionsArtifact
  | AdCopyArtifact
  | CampaignBriefArtifact
  | ColourPaletteArtifact
  | ContentCalendarArtifact

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const ARTIFACT_RE = /<artifact\s+type="([^"]+)">([\s\S]*?)<\/artifact>/g

export function parseArtifacts(text: string): { clean: string; artifacts: Artifact[] } {
  const artifacts: Artifact[] = []
  const clean = text.replace(ARTIFACT_RE, (_, type, body) => {
    try {
      const data = JSON.parse(body.trim())
      artifacts.push({ type, ...data } as Artifact)
    } catch {
      // malformed artifact — drop silently
    }
    return '' // remove artifact block from visible text
  }).trim()

  return { clean, artifacts }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-3"
    >
      {artifact.type === 'captions' && <CaptionsCard artifact={artifact} />}
      {artifact.type === 'ad_copy' && <AdCopyCard artifact={artifact} />}
      {artifact.type === 'campaign_brief' && <CampaignBriefCard artifact={artifact} />}
      {artifact.type === 'colour_palette' && <ColourPaletteCard artifact={artifact} />}
      {artifact.type === 'content_calendar' && <ContentCalendarCard artifact={artifact} />}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Captions card
// ---------------------------------------------------------------------------

function CaptionsCard({ artifact }: { artifact: CaptionsArtifact }) {
  return (
    <Card icon={<Instagram className="w-3.5 h-3.5" />} title={`${artifact.platform} Captions`} count={artifact.captions.length}>
      <div className="space-y-3">
        {artifact.captions.map((cap, i) => (
          <div key={i} className="group relative rounded-lg border border-border bg-background p-3">
            <p className="text-sm leading-relaxed pr-8">{cap.text}</p>
            {cap.hashtags.length > 0 && (
              <p className="mt-1.5 text-xs text-primary/70">
                {cap.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
              </p>
            )}
            <CopyButton text={cap.text + (cap.hashtags.length ? '\n\n' + cap.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ') : '')} />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Ad copy card
// ---------------------------------------------------------------------------

function AdCopyCard({ artifact }: { artifact: AdCopyArtifact }) {
  return (
    <Card icon={<Megaphone className="w-3.5 h-3.5" />} title={`${artifact.platform} Ad Copy`} count={artifact.variants.length}>
      <div className="space-y-3">
        {artifact.variants.map((v, i) => (
          <div key={i} className="group relative rounded-lg border border-border bg-background p-3">
            <div className="pr-8 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Headline</p>
              <p className="text-sm font-medium">{v.headline}</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Body</p>
              <p className="text-sm leading-relaxed">{v.body}</p>
              {v.cta && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">CTA</p>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">{v.cta}</span>
                </>
              )}
            </div>
            <CopyButton text={`Headline: ${v.headline}\n\n${v.body}${v.cta ? `\n\nCTA: ${v.cta}` : ''}`} />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Campaign brief card
// ---------------------------------------------------------------------------

function CampaignBriefCard({ artifact }: { artifact: CampaignBriefArtifact }) {
  const copyText = [
    `Campaign: ${artifact.name}`,
    `Objective: ${artifact.objective}`,
    `Audience: ${artifact.audience}`,
    `Channels: ${artifact.channels.join(', ')}`,
    `Timeline: ${artifact.timeline}`,
    `KPIs: ${artifact.kpis.join(', ')}`,
    `Budget: ${artifact.budget_guidance}`,
    `Key messages:\n${artifact.key_messages.map((m) => `• ${m}`).join('\n')}`,
  ].join('\n\n')

  return (
    <Card icon={<FileText className="w-3.5 h-3.5" />} title={artifact.name || 'Campaign Brief'} copyText={copyText}>
      <div className="space-y-3">
        <BriefRow label="Objective" value={artifact.objective} />
        <BriefRow label="Audience" value={artifact.audience} />
        {artifact.channels?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Channels</p>
            <div className="flex flex-wrap gap-1.5">
              {artifact.channels.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-full bg-muted text-xs">{c}</span>
              ))}
            </div>
          </div>
        )}
        <BriefRow label="Timeline" value={artifact.timeline} />
        {artifact.kpis?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">KPIs</p>
            <ul className="space-y-0.5">
              {artifact.kpis.map((k) => (
                <li key={k} className="text-xs flex gap-1.5"><span className="text-primary">•</span>{k}</li>
              ))}
            </ul>
          </div>
        )}
        {artifact.budget_guidance && <BriefRow label="Budget" value={artifact.budget_guidance} />}
        {artifact.key_messages?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Key messages</p>
            <ul className="space-y-0.5">
              {artifact.key_messages.map((m) => (
                <li key={m} className="text-xs flex gap-1.5"><span className="text-primary">•</span>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}

function BriefRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colour palette card
// ---------------------------------------------------------------------------

function ColourPaletteCard({ artifact }: { artifact: ColourPaletteArtifact }) {
  return (
    <Card icon={<Palette className="w-3.5 h-3.5" />} title="Colour Palette" count={artifact.colours.length}>
      <div className="flex flex-wrap gap-3">
        {artifact.colours.map((c) => (
          <SwatchItem key={c.hex} colour={c} />
        ))}
      </div>
    </Card>
  )
}

function SwatchItem({ colour }: { colour: { hex: string; name: string; usage: string } }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(colour.hex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button onClick={copy} title={`Copy ${colour.hex}`} className="flex flex-col items-center gap-1.5 group">
      <div
        className="w-14 h-14 rounded-xl border border-border shadow-sm group-hover:scale-105 transition-transform"
        style={{ backgroundColor: colour.hex }}
      />
      <p className="text-[11px] font-mono text-muted-foreground">{copied ? '✓ Copied' : colour.hex}</p>
      {colour.name && <p className="text-[11px] text-muted-foreground font-medium">{colour.name}</p>}
      {colour.usage && <p className="text-[10px] text-muted-foreground/60">{colour.usage}</p>}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Content calendar card
// ---------------------------------------------------------------------------

const PLATFORM_ICONS: Record<string, string> = {
  Instagram: '📸', LinkedIn: '💼', X: '𝕏', Twitter: '𝕏',
  TikTok: '🎵', Facebook: '📘', Email: '✉️', YouTube: '▶️',
}

function ContentCalendarCard({ artifact }: { artifact: ContentCalendarArtifact }) {
  const copyText = artifact.entries
    .map((e) => `${e.day} — ${e.platform}${e.time ? ` (${e.time})` : ''}\n${e.content}${e.hashtags?.length ? '\n' + e.hashtags.map((h) => `#${h}`).join(' ') : ''}`)
    .join('\n\n')

  return (
    <Card icon={<CalendarDays className="w-3.5 h-3.5" />} title={artifact.period || 'Content Calendar'} copyText={copyText}>
      <div className="space-y-2">
        {artifact.entries.map((entry, i) => (
          <div key={i} className="group relative rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2 mb-1.5 pr-8">
              <span className="text-sm">{PLATFORM_ICONS[entry.platform] ?? '📄'}</span>
              <span className="text-xs font-semibold">{entry.day}</span>
              <span className="text-xs text-muted-foreground">{entry.platform}</span>
              {entry.time && <span className="ml-auto text-xs text-muted-foreground">{entry.time}</span>}
            </div>
            <p className="text-sm leading-relaxed">{entry.content}</p>
            {entry.hashtags && entry.hashtags.length > 0 && (
              <p className="mt-1 text-xs text-primary/70">
                {entry.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
              </p>
            )}
            <CopyButton text={entry.content + (entry.hashtags?.length ? '\n\n' + entry.hashtags.map((h) => `#${h}`).join(' ') : '')} />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Shared card shell
// ---------------------------------------------------------------------------

function Card({
  icon, title, count, copyText, children,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  copyText?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs font-semibold">{title}</span>
          {count !== undefined && (
            <span className="text-xs text-muted-foreground">({count})</span>
          )}
        </div>
        {copyText && <CopyButton text={copyText} inline />}
      </div>

      <div className="p-4">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text, inline = false }: { text: string; inline?: boolean }) {
  const [copied, setCopied] = useState(false)

  function copy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (inline) {
    return (
      <button
        onClick={copy}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        <span>{copied ? 'Copied' : 'Copy all'}</span>
      </button>
    )
  }

  return (
    <button
      onClick={copy}
      className={cn(
        'absolute top-2.5 right-2.5 p-1.5 rounded-md transition-all',
        'opacity-0 group-hover:opacity-100',
        'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground',
      )}
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}
