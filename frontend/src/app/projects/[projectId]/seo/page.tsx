'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Globe, Loader2, Copy, Check, ChevronDown, ChevronUp,
  FileText, Code2, Layout, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { SidebarToggle } from '@/components/layout/sidebar'
import type { BlogPostMeta, MetaTagsResult, WebsiteCopySection } from '@/types'

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

type Tab = 'blog' | 'meta' | 'website'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'blog',    label: 'Blog Post',    icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'meta',    label: 'Meta Tags',    icon: <Code2 className="w-3.5 h-3.5" /> },
  { id: 'website', label: 'Website Copy', icon: <Layout className="w-3.5 h-3.5" /> },
]

const PAGE_TYPES = ['homepage', 'about', 'product', 'pricing', 'landing']

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SEOPage() {
  const params = useParams<{ projectId: string }>()
  const { activeProject } = useAppStore()
  const [tab, setTab] = useState<Tab>('blog')

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <SidebarToggle />
        <Globe className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">SEO Studio</span>
        {activeProject && <span className="text-xs text-muted-foreground">— {activeProject.name}</span>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-border shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              tab === t.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'blog'    && <BlogPostTab projectId={params.projectId} />}
        {tab === 'meta'    && <MetaTagsTab projectId={params.projectId} />}
        {tab === 'website' && <WebsiteCopyTab projectId={params.projectId} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Blog Post Tab
// ---------------------------------------------------------------------------

function BlogPostTab({ projectId }: { projectId: string }) {
  const [topic, setTopic]       = useState('')
  const [keywords, setKeywords] = useState('')
  const [tone, setTone]         = useState('informative and engaging')
  const [wordCount, setWordCount] = useState(1000)
  const [loading, setLoading]   = useState(false)
  const [meta, setMeta]         = useState<BlogPostMeta | null>(null)
  const [body, setBody]         = useState('')
  const [copied, setCopied]     = useState(false)

  async function handleGenerate() {
    if (!topic.trim()) { toast.error('Enter a topic.'); return }
    setLoading(true)
    setMeta(null)
    setBody('')
    try {
      await api.streamBlogPost(
        projectId,
        {
          topic: topic.trim(),
          keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
          tone,
          word_count: wordCount,
        },
        (m) => setMeta(m),
        (chunk) => setBody((prev) => prev + chunk),
      )
    } catch (err) {
      console.error(err)
      toast.error('Blog post generation failed.')
    } finally {
      setLoading(false)
    }
  }

  function copyAll() {
    if (!meta || !body) return
    const full = `# ${meta.title}\n\n${body}`
    navigator.clipboard.writeText(full)
    setCopied(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Inputs */}
      <div className="border border-border rounded-xl bg-card p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1">Topic *</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. How to build a sustainable morning routine"
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Target Keywords <span className="text-muted-foreground">(comma-separated)</span></label>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. morning routine, productivity habits, wellness tips"
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Tone</label>
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="informative and engaging"
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Word count</label>
            <select
              value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value))}
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {[500, 800, 1000, 1500, 2000, 2500, 3000].map((n) => (
                <option key={n} value={n}>{n.toLocaleString()} words</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Generating…' : 'Generate Blog Post'}
        </button>
      </div>

      {/* Meta preview */}
      {meta && (
        <div className="border border-border rounded-xl bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SEO Preview</span>
            <button
              onClick={copyAll}
              disabled={!body}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                copied ? 'bg-green-500/10 text-green-600' : 'bg-muted text-foreground hover:bg-muted/70',
              )}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy post'}
            </button>
          </div>
          <p className="text-base font-semibold text-blue-600 hover:underline cursor-pointer">{meta.title}</p>
          <p className="text-xs text-green-700">/{meta.slug}</p>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
          {meta.outline?.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">OUTLINE</p>
              <ol className="space-y-0.5">
                {meta.outline.map((h, i) => (
                  <li key={i} className="text-xs text-foreground/70">{i + 1}. {h}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Post body */}
      {body && (
        <div className="border border-border rounded-xl bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Generated Post {loading && <span className="text-primary animate-pulse">● writing…</span>}
          </p>
          <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Meta Tags Tab
// ---------------------------------------------------------------------------

function MetaTagsTab({ projectId }: { projectId: string }) {
  const [pageTitle, setPageTitle]     = useState('')
  const [pageDesc, setPageDesc]       = useState('')
  const [pageType, setPageType]       = useState('homepage')
  const [loading, setLoading]         = useState(false)
  const [result, setResult]           = useState<MetaTagsResult | null>(null)

  async function handleGenerate() {
    if (!pageTitle.trim() || !pageDesc.trim()) {
      toast.error('Enter page title and description.')
      return
    }
    setLoading(true)
    try {
      const data = await api.seo.metaTags(projectId, pageTitle, pageDesc, pageType)
      setResult(data)
    } catch (err) {
      console.error(err)
      toast.error('Meta tags generation failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="border border-border rounded-xl bg-card p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1">Page Title / Topic *</label>
          <input value={pageTitle} onChange={(e) => setPageTitle(e.target.value)}
            placeholder="e.g. AI-powered email marketing for small businesses"
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Page Description / Purpose *</label>
          <textarea value={pageDesc} onChange={(e) => setPageDesc(e.target.value)} rows={3}
            placeholder="Describe what this page does and who it's for…"
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Page Type</label>
          <select value={pageType} onChange={(e) => setPageType(e.target.value)}
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary">
            {PAGE_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
        </div>
        <button onClick={handleGenerate} disabled={loading || !pageTitle.trim() || !pageDesc.trim()}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Generating…' : 'Generate Meta Tags'}
        </button>
      </div>

      {result?.tags && (
        <div className="border border-border rounded-xl bg-card p-4 space-y-3">
          {Object.entries(result.tags).map(([key, value]) => (
            <MetaRow key={key} label={key} value={String(value)} />
          ))}
        </div>
      )}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="group flex items-start gap-3">
      <span className="text-[10px] font-mono text-muted-foreground w-32 shrink-0 pt-0.5 uppercase">
        {label.replace(/_/g, ' ')}
      </span>
      <span className="text-xs text-foreground/80 flex-1 leading-relaxed">{value}</span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted">
        {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Website Copy Tab
// ---------------------------------------------------------------------------

function WebsiteCopyTab({ projectId }: { projectId: string }) {
  const [pageType, setPageType]   = useState('homepage')
  const [context, setContext]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [sections, setSections]   = useState<WebsiteCopySection[]>([])
  const [expanded, setExpanded]   = useState<Set<number>>(new Set([0]))

  async function handleGenerate() {
    setLoading(true)
    setSections([])
    try {
      const data = await api.seo.websiteCopy(projectId, pageType, context || undefined)
      setSections(data.sections)
      setExpanded(new Set([0]))
    } catch (err) {
      console.error(err)
      toast.error('Website copy generation failed.')
    } finally {
      setLoading(false)
    }
  }

  function toggle(i: number) {
    setExpanded((prev) => {
      const s = new Set(prev)
      if (s.has(i)) { s.delete(i) } else { s.add(i) }
      return s
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="border border-border rounded-xl bg-card p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1">Page Type</label>
          <div className="flex gap-1.5 flex-wrap">
            {PAGE_TYPES.map((t) => (
              <button key={t} onClick={() => setPageType(t)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium border capitalize transition-colors',
                  pageType === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                )}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Additional context <span className="text-muted-foreground">(optional)</span></label>
          <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={2}
            placeholder="e.g. Launching a new feature, targeting enterprise clients, emphasise free trial…"
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </div>
        <button onClick={handleGenerate} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Generating…' : `Generate ${pageType} copy`}
        </button>
      </div>

      {sections.map((section, i) => (
        <CopySection key={i} section={section} expanded={expanded.has(i)} onToggle={() => toggle(i)} />
      ))}
    </div>
  )
}

function CopySection({ section, expanded, onToggle }: {
  section: WebsiteCopySection; expanded: boolean; onToggle: () => void
}) {
  const [copied, setCopied] = useState(false)
  function copySection() {
    const text = [section.headline, section.subheadline, section.body, section.cta].filter(Boolean).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <button onClick={onToggle} className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 transition-colors">
        <span className="text-sm font-semibold">{section.name}</span>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); copySection() }}
            className="p-1 rounded hover:bg-muted transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase mt-3 mb-1">Headline</p>
            <p className="text-lg font-bold">{section.headline}</p>
          </div>
          {section.subheadline && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Subheadline</p>
              <p className="text-sm text-foreground/80">{section.subheadline}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Body</p>
            <p className="text-sm text-foreground/70 whitespace-pre-wrap">{section.body}</p>
          </div>
          {section.cta && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">CTA</p>
              <span className="inline-block px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg">{section.cta}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
