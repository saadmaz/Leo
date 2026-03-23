'use client'

import { useCallback, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  FileText, Sparkles, RefreshCw, Download, TrendingUp,
  BarChart2, Upload, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { SidebarToggle } from '@/components/layout/sidebar'
import { BackButton } from '@/components/layout/back-button'
import { api } from '@/lib/api'
import type { WeeklyDigest } from '@/types'

// ---------------------------------------------------------------------------
// Markdown-lite renderer (bold, headers, bullets)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-sm font-bold mt-5 mb-1.5 text-foreground">
          {line.slice(3)}
        </h2>
      )
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <li key={key++} className="text-sm text-muted-foreground ml-3 leading-relaxed">
          {parseBold(line.slice(2))}
        </li>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1" />)
    } else {
      elements.push(
        <p key={key++} className="text-sm text-muted-foreground leading-relaxed">
          {parseBold(line)}
        </p>
      )
    }
  }
  return elements
}

function parseBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/)
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i} className="text-foreground font-semibold">{p}</strong> : p
  )
}

// ---------------------------------------------------------------------------
// Stat mini-card
// ---------------------------------------------------------------------------

function MiniStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 bg-muted/40 rounded-lg px-3 py-2.5">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-bold tabular-nums">{value}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId

  const [digest, setDigest] = useState<WeeklyDigest | null>(null)
  const [loading, setLoading] = useState(false)

  const generate = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.reports.getDigest(projectId)
      setDigest(data)
    } catch {
      toast.error('Failed to generate digest')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  function downloadMd() {
    if (!digest) return
    const blob = new Blob([digest.digest], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leo-digest-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const ov = digest?.overview

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <SidebarToggle />
        <BackButton />
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">AI Digest</span>
        {digest && (
          <span className="ml-1 text-[11px] text-muted-foreground">
            {new Date(digest.generated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {digest && (
            <button
              onClick={downloadMd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors"
            >
              <Download className="w-3 h-3" />
              Export MD
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {digest ? 'Regenerate' : 'Generate Digest'}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 max-w-3xl mx-auto w-full space-y-4">
        {!digest && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-base font-semibold mb-1">AI Weekly Digest</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Get a comprehensive AI-powered analysis of your content performance, what&apos;s working,
              and specific recommendations for next week.
            </p>
            <button
              onClick={generate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <Sparkles className="w-4 h-4" />
              Generate Digest
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Analysing your content performance…</p>
          </div>
        )}

        {digest && !loading && (
          <>
            {/* Snapshot stats */}
            {ov && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MiniStat label="Total Content"   value={ov.total_content}                      icon={<FileText className="w-3.5 h-3.5" />} />
                <MiniStat label="Posted"          value={ov.total_posted}                       icon={<Upload className="w-3.5 h-3.5" />} />
                <MiniStat label="Avg Engagement"  value={ov.avg_engagement}                     icon={<TrendingUp className="w-3.5 h-3.5" />} />
                <MiniStat label="Best Platform"   value={ov.best_platform || '—'}               icon={<BarChart2 className="w-3.5 h-3.5" />} />
              </div>
            )}

            {/* Platform distribution pills */}
            {ov && Object.keys(ov.platform_breakdown).length > 0 && (
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Platform Distribution</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ov.platform_breakdown).map(([platform, count]) => (
                    <div key={platform} className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-full text-xs">
                      <span className="font-medium capitalize">{platform}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI digest */}
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">AI Analysis</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />
              </div>
              <div className="space-y-0.5">
                {renderMarkdown(digest.digest)}
              </div>
            </div>

            {/* Status breakdown */}
            {digest.trends.status_breakdown.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Content by Status</p>
                <div className="space-y-2">
                  {digest.trends.status_breakdown.map((s) => {
                    const total = digest.trends.status_breakdown.reduce((acc, x) => acc + x.count, 0)
                    const pct = total > 0 ? Math.round((s.count / total) * 100) : 0
                    return (
                      <div key={s.status} className="flex items-center gap-3">
                        <span className="text-xs w-20 capitalize text-muted-foreground">{s.status}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{s.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
