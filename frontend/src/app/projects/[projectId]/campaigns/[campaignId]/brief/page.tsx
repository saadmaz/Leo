'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Target, Loader2, Edit2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'
import type { Campaign } from '@/types'

// ---------------------------------------------------------------------------
// Field editor
// ---------------------------------------------------------------------------

function EditableField({
  label, value, multiline, onSave,
}: {
  label: string
  value: string
  multiline?: boolean
  onSave: (val: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (draft === value) { setEditing(false); return }
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
        {!editing && (
          <button onClick={() => { setDraft(value); setEditing(true) }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <Edit2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-1.5">
          {multiline ? (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus
              className="w-full px-3 py-2 text-sm bg-background border border-primary rounded-lg focus:outline-none resize-none" />
          ) : (
            <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
              className="w-full px-3 py-2 text-sm bg-background border border-primary rounded-lg focus:outline-none" />
          )}
          <div className="flex gap-1.5">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded-lg hover:bg-muted">
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-foreground/80">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
      )}
    </div>
  )
}

function EditableList({
  label, items, onSave,
}: {
  label: string
  items: string[]
  onSave: (val: string[]) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(items.join('\n'))
  const [saving, setSaving] = useState(false)

  async function save() {
    const next = draft.split('\n').map((s) => s.trim()).filter(Boolean)
    setSaving(true)
    try { await onSave(next); setEditing(false) }
    catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
        {!editing && (
          <button onClick={() => { setDraft(items.join('\n')); setEditing(true) }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <Edit2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-1.5">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} autoFocus
            placeholder="One item per line"
            className="w-full px-3 py-2 text-sm bg-background border border-primary rounded-lg focus:outline-none resize-none" />
          <div className="flex gap-1.5">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded-lg hover:bg-muted">
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      ) : items.length > 0 ? (
        <ul className="space-y-0.5">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
              <span className="text-primary mt-0.5 shrink-0">→</span>{item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground italic">Not set</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CampaignBriefPage() {
  const { projectId, campaignId } = useParams<{ projectId: string; campaignId: string }>()
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.campaigns.get(projectId, campaignId)
      .then(setCampaign)
      .catch(() => toast.error('Failed to load campaign'))
      .finally(() => setLoading(false))
  }, [projectId, campaignId])

  async function updateBrief(field: string, value: string | string[]) {
    if (!campaign) return
    const updatedBrief = { ...(campaign.brief ?? {}), [field]: value }
    const updated = await api.campaigns.update(projectId, campaignId, { brief: updatedBrief })
    setCampaign(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!campaign) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Campaign not found</div>
  }

  const brief = campaign.brief

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <button onClick={() => router.push(`/projects/${projectId}/campaigns`)}
          className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Target className="w-4 h-4 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{campaign.name}</p>
          <p className="text-xs text-muted-foreground">Campaign Brief</p>
        </div>

        {/* Sub-nav */}
        <div className="flex items-center gap-1">
          {([
            { label: 'Brief', path: 'brief' },
            { label: 'Assets', path: 'assets' },
            { label: 'Performance', path: 'performance' },
          ] as const).map((tab) => (
            <button
              key={tab.path}
              onClick={() => router.push(`/projects/${projectId}/campaigns/${campaignId}/${tab.path}`)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab.path === 'brief' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Status + channels */}
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              campaign.status === 'ready' ? 'bg-green-100 text-green-700' :
              campaign.status === 'generating' ? 'bg-blue-100 text-blue-700' :
              'bg-red-100 text-red-700'
            }`}>
              {campaign.status}
            </span>
            <div className="flex gap-1 flex-wrap">
              {campaign.channels.map((ch) => (
                <span key={ch} className="text-[10px] px-2 py-0.5 bg-muted rounded-full capitalize">{ch}</span>
              ))}
            </div>
          </div>

          {brief ? (
            <div className="space-y-5 divide-y divide-border">
              <EditableField label="Campaign Name" value={brief.name ?? campaign.name}
                onSave={(v) => updateBrief('name', v)} />
              <div className="pt-4">
                <EditableField label="Objective" value={brief.objective} multiline
                  onSave={(v) => updateBrief('objective', v)} />
              </div>
              <div className="pt-4">
                <EditableField label="Target Audience" value={brief.audience} multiline
                  onSave={(v) => updateBrief('audience', v)} />
              </div>
              <div className="pt-4">
                <EditableField label="Timeline" value={brief.timeline}
                  onSave={(v) => updateBrief('timeline', v)} />
              </div>
              <div className="pt-4">
                <EditableField label="Budget Guidance" value={brief.budgetGuidance}
                  onSave={(v) => updateBrief('budgetGuidance', v)} />
              </div>
              <div className="pt-4">
                <EditableList label="Key Messages" items={brief.keyMessages ?? []}
                  onSave={(v) => updateBrief('keyMessages', v)} />
              </div>
              <div className="pt-4">
                <EditableList label="KPIs" items={brief.kpis ?? []}
                  onSave={(v) => updateBrief('kpis', v)} />
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No brief generated yet.</p>
              <p className="text-xs mt-1">Generate a campaign to create the brief.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
