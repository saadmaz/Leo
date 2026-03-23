'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  BookOpen, Plus, Loader2, RefreshCw, Trash2,
  ChevronDown, ChevronUp, ExternalLink, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'
import { BackButton } from '@/components/layout/back-button'
import type { ResearchReport } from '@/types'

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ResearchReport['status'] }) {
  if (status === 'complete') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-medium">
        <CheckCircle2 className="w-3 h-3" />
        Complete
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-medium">
        <AlertCircle className="w-3 h-3" />
        Error
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-medium">
      <Loader2 className="w-3 h-3 animate-spin" />
      {status === 'processing' ? 'Processing…' : 'Pending'}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ResearchReportsPage() {
  const params = useParams<{ projectId: string }>()
  const [reports, setReports] = useState<ResearchReport[]>([])
  const [loading, setLoading] = useState(true)
  const [newTopic, setNewTopic] = useState('')
  const [newType, setNewType] = useState('market_landscape')
  const [starting, setStarting] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set())

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.research.list(params.projectId)
      setReports(data.reports)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [params.projectId])

  useEffect(() => { loadReports() }, [loadReports])

  // Poll pending/processing reports every 10s
  useEffect(() => {
    const pending = reports.filter((r) => r.status === 'pending' || r.status === 'processing')
    if (pending.length === 0) return

    const interval = setInterval(async () => {
      for (const report of pending) {
        try {
          const updated = await api.research.status(params.projectId, report.id)
          setReports((prev) => prev.map((r) => r.id === updated.id ? updated : r))
          if (updated.status === 'complete' || updated.status === 'error') {
            setPollingIds((prev) => { const next = new Set(prev); next.delete(report.id); return next })
            if (updated.status === 'complete') {
              toast.success(`Research ready: "${updated.title ?? updated.topic}"`)
            }
          }
        } catch {
          // ignore
        }
      }
    }, 10_000)

    return () => clearInterval(interval)
  }, [reports, params.projectId, pollingIds])

  async function handleStart() {
    if (!newTopic.trim()) { toast.error('Enter a research topic first.'); return }
    setStarting(true)
    try {
      const result = await api.research.start(params.projectId, newTopic.trim(), newType)
      toast.success('Research started! Results will appear here when ready.')
      setNewTopic('')
      setPollingIds((prev) => new Set(prev).add(result.report_id))
      await loadReports()
    } catch (err) {
      console.error(err)
      toast.error('Failed to start research. Check your Exa API key.')
    } finally {
      setStarting(false)
    }
  }

  async function handleDelete(reportId: string) {
    try {
      await api.research.delete(params.projectId, reportId)
      setReports((prev) => prev.filter((r) => r.id !== reportId))
      toast.success('Report deleted.')
    } catch {
      toast.error('Failed to delete report.')
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-border shrink-0">
        <SidebarToggle />
        <BackButton />
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Deep Research Reports</span>
        </div>
        <span className="text-xs text-muted-foreground ml-1">powered by Exa</span>
        <div className="ml-auto">
          <button
            onClick={loadReports}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* New research form */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Start new research</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                placeholder="e.g. Sustainable packaging trends in F&B 2026"
                className="flex-1 text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="market_landscape">Market Landscape</option>
                <option value="competitor_analysis">Competitor Analysis</option>
                <option value="trend_analysis">Trend Analysis</option>
                <option value="consumer_insights">Consumer Insights</option>
                <option value="content_strategy">Content Strategy</option>
              </select>
              <button
                onClick={handleStart}
                disabled={starting || !newTopic.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {starting ? 'Starting…' : 'Start Research'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Deep research uses Exa's async research engine. Reports take 2–5 minutes and include sourced analysis.
            </p>
          </div>

          {/* Reports list */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h2 className="text-base font-semibold mb-2">No research reports yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Enter a topic above to generate a deep research report with sourced insights.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  isExpanded={expanded === report.id}
                  onToggle={() => setExpanded(expanded === report.id ? null : report.id)}
                  onDelete={() => handleDelete(report.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReportCard
// ---------------------------------------------------------------------------

function ReportCard({
  report, isExpanded, onToggle, onDelete,
}: {
  report: ResearchReport
  isExpanded: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <StatusBadge status={report.status} />
            {report.report_type && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                {report.report_type.replace('_', ' ')}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold truncate">{report.title ?? report.topic}</p>
          {report.title && report.title !== report.topic && (
            <p className="text-xs text-muted-foreground truncate">{report.topic}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatDate(report.completedAt ?? report.createdAt)}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {report.status === 'complete'
            ? (isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)
            : null}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && report.status === 'complete' && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Summary */}
          {report.summary && (
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Executive Summary</p>
              <p className="text-sm leading-relaxed">{report.summary}</p>
            </div>
          )}

          {/* Sections */}
          {report.sections && report.sections.length > 0 && (
            <div className="space-y-2">
              {report.sections.map((section, i) => (
                <details key={i} className="group">
                  <summary className="flex items-center justify-between cursor-pointer rounded-lg border border-border px-3 py-2.5 hover:bg-muted/30 transition-colors list-none">
                    <span className="text-xs font-semibold">{section.title}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-3 pb-3 pt-2">
                    <p className="text-sm leading-relaxed text-muted-foreground">{section.content}</p>
                  </div>
                </details>
              ))}
            </div>
          )}

          {/* Sources */}
          {report.sources && report.sources.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sources</p>
              <div className="space-y-1">
                {report.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    {src.title || src.url}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {report.status === 'error' && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-rose-500">
            {report.error ?? 'Research failed. Please try again.'}
          </p>
        </div>
      )}
    </div>
  )
}
