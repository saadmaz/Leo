'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Palette, Type, Hash, Users, Target, Zap, ChevronDown, ChevronUp, Edit2, Check
} from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/lib/api'
import type { BrandCore, BrandTone, BrandVisual } from '@/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Panel shell
// ---------------------------------------------------------------------------

export function BrandCorePanel() {
  const { brandCorePanelOpen, setBrandCorePanelOpen, activeProject, upsertProject } = useAppStore()

  if (!activeProject) return null

  const bc = activeProject.brandCore

  async function handleFieldSave(updates: Partial<BrandCore>) {
    if (!activeProject) return
    try {
      const res = await api.brandCore.update(activeProject.id, updates)
      upsertProject({ ...activeProject, brandCore: res.brandCore })
    } catch (err) {
      console.error('Brand Core save failed:', err)
    }
  }

  return (
    <AnimatePresence>
      {brandCorePanelOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setBrandCorePanelOpen(false)}
          />

          {/* Slide-in panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="font-semibold text-sm">Brand Core</h2>
                <p className="text-xs text-muted-foreground">{activeProject.name}</p>
              </div>
              <button
                onClick={() => setBrandCorePanelOpen(false)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!bc ? (
                <EmptyState />
              ) : (
                <>
                  {bc.tagline && (
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Tagline</p>
                      <p className="text-sm font-medium italic">"{bc.tagline}"</p>
                    </div>
                  )}

                  {bc.tone && <ToneSection tone={bc.tone} onSave={(v) => handleFieldSave({ tone: v })} />}
                  {bc.visual && <VisualSection visual={bc.visual} onSave={(v) => handleFieldSave({ visual: v })} />}
                  {bc.themes && bc.themes.length > 0 && (
                    <TagsSection
                      icon={<Hash className="w-3.5 h-3.5" />}
                      title="Content Themes"
                      tags={bc.themes}
                    />
                  )}
                  {bc.messaging && (
                    <MessagingSection
                      valueProp={bc.messaging.valueProp}
                      keyClaims={bc.messaging.keyClaims}
                    />
                  )}
                  {bc.audience && (
                    <AudienceSection
                      demographics={bc.audience.demographics}
                      interests={bc.audience.interests}
                    />
                  )}
                  {bc.competitors && bc.competitors.length > 0 && (
                    <TagsSection
                      icon={<Target className="w-3.5 h-3.5" />}
                      title="Competitors"
                      tags={bc.competitors}
                    />
                  )}
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  const { setIngestionOpen } = useAppStore()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
      <Zap className="w-8 h-8 text-muted-foreground/40" />
      <p className="text-sm font-medium">No Brand Core yet</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Paste your website URL or Instagram handle — LEO will build your Brand Core automatically.
      </p>
      <button
        onClick={() => setIngestionOpen(true)}
        className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
      >
        Build Brand Core
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tone section
// ---------------------------------------------------------------------------

function ToneSection({ tone, onSave }: { tone: BrandTone; onSave: (v: BrandTone) => void }) {
  return (
    <Section icon={<Type className="w-3.5 h-3.5" />} title="Tone & Voice">
      <div className="space-y-2.5">
        {tone.style && <Row label="Style" value={tone.style} />}
        {tone.formality && <Row label="Formality" value={tone.formality} />}
        {tone.keyPhrases && tone.keyPhrases.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Key phrases</p>
            <div className="flex flex-wrap gap-1.5">
              {tone.keyPhrases.map((p) => (
                <span key={p} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{p}</span>
              ))}
            </div>
          </div>
        )}
        {tone.avoidedLanguage && tone.avoidedLanguage.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Avoided language</p>
            <div className="flex flex-wrap gap-1.5">
              {tone.avoidedLanguage.map((p) => (
                <span key={p} className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs">{p}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Visual identity section
// ---------------------------------------------------------------------------

function VisualSection({ visual, onSave }: { visual: BrandVisual; onSave: (v: BrandVisual) => void }) {
  return (
    <Section icon={<Palette className="w-3.5 h-3.5" />} title="Visual Identity">
      <div className="space-y-2.5">
        {/* Colour palette */}
        {(visual.primaryColour || (visual.secondaryColours?.length ?? 0) > 0) && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Colour palette</p>
            <div className="flex flex-wrap gap-2">
              {visual.primaryColour && (
                <ColourSwatch hex={visual.primaryColour} label="Primary" />
              )}
              {visual.secondaryColours?.map((hex) => (
                <ColourSwatch key={hex} hex={hex} />
              ))}
            </div>
          </div>
        )}

        {visual.fonts && visual.fonts.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Fonts</p>
            <div className="flex flex-wrap gap-1.5">
              {visual.fonts.map((f) => (
                <span key={f} className="px-2 py-0.5 rounded-full border border-border text-xs">{f}</span>
              ))}
            </div>
          </div>
        )}

        {visual.imageStyle && <Row label="Image style" value={visual.imageStyle} />}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Messaging section
// ---------------------------------------------------------------------------

function MessagingSection({ valueProp, keyClaims }: { valueProp?: string; keyClaims?: string[] }) {
  return (
    <Section icon={<Zap className="w-3.5 h-3.5" />} title="Messaging">
      <div className="space-y-2.5">
        {valueProp && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Value proposition</p>
            <p className="text-sm">{valueProp}</p>
          </div>
        )}
        {keyClaims && keyClaims.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Key claims</p>
            <ul className="space-y-1">
              {keyClaims.map((c) => (
                <li key={c} className="text-xs flex gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Audience section
// ---------------------------------------------------------------------------

function AudienceSection({ demographics, interests }: { demographics?: string; interests?: string[] }) {
  return (
    <Section icon={<Users className="w-3.5 h-3.5" />} title="Audience">
      <div className="space-y-2.5">
        {demographics && <Row label="Demographics" value={demographics} />}
        {interests && interests.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Interests</p>
            <div className="flex flex-wrap gap-1.5">
              {interests.map((i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-muted text-xs">{i}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Reusable building blocks
// ---------------------------------------------------------------------------

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-xs">{value}</span>
    </div>
  )
}

function TagsSection({ icon, title, tags }: { icon: React.ReactNode; title: string; tags: string[] }) {
  return (
    <Section icon={icon} title={title}>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="px-2 py-0.5 rounded-full bg-muted text-xs">{t}</span>
        ))}
      </div>
    </Section>
  )
}

function ColourSwatch({ hex, label }: { hex: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(hex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={copy}
      title={`Copy ${hex}`}
      className="flex flex-col items-center gap-1 group"
    >
      <div
        className="w-10 h-10 rounded-lg border border-border shadow-sm group-hover:scale-105 transition-transform"
        style={{ backgroundColor: hex }}
      />
      <span className="text-[10px] text-muted-foreground font-mono">
        {copied ? '✓' : hex}
      </span>
      {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
    </button>
  )
}
