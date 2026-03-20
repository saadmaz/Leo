'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Palette, Type, Hash, Users, Target, Zap,
  ChevronDown, ChevronUp, Edit2, Check, Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/lib/api'
import type { BrandCore, BrandTone, BrandVisual } from '@/types'

export function BrandCorePanel() {
  const { brandCorePanelOpen, setBrandCorePanelOpen, activeProject, upsertProject } = useAppStore()
  if (!activeProject) return null
  const bc = activeProject.brandCore

  async function handleSave(updates: Partial<BrandCore>) {
    if (!activeProject) return
    try {
      const res = await api.brandCore.update(activeProject.id, updates)
      upsertProject({ ...activeProject, brandCore: res.brandCore })
      toast.success('Brand Core updated')
    } catch (err) {
      console.error('Brand Core save failed:', err)
      toast.error('Failed to save — please try again')
    }
  }

  return (
    <AnimatePresence>
      {brandCorePanelOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40" onClick={() => setBrandCorePanelOpen(false)} />
          <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="font-semibold text-sm">Brand Core</h2>
                <p className="text-xs text-muted-foreground">{activeProject.name}</p>
              </div>
              <button onClick={() => setBrandCorePanelOpen(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!bc ? <EmptyState /> : (
                <>
                  <TaglineSection value={bc.tagline} onSave={(v) => handleSave({ tagline: v })} />
                  <ToneSection tone={bc.tone ?? {}} onSave={(v) => handleSave({ tone: v })} />
                  <VisualSection visual={bc.visual ?? {}} onSave={(v) => handleSave({ visual: v })} />
                  <EditableTagsSection icon={<Hash className="w-3.5 h-3.5" />} title="Content Themes" tags={bc.themes ?? []} onSave={(t) => handleSave({ themes: t })} />
                  <MessagingSection valueProp={bc.messaging?.valueProp} keyClaims={bc.messaging?.keyClaims ?? []} onSave={(v) => handleSave({ messaging: v })} />
                  <AudienceSection demographics={bc.audience?.demographics} interests={bc.audience?.interests ?? []} onSave={(v) => handleSave({ audience: v })} />
                  <EditableTagsSection icon={<Target className="w-3.5 h-3.5" />} title="Competitors" tags={bc.competitors ?? []} onSave={(t) => handleSave({ competitors: t })} />
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function EmptyState() {
  const { setIngestionOpen } = useAppStore()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
      <Zap className="w-8 h-8 text-muted-foreground/40" />
      <p className="text-sm font-medium">No Brand Core yet</p>
      <p className="text-xs text-muted-foreground max-w-xs">Paste your website URL or Instagram handle — LEO will build your Brand Core automatically.</p>
      <button onClick={() => setIngestionOpen(true)} className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">Build Brand Core</button>
    </div>
  )
}

function Section({ icon, title, children, editSlot }: { icon: React.ReactNode; title: string; children: React.ReactNode; editSlot?: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center px-4 py-3">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 flex-1 text-left">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
        </button>
        {editSlot}
        <button onClick={() => setOpen((v) => !v)} className="ml-2 text-muted-foreground">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
}
function SaveBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="p-1 rounded-md hover:bg-muted text-primary"><Check className="w-3.5 h-3.5" /></button>
}
function CancelBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="p-1 rounded-md hover:bg-muted text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
}

function TaglineSection({ value, onSave }: { value?: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  function save() { onSave(draft); setEditing(false) }
  return (
    <Section icon={<Zap className="w-3.5 h-3.5" />} title="Tagline"
      editSlot={editing ? <SaveBtn onClick={save} /> : <EditBtn onClick={() => { setDraft(value ?? ''); setEditing(true) }} />}>
      {editing
        ? <input autoFocus className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm italic focus:outline-none focus:ring-1 focus:ring-ring"
            value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} />
        : <p className="text-sm italic text-muted-foreground">&quot;{value || 'No tagline set'}&quot;</p>}
    </Section>
  )
}

function ToneSection({ tone, onSave }: { tone: BrandTone; onSave: (v: BrandTone) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<BrandTone>(tone)
  function save() { onSave(draft); setEditing(false) }
  function cancel() { setDraft(tone); setEditing(false) }
  return (
    <Section icon={<Type className="w-3.5 h-3.5" />} title="Tone & Voice"
      editSlot={editing ? <><SaveBtn onClick={save} /><CancelBtn onClick={cancel} /></> : <EditBtn onClick={() => { setDraft(tone); setEditing(true) }} />}>
      {editing ? (
        <div className="space-y-3">
          <Field label="Style" value={draft.style ?? ''} onChange={(v) => setDraft({ ...draft, style: v })} />
          <Field label="Formality" value={draft.formality ?? ''} onChange={(v) => setDraft({ ...draft, formality: v })} />
          <TagEditor label="Key phrases" tags={draft.keyPhrases ?? []} onChange={(t) => setDraft({ ...draft, keyPhrases: t })} />
          <TagEditor label="Avoided language" tags={draft.avoidedLanguage ?? []} onChange={(t) => setDraft({ ...draft, avoidedLanguage: t })} variant="destructive" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {tone.style && <Row label="Style" value={tone.style} />}
          {tone.formality && <Row label="Formality" value={tone.formality} />}
          {(tone.keyPhrases?.length ?? 0) > 0 && <TagList label="Key phrases" tags={tone.keyPhrases!} variant="primary" />}
          {(tone.avoidedLanguage?.length ?? 0) > 0 && <TagList label="Avoided language" tags={tone.avoidedLanguage!} variant="destructive" />}
        </div>
      )}
    </Section>
  )
}

function VisualSection({ visual, onSave }: { visual: BrandVisual; onSave: (v: BrandVisual) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<BrandVisual>(visual)
  function save() { onSave(draft); setEditing(false) }
  function cancel() { setDraft(visual); setEditing(false) }
  return (
    <Section icon={<Palette className="w-3.5 h-3.5" />} title="Visual Identity"
      editSlot={editing ? <><SaveBtn onClick={save} /><CancelBtn onClick={cancel} /></> : <EditBtn onClick={() => { setDraft(visual); setEditing(true) }} />}>
      {editing ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28 shrink-0">Primary colour</label>
            <div className="flex items-center gap-2">
              <input type="color" value={draft.primaryColour ?? '#000000'} onChange={(e) => setDraft({ ...draft, primaryColour: e.target.value })} className="h-7 w-10 cursor-pointer rounded border border-border" />
              <input className="w-24 rounded border border-input bg-background px-2 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring" value={draft.primaryColour ?? ''} onChange={(e) => setDraft({ ...draft, primaryColour: e.target.value })} placeholder="#000000" />
            </div>
          </div>
          <TagEditor label="Secondary colours" tags={draft.secondaryColours ?? []} onChange={(t) => setDraft({ ...draft, secondaryColours: t })} placeholder="#RRGGBB" />
          <TagEditor label="Fonts" tags={draft.fonts ?? []} onChange={(t) => setDraft({ ...draft, fonts: t })} placeholder="Font name" />
          <Field label="Image style" value={draft.imageStyle ?? ''} onChange={(v) => setDraft({ ...draft, imageStyle: v })} />
        </div>
      ) : (
        <div className="space-y-2.5">
          {(visual.primaryColour || (visual.secondaryColours?.length ?? 0) > 0) && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Colour palette</p>
              <div className="flex flex-wrap gap-2">
                {visual.primaryColour && <ColourSwatch hex={visual.primaryColour} label="Primary" />}
                {visual.secondaryColours?.map((hex) => <ColourSwatch key={hex} hex={hex} />)}
              </div>
            </div>
          )}
          {(visual.fonts?.length ?? 0) > 0 && <TagList label="Fonts" tags={visual.fonts!} />}
          {visual.imageStyle && <Row label="Image style" value={visual.imageStyle} />}
        </div>
      )}
    </Section>
  )
}

function MessagingSection({ valueProp, keyClaims, onSave }: { valueProp?: string; keyClaims: string[]; onSave: (v: { valueProp?: string; keyClaims?: string[] }) => void }) {
  const [editing, setEditing] = useState(false)
  const [draftVP, setDraftVP] = useState(valueProp ?? '')
  const [draftClaims, setDraftClaims] = useState<string[]>(keyClaims)
  function save() { onSave({ valueProp: draftVP, keyClaims: draftClaims }); setEditing(false) }
  function cancel() { setDraftVP(valueProp ?? ''); setDraftClaims(keyClaims); setEditing(false) }
  return (
    <Section icon={<Zap className="w-3.5 h-3.5" />} title="Messaging"
      editSlot={editing ? <><SaveBtn onClick={save} /><CancelBtn onClick={cancel} /></> : <EditBtn onClick={() => { setDraftVP(valueProp ?? ''); setDraftClaims(keyClaims); setEditing(true) }} />}>
      {editing ? (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Value proposition</p>
            <textarea autoFocus rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" value={draftVP} onChange={(e) => setDraftVP(e.target.value)} />
          </div>
          <TagEditor label="Key claims" tags={draftClaims} onChange={setDraftClaims} placeholder="Add claim…" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {valueProp && <div><p className="text-xs text-muted-foreground mb-1">Value proposition</p><p className="text-sm">{valueProp}</p></div>}
          {keyClaims.length > 0 && <div><p className="text-xs text-muted-foreground mb-1.5">Key claims</p><ul className="space-y-1">{keyClaims.map((c) => <li key={c} className="text-xs flex gap-2"><span className="text-primary mt-0.5">•</span><span>{c}</span></li>)}</ul></div>}
        </div>
      )}
    </Section>
  )
}

function AudienceSection({ demographics, interests, onSave }: { demographics?: string; interests: string[]; onSave: (v: { demographics?: string; interests?: string[] }) => void }) {
  const [editing, setEditing] = useState(false)
  const [draftDemo, setDraftDemo] = useState(demographics ?? '')
  const [draftInterests, setDraftInterests] = useState<string[]>(interests)
  function save() { onSave({ demographics: draftDemo, interests: draftInterests }); setEditing(false) }
  function cancel() { setDraftDemo(demographics ?? ''); setDraftInterests(interests); setEditing(false) }
  return (
    <Section icon={<Users className="w-3.5 h-3.5" />} title="Audience"
      editSlot={editing ? <><SaveBtn onClick={save} /><CancelBtn onClick={cancel} /></> : <EditBtn onClick={() => { setDraftDemo(demographics ?? ''); setDraftInterests(interests); setEditing(true) }} />}>
      {editing ? (
        <div className="space-y-3">
          <Field label="Demographics" value={draftDemo} onChange={setDraftDemo} />
          <TagEditor label="Interests" tags={draftInterests} onChange={setDraftInterests} placeholder="Add interest…" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {demographics && <Row label="Demographics" value={demographics} />}
          {interests.length > 0 && <TagList label="Interests" tags={interests} />}
        </div>
      )}
    </Section>
  )
}

function EditableTagsSection({ icon, title, tags, onSave }: { icon: React.ReactNode; title: string; tags: string[]; onSave: (tags: string[]) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>(tags)
  function save() { onSave(draft); setEditing(false) }
  function cancel() { setDraft(tags); setEditing(false) }
  return (
    <Section icon={icon} title={title}
      editSlot={editing ? <><SaveBtn onClick={save} /><CancelBtn onClick={cancel} /></> : <EditBtn onClick={() => { setDraft(tags); setEditing(true) }} />}>
      {editing
        ? <TagEditor tags={draft} onChange={setDraft} />
        : <div className="flex flex-wrap gap-1.5">{tags.length > 0 ? tags.map((t) => <Tag key={t} label={t} />) : <p className="text-xs text-muted-foreground">None set</p>}</div>}
    </Section>
  )
}

function TagEditor({ label, tags, onChange, placeholder = 'Add…', variant }: { label?: string; tags: string[]; onChange: (tags: string[]) => void; placeholder?: string; variant?: 'primary' | 'destructive' }) {
  const [input, setInput] = useState('')
  function add() { const v = input.trim(); if (v && !tags.includes(v)) onChange([...tags, v]); setInput('') }
  return (
    <div>
      {label && <p className="text-xs text-muted-foreground mb-1.5">{label}</p>}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t) => (
          <span key={t} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${variant === 'destructive' ? 'bg-destructive/10 text-destructive' : variant === 'primary' ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground'}`}>
            {t}<button onClick={() => onChange(tags.filter((x) => x !== t))} className="ml-0.5 hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input className="flex-1 rounded-lg border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder={placeholder} />
        <button onClick={add} disabled={!input.trim()} className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

function TagList({ label, tags, variant }: { label?: string; tags: string[]; variant?: 'primary' | 'destructive' }) {
  return (
    <div>
      {label && <p className="text-xs text-muted-foreground mb-1.5">{label}</p>}
      <div className="flex flex-wrap gap-1.5">{tags.map((t) => <Tag key={t} label={t} variant={variant} />)}</div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-muted-foreground w-28 shrink-0">{label}</label>
      <input className="flex-1 rounded-lg border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring" value={value} onChange={(e) => onChange(e.target.value)} />
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

function Tag({ label, variant }: { label: string; variant?: 'primary' | 'destructive' }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs ${variant === 'primary' ? 'bg-primary/10 text-primary' : variant === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'}`}>{label}</span>
}

function ColourSwatch({ hex, label }: { hex: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(hex); setCopied(true); setTimeout(() => setCopied(false), 1500) }} title={`Copy ${hex}`} className="flex flex-col items-center gap-1 group">
      <div className="w-10 h-10 rounded-lg border border-border shadow-sm group-hover:scale-105 transition-transform" style={{ backgroundColor: hex }} />
      <span className="text-[10px] text-muted-foreground font-mono">{copied ? 'Copied' : hex}</span>
      {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
    </button>
  )
}
