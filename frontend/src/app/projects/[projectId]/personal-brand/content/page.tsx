'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import {
  Loader2, Sparkles, Zap, BookOpen, Flame, User, RefreshCw, Copy, Check,
  ThumbsUp, ChevronDown, ChevronUp, ArrowRight, FileText, Send, Calendar,
  CheckCircle2, XCircle, Link2, Share2, Twitter, Linkedin, Instagram,
  Trash2, Clock, BarChart2, Heart, MessageCircle, Repeat2, Eye,
  Search, ShieldCheck, ShieldAlert, Shield, MessageSquare, ExternalLink,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { MovedNotice } from '@/components/layout/moved-notice'
import { SidebarToggle } from '@/components/layout/sidebar'
import type { ConnectedPlatform, ContentPlatform, GeneratedPost, OpinionQuestions, GeneratedBios, PublishedPost } from '@/types'

// ============================================================================
// Shared mini-components
// ============================================================================

const PLATFORMS: { value: ContentPlatform; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'threads', label: 'Threads' },
  { value: 'youtube', label: 'YouTube' },
]
const ARTICLE_PLATFORMS = [
  { value: 'linkedin', label: 'LinkedIn Article' },
  { value: 'substack', label: 'Substack' },
  { value: 'medium', label: 'Medium' },
  { value: 'blog', label: 'Blog Post' },
]
type Mode = 'quick' | 'story' | 'opinion' | 'bio' | 'article'
type ContentTab = 'write' | 'schedule' | 'posts' | 'reputation'

function VoiceBadge({ score }: { score: number }) {
  const color = score >= 85 ? 'text-green-600 bg-green-500/10 border-green-500/20' :
    score >= 65 ? 'text-amber-600 bg-amber-500/10 border-amber-500/20' :
    'text-red-500 bg-red-500/10 border-red-500/20'
  return <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', color)}>{score}% your voice</span>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function ApproveButton({ projectId, content, platform, edited }: { projectId: string; content: string; platform: ContentPlatform; edited: boolean }) {
  const [saved, setSaved] = useState(false)
  async function handleApprove() { await api.persona.approveOutput(projectId, { content, platform, editedByUser: edited }); setSaved(true) }
  return (
    <button onClick={handleApprove} disabled={saved} className={cn('flex items-center gap-1.5 text-xs transition-colors', saved ? 'text-green-600 cursor-default' : 'text-muted-foreground hover:text-foreground')}>
      <ThumbsUp className="w-3.5 h-3.5" />
      {saved ? 'Saved to voice' : 'Approve & train voice'}
    </button>
  )
}

function StepsList({ steps }: { steps: { label: string; status: 'running' | 'done' | 'error' }[] }) {
  if (!steps.length) return null
  return (
    <div className="space-y-1.5 py-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          {s.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />}
          {s.status === 'done' && <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />}
          {s.status === 'error' && <span className="w-3.5 h-3.5 text-destructive shrink-0">✕</span>}
          <span className={cn('text-sm', s.status === 'running' ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span>
        </div>
      ))}
    </div>
  )
}

function PlatformSelector({ value, onChange, multi, selected, onToggle }: {
  value?: ContentPlatform; onChange?: (v: ContentPlatform) => void
  multi?: boolean; selected?: ContentPlatform[]; onToggle?: (v: ContentPlatform) => void
}) {
  if (multi && selected && onToggle) {
    return (
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button key={p.value} onClick={() => onToggle(p.value)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              selected.includes(p.value) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:text-foreground')}>
            {p.label}
          </button>
        ))}
      </div>
    )
  }
  return (
    <select value={value} onChange={(e) => onChange?.(e.target.value as ContentPlatform)}
      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
      {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
    </select>
  )
}

// ============================================================================
// Publish panel (inline within PostOutput)
// ============================================================================

function PublishPanel({ projectId, content }: { projectId: string; content: string }) {
  const [open, setOpen] = useState(false)
  const [platforms, setPlatforms] = useState<ConnectedPlatform[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [scheduleDate, setScheduleDate] = useState('')
  const [tab, setTab] = useState<'now' | 'schedule'>('now')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  const loadPlatforms = useCallback(async () => {
    if (platforms.length) return
    try {
      const data = await api.persona.getPublishingProfile(projectId)
      setPlatforms(data.connectedPlatforms)
      if (data.connectedPlatforms.length > 0) setSelected([data.connectedPlatforms[0].platform])
    } catch {}
  }, [projectId, platforms.length])

  function toggle() { if (!open) loadPlatforms(); setOpen(!open); setStatus('idle') }
  function togglePlatform(p: string) { setSelected((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]) }

  async function handlePublish() {
    if (!selected.length) return
    setStatus('loading')
    try {
      if (tab === 'now') { await api.persona.publishNow(projectId, content, selected) }
      else {
        if (!scheduleDate) { setErrMsg('Pick a date & time'); setStatus('error'); return }
        await api.persona.schedulePost(projectId, content, selected, new Date(scheduleDate).toISOString())
      }
      setStatus('done')
    } catch (e) { setErrMsg(e instanceof Error ? e.message : 'Publish failed'); setStatus('error') }
  }

  return (
    <div>
      <button onClick={toggle} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Send className="w-3.5 h-3.5" />{open ? 'Close' : 'Publish'}
      </button>
      {open && (
        <div className="mt-3 rounded-lg border border-border bg-background p-3 space-y-3">
          <div className="flex gap-1">
            {(['now', 'schedule'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn('flex-1 text-xs py-1 rounded-md font-medium transition-colors', tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                {t === 'now' ? 'Publish Now' : 'Schedule'}
              </button>
            ))}
          </div>
          {platforms.length === 0 ? (
            <p className="text-xs text-muted-foreground">No platforms connected yet. <a href="?tab=schedule" className="underline text-primary hover:opacity-80">Connect platforms →</a></p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {platforms.map((p) => (
                <button key={p.platform} onClick={() => togglePlatform(p.platform)}
                  className={cn('px-2.5 py-1 rounded-md text-xs border transition-colors', selected.includes(p.platform) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                  {p.displayName || p.platform}
                </button>
              ))}
            </div>
          )}
          {tab === 'schedule' && (
            <input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
          )}
          {status === 'done' ? (
            <p className="text-xs text-green-600 font-medium flex items-center gap-1.5"><Check className="w-3.5 h-3.5" />{tab === 'now' ? 'Published!' : 'Scheduled!'}</p>
          ) : (
            <button onClick={handlePublish} disabled={status === 'loading' || !selected.length || platforms.length === 0}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-xs py-1.5 font-medium disabled:opacity-50 transition-opacity">
              {status === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {tab === 'now' ? <><Send className="w-3.5 h-3.5" /> Publish Now</> : <><Calendar className="w-3.5 h-3.5" /> Schedule</>}
            </button>
          )}
          {status === 'error' && <p className="text-xs text-destructive">{errMsg}</p>}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Post output card
// ============================================================================

function PostOutput({ projectId, post, onEdit }: { projectId: string; post: GeneratedPost; onEdit: (text: string) => void }) {
  const [text, setText] = useState(post.content)
  const [editing, setEditing] = useState(false)
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground capitalize">{post.platform}</span>
          <VoiceBadge score={post.voiceAccuracyScore} />
        </div>
        <div className="flex items-center gap-3">
          <CopyButton text={text} />
          <button onClick={() => { setEditing(!editing); if (editing) onEdit(text) }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {editing ? 'Done editing' : 'Edit'}
          </button>
        </div>
      </div>
      <div className="p-4">
        {editing ? (
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
            className="w-full bg-transparent text-sm text-foreground resize-none focus:outline-none leading-relaxed" />
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{text}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-t border-border/60 bg-muted/20">
        <PublishPanel projectId={projectId} content={text} />
        <ApproveButton projectId={projectId} content={text} platform={post.platform as ContentPlatform} edited={text !== post.content} />
      </div>
    </div>
  )
}

// ============================================================================
// Write modes (unchanged from original)
// ============================================================================

function QuickPostMode({ projectId }: { projectId: string }) {
  const [platform, setPlatform] = useState<ContentPlatform>('linkedin')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<{ label: string; status: 'running' | 'done' | 'error' }[]>([])
  const [result, setResult] = useState<GeneratedPost | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)

  function handleGenerate() {
    if (!topic.trim()) return
    setLoading(true); setSteps([]); setResult(null); setError(null)
    ctrlRef.current = new AbortController()
    api.persona.streamGeneratePost(projectId, { platform, topic: topic.trim() }, {
      onStep: (label, status) => setSteps((p) => { const idx = p.findIndex((s) => s.label === label); if (idx >= 0) { const n = [...p]; n[idx] = { label, status }; return n } return [...p, { label, status }] }),
      onDone: (event) => { setResult(event.result as GeneratedPost); setLoading(false) },
      onError: (msg) => { setError(msg); setLoading(false) },
    }, ctrlRef.current.signal)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div><p className="text-xs font-medium text-muted-foreground mb-1.5">Platform</p><PlatformSelector value={platform} onChange={setPlatform} /></div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">What do you want to write about?</p>
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. The biggest mistake I see founders make when hiring their first team" rows={3}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
        </div>
        <button onClick={handleGenerate} disabled={loading || !topic.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Writing…' : 'Generate post'}
        </button>
      </div>
      {loading && <StepsList steps={steps} />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && <PostOutput projectId={projectId} post={result} onEdit={() => {}} />}
    </div>
  )
}

function StoryMode({ projectId }: { projectId: string }) {
  const [platform, setPlatform] = useState<ContentPlatform>('linkedin')
  const [story, setStory] = useState('')
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<{ label: string; status: 'running' | 'done' | 'error' }[]>([])
  const [result, setResult] = useState<GeneratedPost | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)

  function handleGenerate() {
    if (!story.trim()) return
    setLoading(true); setSteps([]); setResult(null); setError(null)
    ctrlRef.current = new AbortController()
    api.persona.streamStoryToPost(projectId, { story: story.trim(), platform }, {
      onStep: (label, status) => setSteps((p) => { const idx = p.findIndex((s) => s.label === label); if (idx >= 0) { const n = [...p]; n[idx] = { label, status }; return n } return [...p, { label, status }] }),
      onDone: (event) => { setResult(event.result as GeneratedPost); setLoading(false) },
      onError: (msg) => { setError(msg); setLoading(false) },
    }, ctrlRef.current.signal)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div><p className="text-xs font-medium text-muted-foreground mb-1.5">Platform</p><PlatformSelector value={platform} onChange={setPlatform} /></div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">What happened? Describe it in your own words.</p>
          <textarea value={story} onChange={(e) => setStory(e.target.value)} placeholder="e.g. Last week a client called to say we lost the deal…" rows={5}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
          <p className="text-[11px] text-muted-foreground mt-1">Don&apos;t clean it up - LEO structures it. Just write what happened.</p>
        </div>
        <button onClick={handleGenerate} disabled={loading || !story.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
          {loading ? 'Shaping your story…' : 'Turn into post'}
        </button>
      </div>
      {loading && <StepsList steps={steps} />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && <PostOutput projectId={projectId} post={result} onEdit={() => {}} />}
    </div>
  )
}

function OpinionMode({ projectId }: { projectId: string }) {
  const [platform, setPlatform] = useState<ContentPlatform>('linkedin')
  const [take, setTake] = useState('')
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<{ label: string; status: 'running' | 'done' | 'error' }[]>([])
  const [questions, setQuestions] = useState<string[] | null>(null)
  const [answers, setAnswers] = useState<string[]>(['', '', ''])
  const [result, setResult] = useState<GeneratedPost | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)

  function handleGetQuestions() {
    if (!take.trim()) return
    setLoading(true); setSteps([]); setQuestions(null); setResult(null); setError(null)
    ctrlRef.current = new AbortController()
    api.persona.streamOpinion(projectId, { take: take.trim(), platform }, {
      onStep: (label, status) => setSteps((p) => { const idx = p.findIndex((s) => s.label === label); if (idx >= 0) { const n = [...p]; n[idx] = { label, status }; return n } return [...p, { label, status }] }),
      onDone: (event) => {
        const r = event.result as OpinionQuestions | GeneratedPost
        if (r.type === 'questions') { setQuestions((r as OpinionQuestions).questions); setAnswers(new Array((r as OpinionQuestions).questions.length).fill('')) }
        else { setResult(r as GeneratedPost) }
        setLoading(false)
      },
      onError: (msg) => { setError(msg); setLoading(false) },
    }, ctrlRef.current.signal)
  }

  function handleGeneratePost() {
    const filled = answers.filter((a) => a.trim())
    if (!filled.length) return
    setLoading(true); setSteps([]); setResult(null); setError(null)
    ctrlRef.current = new AbortController()
    api.persona.streamOpinion(projectId, { take: take.trim(), platform, answers: filled }, {
      onStep: (label, status) => setSteps((p) => { const idx = p.findIndex((s) => s.label === label); if (idx >= 0) { const n = [...p]; n[idx] = { label, status }; return n } return [...p, { label, status }] }),
      onDone: (event) => { setResult(event.result as GeneratedPost); setLoading(false) },
      onError: (msg) => { setError(msg); setLoading(false) },
    }, ctrlRef.current.signal)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div><p className="text-xs font-medium text-muted-foreground mb-1.5">Platform</p><PlatformSelector value={platform} onChange={setPlatform} /></div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">What&apos;s your take? State it bluntly.</p>
          <textarea value={take} onChange={(e) => setTake(e.target.value)} rows={3}
            placeholder="e.g. Most startup advice is wrong because it's given by people who got lucky, not people who were actually good."
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
        </div>
        {!questions && (
          <button onClick={handleGetQuestions} disabled={loading || !take.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {loading ? 'Thinking…' : 'Get probing questions'}
          </button>
        )}
      </div>
      {loading && <StepsList steps={steps} />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {questions && !result && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Answer these to sharpen your argument:</p>
          {questions.map((q, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-foreground mb-1.5">{q}</p>
              <textarea value={answers[i] || ''} onChange={(e) => { const n = [...answers]; n[i] = e.target.value; setAnswers(n) }} rows={2} placeholder="Your answer…"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
          ))}
          <button onClick={handleGeneratePost} disabled={loading || !answers.some((a) => a.trim())}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
            {loading ? 'Writing…' : 'Write the post'}
          </button>
        </div>
      )}
      {result && <PostOutput projectId={projectId} post={result} onEdit={() => {}} />}
    </div>
  )
}

function BioMode({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<{ label: string; status: 'running' | 'done' | 'error' }[]>([])
  const [result, setResult] = useState<GeneratedBios | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const ctrlRef = useRef<AbortController | null>(null)

  function handleGenerate() {
    setLoading(true); setSteps([]); setResult(null); setError(null)
    ctrlRef.current = new AbortController()
    api.persona.streamBioWriter(projectId, {
      onStep: (label, status) => setSteps((p) => { const idx = p.findIndex((s) => s.label === label); if (idx >= 0) { const n = [...p]; n[idx] = { label, status }; return n } return [...p, { label, status }] }),
      onDone: (event) => { setResult(event.result as GeneratedBios); setLoading(false) },
      onError: (msg) => { setError(msg); setLoading(false) },
    }, ctrlRef.current.signal)
  }

  const toggle = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">LEO writes your LinkedIn headline and about section, Instagram bio, X bio, and TikTok bio - all from your Personal Core positioning.</p>
        <button onClick={handleGenerate} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
          {loading ? 'Writing your bios…' : 'Generate all bios'}
        </button>
      </div>
      {loading && <StepsList steps={steps} />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="space-y-3">
          {result.bios.linkedin && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button onClick={() => toggle('linkedin')} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors">
                LinkedIn {expanded.linkedin ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {expanded.linkedin && (
                <div className="px-4 pb-4 space-y-4 border-t border-border/60">
                  <div className="pt-3"><div className="flex items-center justify-between mb-1"><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Headline</p><CopyButton text={result.bios.linkedin.headline} /></div><p className="text-sm text-foreground">{result.bios.linkedin.headline}</p></div>
                  <div><div className="flex items-center justify-between mb-1"><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">About (preview)</p><CopyButton text={result.bios.linkedin.aboutPreview} /></div><p className="text-sm text-foreground whitespace-pre-wrap">{result.bios.linkedin.aboutPreview}</p></div>
                  <div><div className="flex items-center justify-between mb-1"><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Full About</p><CopyButton text={result.bios.linkedin.aboutFull} /></div><p className="text-sm text-foreground whitespace-pre-wrap">{result.bios.linkedin.aboutFull}</p></div>
                </div>
              )}
            </div>
          )}
          {result.bios.instagram && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button onClick={() => toggle('instagram')} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors">
                Instagram {expanded.instagram ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {expanded.instagram && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/60">
                  <div className="pt-3"><div className="flex items-center justify-between mb-1"><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Bio</p><CopyButton text={result.bios.instagram.bio} /></div><p className="text-sm text-foreground whitespace-pre-wrap">{result.bios.instagram.bio}</p></div>
                  <div><div className="flex items-center justify-between mb-1"><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Link label</p><CopyButton text={result.bios.instagram.linkLabel} /></div><p className="text-sm text-foreground">{result.bios.instagram.linkLabel}</p></div>
                </div>
              )}
            </div>
          )}
          {(result.bios.twitter || result.bios.tiktok) && (
            <div className="grid grid-cols-2 gap-3">
              {result.bios.twitter && <div className="rounded-xl border border-border bg-card p-4"><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Twitter / X</p><p className="text-sm text-foreground whitespace-pre-wrap">{result.bios.twitter.bio}</p><CopyButton text={result.bios.twitter.bio} /></div>}
              {result.bios.tiktok && <div className="rounded-xl border border-border bg-card p-4"><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">TikTok</p><p className="text-sm text-foreground whitespace-pre-wrap">{result.bios.tiktok.bio}</p><CopyButton text={result.bios.tiktok.bio} /></div>}
            </div>
          )}
          <button onClick={handleGenerate} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
        </div>
      )}
    </div>
  )
}

function ArticleMode({ projectId }: { projectId: string }) {
  const [platform, setPlatform] = useState('linkedin')
  const [topic, setTopic] = useState('')
  const [outline, setOutline] = useState('')
  const [showOutline, setShowOutline] = useState(false)
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<{ label: string; status: 'running' | 'done' | 'error' }[]>([])
  const [result, setResult] = useState<GeneratedPost | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editedText, setEditedText] = useState('')
  const [editing, setEditing] = useState(false)
  const ctrlRef = useRef<AbortController | null>(null)

  function handleGenerate() {
    if (!topic.trim()) return
    setLoading(true); setSteps([]); setResult(null); setError(null); setEditing(false)
    ctrlRef.current = new AbortController()
    api.persona.streamArticle(projectId, { topic: topic.trim(), platform, outline: outline.trim() || undefined }, {
      onStep: (label, status) => setSteps((p) => { const idx = p.findIndex((s) => s.label === label); if (idx >= 0) { const n = [...p]; n[idx] = { label, status }; return n } return [...p, { label, status }] }),
      onDone: (event) => { const r = event.result as GeneratedPost; setResult(r); setEditedText(r.content); setLoading(false) },
      onError: (msg) => { setError(msg); setLoading(false) },
    }, ctrlRef.current.signal)
  }

  const displayText = editing ? editedText : result?.content ?? ''

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Platform</p>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            {ARTICLE_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Topic or angle</p>
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2}
            placeholder="e.g. Why most founders mistake hiring speed for hiring quality"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
        </div>
        <div>
          <button onClick={() => setShowOutline(!showOutline)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {showOutline ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showOutline ? 'Hide outline' : 'Add optional outline / key points'}
          </button>
          {showOutline && (
            <textarea value={outline} onChange={(e) => setOutline(e.target.value)} rows={4}
              placeholder="- The problem&#10;- What I learned&#10;- The framework I use now"
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
          )}
        </div>
        <button onClick={handleGenerate} disabled={loading || !topic.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {loading ? 'Writing your article…' : 'Write article'}
        </button>
      </div>
      {loading && <StepsList steps={steps} />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
            <div className="flex items-center gap-2"><span className="text-xs font-medium text-foreground capitalize">{platform}</span><VoiceBadge score={result.voiceAccuracyScore} />{result.wordCount && <span className="text-[10px] text-muted-foreground">{result.wordCount} words</span>}</div>
            <div className="flex items-center gap-3"><CopyButton text={displayText} /><button onClick={() => setEditing(!editing)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{editing ? 'Done editing' : 'Edit'}</button></div>
          </div>
          <div className="p-4 max-h-[500px] overflow-y-auto">
            {editing ? <textarea value={editedText} onChange={(e) => setEditedText(e.target.value)} rows={20} className="w-full bg-transparent text-sm text-foreground resize-none focus:outline-none leading-relaxed" />
              : <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{result.content}</p>}
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/60 bg-muted/20">
            <button onClick={handleGenerate} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><RefreshCw className="w-3.5 h-3.5" /> Regenerate</button>
            <ApproveButton projectId={projectId} content={editing ? editedText : result.content} platform={platform as ContentPlatform} edited={editing && editedText !== result.content} />
          </div>
        </div>
      )}
    </div>
  )
}

const MODES: { key: Mode; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'quick', label: 'Quick Post', icon: <Zap className="w-4 h-4" />, description: 'Write about any topic in your voice' },
  { key: 'story', label: 'Story → Post', icon: <BookOpen className="w-4 h-4" />, description: 'Turn an experience into a compelling post' },
  { key: 'opinion', label: 'Hot Take', icon: <Flame className="w-4 h-4" />, description: 'Turn a strong opinion into a full post' },
  { key: 'bio', label: 'Bio Writer', icon: <User className="w-4 h-4" />, description: 'Generate bios for every platform' },
  { key: 'article', label: 'Article', icon: <FileText className="w-4 h-4" />, description: 'Write a long-form thought leadership piece' },
]

function WriteTab({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState<Mode>('quick')
  const active = MODES.find((m) => m.key === mode)!

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {MODES.map((m) => (
          <button key={m.key} onClick={() => setMode(m.key)}
            className={cn('flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all',
              mode === m.key ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80')}>
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', mode === m.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{m.icon}</div>
            <div>
              <p className="text-xs font-semibold leading-tight">{m.label}</p>
              <p className="text-[10px] leading-tight opacity-70 mt-0.5 hidden sm:block">{m.description}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{active.icon}</div>
          <div><p className="text-sm font-semibold text-foreground">{active.label}</p><p className="text-xs text-muted-foreground">{active.description}</p></div>
        </div>
        {mode === 'quick' && <QuickPostMode projectId={projectId} />}
        {mode === 'story' && <StoryMode projectId={projectId} />}
        {mode === 'opinion' && <OpinionMode projectId={projectId} />}
        {mode === 'bio' && <BioMode projectId={projectId} />}
        {mode === 'article' && <ArticleMode projectId={projectId} />}
      </div>
    </div>
  )
}

// ============================================================================
// Schedule tab — platform connection management (from publishing page)
// ============================================================================

const PLATFORM_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  linkedin:  { label: 'LinkedIn',   color: 'bg-blue-700',    icon: <Linkedin className="w-4 h-4" /> },
  twitter:   { label: 'Twitter/X',  color: 'bg-neutral-700', icon: <Twitter className="w-4 h-4" /> },
  instagram: { label: 'Instagram',  color: 'bg-pink-600',    icon: <Instagram className="w-4 h-4" /> },
  facebook:  { label: 'Facebook',   color: 'bg-blue-600',    icon: <Share2 className="w-4 h-4" /> },
  tiktok:    { label: 'TikTok',     color: 'bg-neutral-900', icon: <Share2 className="w-4 h-4" /> },
  youtube:   { label: 'YouTube',    color: 'bg-red-600',     icon: <Share2 className="w-4 h-4" /> },
  threads:   { label: 'Threads',    color: 'bg-neutral-800', icon: <Share2 className="w-4 h-4" /> },
  pinterest: { label: 'Pinterest',  color: 'bg-red-500',     icon: <Share2 className="w-4 h-4" /> },
  reddit:    { label: 'Reddit',     color: 'bg-orange-600',  icon: <Share2 className="w-4 h-4" /> },
}
const ALL_PLATFORMS = Object.keys(PLATFORM_META)

function PlatformCard({ platform, connected, onConnect, connecting }: {
  platform: string; connected: ConnectedPlatform | undefined
  onConnect: (p: string) => void; connecting: boolean
}) {
  const meta = PLATFORM_META[platform] ?? { label: platform, color: 'bg-muted', icon: <Share2 className="w-4 h-4" /> }
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 flex items-center gap-4', connected ? 'border-green-500/30 bg-green-500/5' : '')}>
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0', meta.color)}>{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{meta.label}</p>
        {connected ? <p className="text-xs text-muted-foreground truncate">@{connected.username || connected.displayName}</p> : <p className="text-xs text-muted-foreground">Not connected</p>}
      </div>
      {connected ? (
        <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" />Connected</span>
      ) : (
        <button onClick={() => onConnect(platform)} disabled={connecting}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
          {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
          Connect
        </button>
      )}
    </div>
  )
}

function ScheduleTab({ projectId }: { projectId: string }) {
  const [connected, setConnected] = useState<ConnectedPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try { const data = await api.persona.getPublishingProfile(projectId); setConnected(data.connectedPlatforms); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load publishing profile') }
    finally { setLoading(false); setRefreshing(false) }
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function handleConnect(platform: string) {
    setConnecting(platform)
    try {
      const data = await api.persona.getConnectUrl(projectId, platform)
      const url = (data as Record<string, string>).url || (data as Record<string, string>).generateJWT
      if (url) {
        const win = window.open(url, '_blank', 'width=600,height=700')
        const poll = setInterval(() => { if (win?.closed) { clearInterval(poll); setRefreshing(true); load() } }, 1000)
      }
    } catch (e) { alert(e instanceof Error ? e.message : 'Could not generate connect URL') }
    finally { setConnecting(null) }
  }

  const connectedMap = Object.fromEntries(connected.map((c) => [c.platform, c]))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-2xl font-bold text-foreground">{connected.length}</p><p className="text-xs text-muted-foreground mt-0.5">Connected platforms</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-2xl font-bold text-foreground">{ALL_PLATFORMS.length - connected.length}</p><p className="text-xs text-muted-foreground mt-0.5">Available to connect</p></div>
          </div>
          {connected.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-foreground mb-3">Connected accounts</h2>
              <div className="space-y-2">
                {connected.map((c) => <PlatformCard key={c.platform} platform={c.platform} connected={c} onConnect={handleConnect} connecting={connecting === c.platform} />)}
              </div>
            </section>
          )}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">{connected.length > 0 ? 'Add more platforms' : 'Connect a platform to get started'}</h2>
              <button onClick={() => { setRefreshing(true); load() }} disabled={refreshing} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />Refresh
              </button>
            </div>
            <div className="space-y-2">
              {ALL_PLATFORMS.filter((p) => !connectedMap[p]).map((p) => <PlatformCard key={p} platform={p} connected={undefined} onConnect={handleConnect} connecting={connecting === p} />)}
            </div>
          </section>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">How it works:</strong> Click &quot;Connect&quot; to open the platform&apos;s auth page.
              Once you approve access, your account will appear here. Posts generated in the Write tab can then be published or scheduled directly from there.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================================
// Posts tab — scheduled + history (from calendar page)
// ============================================================================

const POST_PLATFORM_COLORS: Record<string, string> = {
  linkedin: 'bg-blue-700', twitter: 'bg-neutral-700', instagram: 'bg-pink-600',
  facebook: 'bg-blue-600', tiktok: 'bg-neutral-900', youtube: 'bg-red-600', threads: 'bg-neutral-800',
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function groupByDate(posts: PublishedPost[]): { date: string; posts: PublishedPost[] }[] {
  const map = new Map<string, PublishedPost[]>()
  for (const p of posts) {
    const key = p.scheduledAt
      ? new Date(p.scheduledAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
      : 'Published'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }
  return Array.from(map.entries()).map(([date, posts]) => ({ date, posts }))
}

function PostAnalytics({ projectId, postId }: { projectId: string; postId: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    if (loaded) return
    setLoading(true)
    try { setData(await api.persona.getPostAnalytics(projectId, postId) as Record<string, unknown>) }
    catch { setData({}) }
    finally { setLoading(false); setLoaded(true) }
  }

  if (!loaded) return (
    <button onClick={load} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart2 className="w-3 h-3" />}View stats
    </button>
  )

  const platforms = (data?.platforms as Record<string, unknown>[] | undefined) ?? []
  const totals = platforms.reduce<{ likes: number; comments: number; shares: number; impressions: number }>(
    (acc, p) => {
      const d = p as Record<string, unknown>
      acc.likes += Number(d.likes ?? d.likeCount ?? 0)
      acc.comments += Number(d.comments ?? d.commentCount ?? 0)
      acc.shares += Number(d.shares ?? d.retweetCount ?? d.repostCount ?? 0)
      acc.impressions += Number(d.impressions ?? d.views ?? 0)
      return acc
    },
    { likes: 0, comments: 0, shares: 0, impressions: 0 },
  )

  return (
    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
      {totals.impressions > 0 && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{totals.impressions.toLocaleString()}</span>}
      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{totals.likes.toLocaleString()}</span>
      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{totals.comments.toLocaleString()}</span>
      <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" />{totals.shares.toLocaleString()}</span>
    </div>
  )
}

function PostCard({ post, projectId, onCancel, cancelling }: {
  post: PublishedPost; projectId: string; onCancel?: (id: string) => void; cancelling: boolean
}) {
  const isPending = post.status === 'scheduled'
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {post.platforms.map((p) => (
            <span key={p} className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium text-white', POST_PLATFORM_COLORS[p] ?? 'bg-muted')}>{p}</span>
          ))}
        </div>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
          post.status === 'published' ? 'bg-green-500/10 text-green-600' :
          post.status === 'scheduled' ? 'bg-amber-500/10 text-amber-600' : 'bg-destructive/10 text-destructive')}>
          {post.status}
        </span>
      </div>
      <p className="text-sm text-foreground line-clamp-4 whitespace-pre-wrap leading-relaxed">{post.post}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
        <span className="flex items-center gap-1.5">
          {isPending ? <Clock className="w-3 h-3" /> : <Send className="w-3 h-3" />}
          {isPending ? `Scheduled: ${formatDate(post.scheduledAt)}` : `Published: ${formatDate(post.scheduledAt ?? post.createdAt)}`}
        </span>
        <div className="flex items-center gap-3">
          {!isPending && post.ayrsharePostId && <PostAnalytics projectId={projectId} postId={post.ayrsharePostId} />}
          {isPending && onCancel && post.ayrsharePostId && (
            <button onClick={() => onCancel(post.ayrsharePostId!)} disabled={cancelling}
              className="flex items-center gap-1 text-destructive hover:opacity-70 disabled:opacity-40 transition-opacity">
              {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

type PostsSubTab = 'scheduled' | 'history'

function PostsTab({ projectId }: { projectId: string }) {
  const [subTab, setSubTab] = useState<PostsSubTab>('scheduled')
  const [scheduled, setScheduled] = useState<PublishedPost[]>([])
  const [history, setHistory] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [sched, hist] = await Promise.all([api.persona.listScheduled(projectId), api.persona.getPublishHistory(projectId)])
      setScheduled(sched.posts ?? []); setHistory(hist.posts ?? []); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load posts') }
    finally { setLoading(false); setRefreshing(false) }
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function handleCancel(postId: string) {
    setCancelling(postId)
    try { await api.persona.cancelScheduled(projectId, postId); setScheduled((prev) => prev.filter((p) => p.ayrsharePostId !== postId)) }
    catch (e) { alert(e instanceof Error ? e.message : 'Could not cancel post') }
    finally { setCancelling(null) }
  }

  const activeList = subTab === 'scheduled' ? scheduled : history
  const groups = groupByDate(activeList)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {([
            { value: 'scheduled' as PostsSubTab, label: 'Scheduled', count: scheduled.length },
            { value: 'history' as PostsSubTab, label: 'History', count: history.length },
          ]).map((t) => (
            <button key={t.value} onClick={() => setSubTab(t.value)}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                subTab === t.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
              {t.label}
              {t.count > 0 && <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', subTab === t.value ? 'bg-white/20' : 'bg-muted-foreground/20')}>{t.count}</span>}
            </button>
          ))}
        </div>
        <button onClick={() => { setRefreshing(true); load() }} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      ) : activeList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {subTab === 'scheduled' ? 'No posts scheduled yet. Generate content in the Write tab and publish or schedule it.' : 'No published posts yet.'}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.date}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{group.date}</h2>
            <div className="space-y-3">
              {group.posts.map((post) => (
                <PostCard key={post.id} post={post} projectId={projectId} onCancel={subTab === 'scheduled' ? handleCancel : undefined} cancelling={cancelling === post.ayrsharePostId} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

// ============================================================================
// Reputation tab — full monitoring (from reputation page)
// ============================================================================

interface GoogleResult { title: string; url: string; snippet: string; position: number; source: string }
interface SocialMention { platform: string; url: string; title: string; snippet: string; sentiment: 'positive' | 'neutral' | 'negative'; sentimentReason?: string }
interface ReputationSummary { googleResultsFound: number; topGoogleSource: string; totalMentionsFound: number; sentimentBreakdown: { positive: number; neutral: number; negative: number }; overallSentiment: 'positive' | 'neutral' | 'negative' }
interface ReputationData { projectId: string; fullName: string; checkedAt: string; googleResults: GoogleResult[]; socialMentions: SocialMention[]; summary: ReputationSummary }

function sentimentColor(s: string) {
  if (s === 'positive') return 'text-green-600 bg-green-500/10 border-green-500/20'
  if (s === 'negative') return 'text-red-500 bg-red-500/10 border-red-500/20'
  return 'text-muted-foreground bg-muted border-border'
}
function sentimentIcon(s: string) {
  if (s === 'positive') return <ShieldCheck className="w-4 h-4 text-green-600" />
  if (s === 'negative') return <ShieldAlert className="w-4 h-4 text-red-500" />
  return <Shield className="w-4 h-4 text-muted-foreground" />
}

function ReputationTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ReputationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mentionTab, setMentionTab] = useState<'google' | 'mentions'>('google')

  const load = useCallback(async () => {
    try {
      const rep = await api.persona.getReputation(projectId) as unknown as ReputationData
      setData(rep); setError(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('404') && !msg.includes('No reputation')) setError(msg)
    } finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function handleCheck() {
    setChecking(true); setError(null)
    try { const rep = await api.persona.checkReputation(projectId) as unknown as ReputationData; setData(rep) }
    catch (e) { setError(e instanceof Error ? e.message : 'Reputation check failed') }
    finally { setChecking(false) }
  }

  const googleResults = data?.googleResults ?? []
  const mentions = data?.socialMentions ?? []

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Reputation Monitor</h2>
          <p className="text-xs text-muted-foreground">Google search presence + social mention sentiment</p>
        </div>
        <button onClick={handleCheck} disabled={checking}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          {checking ? 'Checking…' : data ? 'Re-check' : 'Run check'}
        </button>
      </div>

      {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      : error ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center gap-2"><XCircle className="w-4 h-4 shrink-0" />{error}</div>
      : !data ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center"><Shield className="w-7 h-7 text-muted-foreground" /></div>
          <div><p className="text-sm font-medium text-foreground">No reputation data yet</p><p className="text-xs text-muted-foreground mt-1 max-w-xs">Run a check to scan Google for your name and analyse sentiment from social mentions.</p></div>
          <button onClick={handleCheck} disabled={checking} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}Run reputation check
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last checked: {new Date(data.checkedAt).toLocaleString()}</span>
            {data.fullName && <span>Searching for: <strong className="text-foreground">{data.fullName}</strong></span>}
          </div>

          {data.summary && (() => {
            const { sentimentBreakdown: b, overallSentiment, googleResultsFound, totalMentionsFound } = data.summary
            const total = b.positive + b.neutral + b.negative || 1
            return (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', overallSentiment === 'positive' ? 'bg-green-500/10' : overallSentiment === 'negative' ? 'bg-red-500/10' : 'bg-muted')}>
                    {sentimentIcon(overallSentiment)}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground capitalize">{overallSentiment} reputation</p>
                    <p className="text-xs text-muted-foreground">{googleResultsFound} Google results · {totalMentionsFound} social mentions</p>
                  </div>
                </div>
                {total > 1 && (
                  <div className="space-y-2">
                    <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                      {b.positive > 0 && <div className="bg-green-500 rounded-l-full" style={{ width: `${(b.positive / total) * 100}%` }} />}
                      {b.neutral > 0 && <div className="bg-muted-foreground/30" style={{ width: `${(b.neutral / total) * 100}%` }} />}
                      {b.negative > 0 && <div className="bg-red-500 rounded-r-full" style={{ width: `${(b.negative / total) * 100}%` }} />}
                    </div>
                    <div className="flex gap-4 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{b.positive} positive</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />{b.neutral} neutral</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{b.negative} negative</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 text-center"><p className="text-2xl font-bold text-foreground">{googleResults.length}</p><p className="text-xs text-muted-foreground mt-0.5">Google results</p></div>
            <div className="rounded-xl border border-border bg-card p-4 text-center"><p className="text-2xl font-bold text-foreground">{mentions.length}</p><p className="text-xs text-muted-foreground mt-0.5">Social mentions</p></div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className={cn('text-2xl font-bold capitalize', sentimentColor(data.summary?.overallSentiment ?? 'neutral').split(' ')[0])}>{data.summary?.overallSentiment ?? '–'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Overall tone</p>
            </div>
          </div>

          <div className="flex gap-1">
            {([
              { value: 'google' as const, label: 'Google Results', count: googleResults.length, icon: <Search className="w-3.5 h-3.5" /> },
              { value: 'mentions' as const, label: 'Social Mentions', count: mentions.length, icon: <MessageSquare className="w-3.5 h-3.5" /> },
            ]).map((t) => (
              <button key={t.value} onClick={() => setMentionTab(t.value)}
                className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  mentionTab === t.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                {t.icon}{t.label}
                {t.count > 0 && <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', mentionTab === t.value ? 'bg-white/20' : 'bg-muted-foreground/20')}>{t.count}</span>}
              </button>
            ))}
          </div>

          {mentionTab === 'google' && (
            <div className="space-y-2">
              {googleResults.length === 0 ? <p className="text-sm text-muted-foreground py-4">No Google results found.</p>
              : googleResults.map((r, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline line-clamp-2 leading-snug">{r.title}</a>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{r.source}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">#{r.position}</span>
                      <a href={r.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" /></a>
                    </div>
                  </div>
                  {r.snippet && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{r.snippet}</p>}
                </div>
              ))}
            </div>
          )}
          {mentionTab === 'mentions' && (
            <div className="space-y-2">
              {mentions.length === 0 ? <p className="text-sm text-muted-foreground py-4">No social mentions found.</p>
              : mentions.map((m, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-[9px] font-bold uppercase text-muted-foreground shrink-0">{m.platform[0]}</span>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline line-clamp-1">{m.title || `${m.platform} mention`}</a>
                    </div>
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize', sentimentColor(m.sentiment))}>{m.sentiment}</span>
                  </div>
                  {m.snippet && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{m.snippet}</p>}
                  {m.sentimentReason && <p className="text-[10px] text-muted-foreground italic">{m.sentimentReason}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================================
// Page
// ============================================================================

const CONTENT_TABS: { key: ContentTab; label: string }[] = [
  { key: 'write', label: 'Write' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'posts', label: 'Posts' },
  { key: 'reputation', label: 'Reputation' },
]

export default function PersonalBrandContentPage() {
  const params = useParams<{ projectId: string }>()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<ContentTab>(() => {
    const t = searchParams.get('tab') as ContentTab | null
    return CONTENT_TABS.some((x) => x.key === t) ? t! : 'write'
  })

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <MovedNotice />

      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <SidebarToggle />
          <div>
            <h1 className="text-lg font-bold text-foreground">Content Engine</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create, schedule, and monitor your personal brand.</p>
          </div>
        </div>
        {/* Tab bar */}
        <div className="flex gap-0 overflow-x-auto">
          {CONTENT_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeTab === 'write' && <WriteTab projectId={params.projectId} />}
        {activeTab === 'schedule' && <ScheduleTab projectId={params.projectId} />}
        {activeTab === 'posts' && <PostsTab projectId={params.projectId} />}
        {activeTab === 'reputation' && <ReputationTab projectId={params.projectId} />}
      </div>
    </div>
  )
}
