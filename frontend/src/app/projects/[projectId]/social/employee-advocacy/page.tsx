'use client'

import { useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Users, Lock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SSEFeaturePage } from '@/components/pillar1/SSEFeaturePage'
import { api } from '@/lib/api'
import { usePillar6Store } from '@/stores/pillar6-store'
import { useFeatureFlag } from '@/hooks/useFeatureFlag'
import { SidebarToggle } from '@/components/layout/sidebar'
import type { ProgressStep } from '@/types'

const PLATFORMS = ['LinkedIn', 'X / Twitter', 'Instagram', 'Facebook', 'Threads']
const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Customer Success', 'Product', 'Design', 'HR / People', 'Leadership']
const TONES = ['authentic', 'enthusiastic', 'professional', 'casual', 'thought-leader']

// ---------------------------------------------------------------------------
// Feature gate — shown when employee_advocacy_enabled flag is false
// ---------------------------------------------------------------------------

function FeatureGate() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <div>
          <h1 className="font-semibold">Employee Advocacy</h1>
          <p className="text-xs text-muted-foreground">Claude · Ayrshare</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 text-center gap-4 p-8">
        <div className="p-4 rounded-full bg-muted">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h2 className="font-semibold">Employee Advocacy is disabled</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This feature is not currently enabled for your workspace. Contact your administrator
            to turn on the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">employee_advocacy_enabled</code> flag
            in the admin panel.
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Direct URL access is preserved — the feature will appear here once enabled.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Advocacy result types
// ---------------------------------------------------------------------------

interface AdvocacyPost {
  platform: string
  post: string
  hashtags: string[]
  character_count: number
  engagement_hook: string
}

interface AdvocacyPayload {
  employee_name: string
  department: string
  posts: AdvocacyPost[]
  coaching_notes: string[]
  brand_alignment_score: number
  personalisation_tips: string[]
}

// ---------------------------------------------------------------------------
// Main page (shown when feature flag is true)
// ---------------------------------------------------------------------------

function AdvocacyPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = usePillar6Store()
  const abortRef = useRef<AbortController | null>(null)

  const [employeeName, setEmployeeName] = useState('')
  const [department, setDepartment] = useState('Marketing')
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState('LinkedIn')
  const [tone, setTone] = useState('authentic')
  const [personalAngle, setPersonalAngle] = useState('')
  const [result, setResult] = useState<AdvocacyPayload | null>(null)

  function reset(): AbortController {
    store.setIsStreaming(true)
    store.clearSteps()
    store.clearStreamText()
    setResult(null)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    return ctrl
  }

  async function generate() {
    if (!topic.trim()) { toast.error('Topic is required'); return }
    const ctrl = reset()
    try {
      await api.pillar6.streamEmployeeAdvocacy(
        projectId,
        {
          employee_name: employeeName.trim() || undefined,
          department,
          topic: topic.trim(),
          platform,
          tone,
          personal_angle: personalAngle.trim() || undefined,
        },
        {
          onStep: (step, label, status) => store.upsertStep(step, label, status as ProgressStep['status']),
          onDelta: (text) => store.appendStreamText(text),
          onSaved: (_id, payload) => {
            setResult(payload as unknown as AdvocacyPayload)
            store.clearStreamText()
            store.setIsStreaming(false)
            toast.success('Advocacy posts ready!')
          },
          onError: (msg) => { toast.error(msg); store.setIsStreaming(false) },
          onDone: () => store.setIsStreaming(false),
        },
        ctrl.signal,
      )
    } catch { store.setIsStreaming(false) }
  }

  const form = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employee Name (optional)</label>
          <input
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            placeholder="e.g. Alex Chen"
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Topic / Campaign Message *</label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={3}
          placeholder="e.g. We just launched X feature — share from your perspective why it matters to customers"
          className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Voice Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {TONES.map((t) => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Personal Angle (optional)</label>
        <input
          value={personalAngle}
          onChange={(e) => setPersonalAngle(e.target.value)}
          placeholder="e.g. I've spent 3 years working on this problem, so this launch means a lot to me"
          className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="text-xs text-muted-foreground mt-1">Adds authenticity — weave in personal experience or context</p>
      </div>
    </>
  )

  const resultNode = result ? (
    <div className="space-y-4">
      {result.brand_alignment_score > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Brand Alignment</p>
            <p className="text-2xl font-bold tabular-nums">
              {result.brand_alignment_score}
              <span className="text-sm font-normal text-muted-foreground">/100</span>
            </p>
          </div>
        </div>
      )}

      {result.posts?.map((post, i) => (
        <div key={i} className="p-4 rounded-xl border border-border bg-card space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{post.platform}</p>
            <span className="text-[10px] text-muted-foreground">{post.character_count} chars</span>
          </div>
          {post.engagement_hook && (
            <p className="text-xs text-primary font-medium">Hook: {post.engagement_hook}</p>
          )}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.post}</p>
          {post.hashtags?.length > 0 && (
            <p className="text-xs text-primary/70">
              {post.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
            </p>
          )}
        </div>
      ))}

      {result.coaching_notes?.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Coaching Notes</p>
          <ul className="space-y-1">
            {result.coaching_notes.map((note, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                <span className="text-primary shrink-0">•</span>{note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.personalisation_tips?.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-muted/40">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Personalisation Tips</p>
          <ul className="space-y-1">
            {result.personalisation_tips.map((tip, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                <span className="text-amber-500 shrink-0">→</span>{tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  ) : null

  return (
    <SSEFeaturePage
      projectId={projectId}
      title="Employee Advocacy"
      subtitle="Generate pre-approved posts in authentic employee voice · Claude"
      icon={<Users className="w-4 h-4" />}
      credits={10}
      steps={store.steps}
      isStreaming={store.isStreaming}
      streamText={store.streamText}
      form={form}
      result={resultNode}
      onSubmit={generate}
      submitLabel="Generate Advocacy Posts — 10 credits"
      canSubmit={!!topic.trim()}
    />
  )
}

// ---------------------------------------------------------------------------
// Entry point — feature flag gate
// ---------------------------------------------------------------------------

export default function EmployeeAdvocacyPage() {
  const { enabled, loading } = useFeatureFlag('employee_advocacy_enabled')

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!enabled) return <FeatureGate />
  return <AdvocacyPage />
}
