'use client'

/**
 * ContextPanel — cross-pillar intelligence surface.
 *
 * This is Leo's moat made visible: the AI that writes a blog post
 * knows your competitor's positioning, your brand's recent voice trend,
 * and what content types are currently working for you. This panel
 * surfaces that context alongside any generation workflow.
 *
 * Usage:
 *   <ContextPanel projectId={projectId} context="seo" />
 *
 * context types:
 *   "content"  — brand voice trend + top performing type + active campaign
 *   "seo"      — competitor count + recent alerts + voice trend
 *   "strategy" — competitor alerts + brand voice trend + active campaign
 *   "campaign" — active campaign + top content type + voice trend
 */

import { useEffect, useState } from 'react'
import {
  Sparkles, X, TrendingUp, TrendingDown, Minus,
  Bell, BarChart2, Megaphone, ChevronRight, Loader2,
  AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { api, type ContextSummary } from '@/lib/api'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContextType = 'content' | 'seo' | 'strategy' | 'campaign'

interface ContextPanelProps {
  projectId: string
  context: ContextType
  className?: string
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
  )
}

function AlertCard({ alert }: { alert: ContextSummary['recent_alerts'][0] }) {
  const sentimentIcon =
    alert.sentiment === 'positive' ? <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" /> :
    alert.sentiment === 'negative' ? <TrendingDown className="w-3 h-3 text-rose-500 shrink-0" /> :
    <Minus className="w-3 h-3 text-muted-foreground shrink-0" />

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
      {sentimentIcon}
      <div className="flex-1 min-w-0">
        {alert.subject && (
          <p className="text-[10px] text-muted-foreground font-medium">{alert.subject}</p>
        )}
        <p className="text-xs leading-snug line-clamp-2">{alert.title}</p>
      </div>
    </div>
  )
}

function VoiceTrendCard({ trend }: { trend: ContextSummary['voice_trend'] }) {
  if (trend.recent_count === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Minus className="w-3.5 h-3.5" />
        No scored content yet
      </div>
    )
  }

  const icon = trend.direction === 'up'
    ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
    : trend.direction === 'down'
    ? <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
    : <Minus className="w-3.5 h-3.5 text-muted-foreground" />

  const dirLabel = trend.direction === 'up' ? 'Improving' : trend.direction === 'down' ? 'Declining' : 'Stable'
  const scoreColor = trend.avg_score != null
    ? trend.avg_score >= 75 ? 'text-emerald-500'
    : trend.avg_score >= 55 ? 'text-amber-500'
    : 'text-rose-500'
    : 'text-muted-foreground'

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs">{dirLabel}</span>
      </div>
      {trend.avg_score != null && (
        <span className={cn('text-sm font-bold tabular-nums', scoreColor)}>
          {trend.avg_score}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel content by context type
// ---------------------------------------------------------------------------

function PanelContent({ data, context }: { data: ContextSummary; context: ContextType }) {
  const sections: React.ReactNode[] = []

  // ── Brand voice trend (all contexts) ──────────────────────────────────────
  sections.push(
    <div key="voice">
      <SectionHeader label="Brand Voice Trend" />
      <div className="p-3 rounded-xl border border-border bg-background">
        <VoiceTrendCard trend={data.voice_trend} />
        {data.voice_trend.recent_count > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Based on {data.voice_trend.recent_count} recent piece{data.voice_trend.recent_count !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )

  // ── Competitor pulse (seo + strategy) ─────────────────────────────────────
  if (context === 'seo' || context === 'strategy') {
    sections.push(
      <div key="competitors">
        <SectionHeader label="Competitive Pulse" />
        <div className="p-3 rounded-xl border border-border bg-background space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs">
              <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{data.competitor_count} competitor{data.competitor_count !== 1 ? 's' : ''} tracked</span>
            </div>
            {data.competitor_count === 0 && (
              <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" /> None set up
              </span>
            )}
          </div>

          {data.recent_alerts.length > 0 ? (
            <div className="mt-2 space-y-0">
              <p className="text-[10px] text-muted-foreground mb-1">Recent signals</p>
              {data.recent_alerts.slice(0, 3).map((alert, i) => (
                <AlertCard key={i} alert={alert} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              No alerts in last 14 days
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Alerts only (content) ──────────────────────────────────────────────────
  if (context === 'content' && data.recent_alerts.length > 0) {
    sections.push(
      <div key="alerts">
        <SectionHeader label="Brand Signals" />
        <div className="p-3 rounded-xl border border-border bg-background">
          {data.recent_alerts.slice(0, 2).map((alert, i) => (
            <AlertCard key={i} alert={alert} />
          ))}
        </div>
      </div>
    )
  }

  // ── Top performing content type (content + campaign) ──────────────────────
  if ((context === 'content' || context === 'campaign') && data.top_content_type) {
    sections.push(
      <div key="top-type">
        <SectionHeader label="What's Working" />
        <div className="p-3 rounded-xl border border-border bg-background flex items-center justify-between">
          <span className="text-xs">{data.top_content_type}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full">
            Top performer
          </span>
        </div>
      </div>
    )
  }

  // ── Active campaign banner (seo + content + strategy) ─────────────────────
  if (data.active_campaign && context !== 'campaign') {
    sections.push(
      <div key="campaign">
        <SectionHeader label="Active Campaign" />
        <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Megaphone className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs truncate font-medium">{data.active_campaign.name}</span>
          </div>
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
            data.active_campaign.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
          )}>
            {data.active_campaign.status}
          </span>
        </div>
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Sparkles className="w-8 h-8 text-muted-foreground/30 mb-3" />
        <p className="text-xs text-muted-foreground">No cross-pillar signals yet.</p>
        <p className="text-[10px] text-muted-foreground mt-1">Add competitors and generate content to see insights here.</p>
      </div>
    )
  }

  return <div className="space-y-4">{sections}</div>
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ContextPanel({ projectId, context, className }: ContextPanelProps) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ContextSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Load context data when panel first opens
  useEffect(() => {
    if (!open || data || loading) return
    setLoading(true)
    api.analytics.contextSummary(projectId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [open, projectId, data, loading])

  return (
    <div className={cn('flex items-start', className)}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? 'Hide context panel' : 'Show brand intelligence'}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0',
          open
            ? 'bg-primary text-primary-foreground border-primary'
            : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted/50',
        )}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{open ? 'Hide' : 'Context'}</span>
        {!open && <ChevronRight className="w-3 h-3" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="ml-3 w-64 shrink-0 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold">Brand Intelligence</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Panel body */}
          <div className="p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground">Failed to load context.</p>
                <button
                  onClick={() => { setError(false); setLoading(true); api.analytics.contextSummary(projectId).then(setData).catch(() => setError(true)).finally(() => setLoading(false)) }}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Retry
                </button>
              </div>
            ) : data ? (
              <PanelContent data={data} context={context} />
            ) : null}
          </div>

          {/* Refresh footer */}
          {data && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/20">
              <button
                onClick={() => { setData(null); setError(false) }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground w-full justify-center"
              >
                <Bell className="w-3 h-3" />
                Refresh signals
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
