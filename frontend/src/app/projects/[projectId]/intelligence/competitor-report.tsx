'use client'

import { useState } from 'react'
import {
  X, Loader2, Building2, Globe, TrendingUp,
  Zap, Target, AlertTriangle, CheckCircle2, ArrowRight, RefreshCw,
  Flame, Shield, BarChart3, PieChart, Activity, Linkedin,
  Instagram, Youtube, Facebook, Clock, DollarSign, MapPin, Calendar,
  ChevronDown, ChevronUp, Lightbulb,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, RadarChart, PolarGrid,
  PolarAngleAxis, Radar, Cell,
} from 'recharts'
import type { CompetitorSnapshot, CompetitorReport } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-4 h-4" />,
  facebook:  <Facebook  className="w-4 h-4" />,
  tiktok:    <Activity  className="w-4 h-4" />,
  linkedin:  <Linkedin  className="w-4 h-4" />,
  youtube:   <Youtube   className="w-4 h-4" />,
}

const PLATFORM_COLOR: Record<string, string> = {
  instagram: '#ec4899',
  facebook:  '#3b82f6',
  tiktok:    '#ffffff',
  linkedin:  '#0ea5e9',
  youtube:   '#ef4444',
}

const DIFF_COLOR = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#0ea5e9', '#a855f7', '#14b8a6', '#f97316']

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function ScoreBadge({ val, compare }: { val: number; compare: number }) {
  const winning = val >= compare
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${winning ? 'text-red-400 bg-red-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
      {val}/10
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CompetitorReportPanel({
  snapshot,
  report,
  loading,
  onClose,
  onRegenerate,
}: {
  snapshot: CompetitorSnapshot
  report: CompetitorReport | null
  loading: boolean
  onClose: () => void
  onRegenerate: () => void
}) {
  const [section, setSection] = useState<string | null>(null)
  const name = snapshot.name

  function toggle(s: string) {
    setSection(prev => prev === s ? null : s)
  }

  const threatConfig = {
    high:   { color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/30',    icon: <Flame className="w-4 h-4" />,       label: 'High Threat' },
    medium: { color: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/30', icon: <AlertTriangle className="w-4 h-4" />, label: 'Medium Threat' },
    low:    { color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', icon: <Shield className="w-4 h-4" />,  label: 'Low Threat' },
  }

  const difficultyConfig = {
    easy:   { color: 'text-emerald-400', label: 'Easy win' },
    medium: { color: 'text-amber-400',   label: 'Medium' },
    hard:   { color: 'text-red-400',     label: 'Hard' },
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-3xl bg-background border-l border-border flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0 bg-card">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold">{name}</h2>
            {report?.company_profile?.industry && (
              <p className="text-xs text-muted-foreground">{report.company_profile.industry}</p>
            )}
          </div>
          {report?.threat_assessment?.overall_threat && (() => {
            const tc = threatConfig[report.threat_assessment.overall_threat]
            return (
              <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${tc.bg} ${tc.color}`}>
                {tc.icon} {tc.label}
              </span>
            )
          })()}
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={onRegenerate}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
              title="Regenerate report"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generating deep-dive report&hellip;</p>
            <p className="text-xs text-muted-foreground/60">Analysing company profile, metrics, content strategy</p>
          </div>
        ) : !report ? null : (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">

              {/* ── Company Profile ── */}
              <Section
                id="profile"
                title="Company Profile"
                icon={<Building2 className="w-4 h-4" />}
                open={section}
                toggle={toggle}
                defaultOpen
              >
                <p className="text-sm text-foreground/80 leading-relaxed mb-4">
                  {report.company_profile.description}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { icon: <Building2 className="w-3.5 h-3.5" />, label: 'Size',     val: report.company_profile.estimated_size },
                    { icon: <Calendar  className="w-3.5 h-3.5" />, label: 'Founded',  val: report.company_profile.founded_estimate },
                    { icon: <MapPin    className="w-3.5 h-3.5" />, label: 'HQ',       val: report.company_profile.hq_location },
                    { icon: <DollarSign className="w-3.5 h-3.5" />, label: 'Revenue', val: report.company_profile.revenue_range },
                    { icon: <Zap       className="w-3.5 h-3.5" />, label: 'Stage',    val: report.company_profile.funding_stage },
                    { icon: <Globe     className="w-3.5 h-3.5" />, label: 'Model',    val: report.company_profile.business_model },
                  ].filter(r => r.val).map((row, i) => (
                    <div key={i} className="rounded-xl bg-muted/40 border border-border px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                        {row.icon} {row.label}
                      </div>
                      <p className="text-xs font-medium capitalize">{row.val}</p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* ── Platform Metrics ── */}
              {(report.platform_metrics?.length ?? 0) > 0 && (
                <Section id="metrics" title="Platform Metrics" icon={<BarChart3 className="w-4 h-4" />} open={section} toggle={toggle} defaultOpen>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {report.platform_metrics.map((pm, i) => (
                      <div key={i} className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span style={{ color: PLATFORM_COLOR[pm.platform] ?? '#888' }}>
                              {PLATFORM_ICON[pm.platform] ?? <Globe className="w-4 h-4" />}
                            </span>
                            <span className="text-sm font-semibold capitalize">{pm.platform}</span>
                            {pm.is_estimated && (
                              <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">est.</span>
                            )}
                          </div>
                          <span className="text-base font-bold">{fmt(pm.followers)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Engagement</p>
                            <p className="text-xs font-bold">{pm.engagement_rate?.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Posts/wk</p>
                            <p className="text-xs font-bold">{pm.posts_per_week}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Avg likes</p>
                            <p className="text-xs font-bold">{fmt(pm.avg_likes)}</p>
                          </div>
                        </div>
                        {pm.top_content_type && (
                          <p className="text-[10px] text-muted-foreground mt-2 text-center">
                            Top format: <span className="text-foreground/70">{pm.top_content_type}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Followers bar chart */}
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">Followers by platform</p>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={report.platform_metrics} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <XAxis dataKey="platform" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                        <Tooltip
                          formatter={(v) => [fmt(Number(v)), 'Followers']}
                          contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                        />
                        <Bar dataKey="followers" radius={[4, 4, 0, 0]}>
                          {report.platform_metrics.map((pm, i) => (
                            <Cell key={i} fill={PLATFORM_COLOR[pm.platform] ?? '#6366f1'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}

              {/* ── Revenue Trajectory ── */}
              {(report.revenue_trajectory?.length ?? 0) > 0 && (
                <Section id="revenue" title="Estimated Revenue Trajectory" icon={<DollarSign className="w-4 h-4" />} open={section} toggle={toggle} defaultOpen>
                  <p className="text-[10px] text-muted-foreground mb-3">
                    AI-estimated based on company size, industry, and market signals. Not verified financial data.
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={report.revenue_trajectory} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={v => `$${fmt(v)}`} />
                      <Tooltip
                        formatter={(v) => [`$${fmt(Number(v))}`, 'Est. Monthly Revenue']}
                        contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Section>
              )}

              {/* ── Growth Trajectory ── */}
              {(report.growth_trajectory?.length ?? 0) > 0 && (
                <Section id="growth" title="Audience Growth Trajectory" icon={<TrendingUp className="w-4 h-4" />} open={section} toggle={toggle} defaultOpen>
                  <p className="text-[10px] text-muted-foreground mb-3">Estimated total followers across all platforms</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={report.growth_trajectory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                      <Tooltip
                        formatter={(v, name) => [
                          name === 'followers_total' ? fmt(Number(v)) : Number(v).toFixed(1),
                          name === 'followers_total' ? 'Total Followers' : 'Engagement Index'
                        ]}
                        contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey="followers_total" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
                      <Line type="monotone" dataKey="engagement_index" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} yAxisId="right" />
                    </LineChart>
                  </ResponsiveContainer>
                </Section>
              )}

              {/* ── Content Mix ── */}
              {(report.content_mix?.length ?? 0) > 0 && (
                <Section id="content" title="Content Strategy Breakdown" icon={<PieChart className="w-4 h-4" />} open={section} toggle={toggle} defaultOpen>
                  {report.their_strategy?.core_message && (
                    <div className="rounded-xl bg-muted/30 border border-border px-4 py-3 mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Core Message</p>
                      <p className="text-sm text-foreground/80 italic">&ldquo;{report.their_strategy.core_message}&rdquo;</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {/* Content mix bars */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Content Mix</p>
                      <div className="space-y-2">
                        {report.content_mix.map((cm, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span className="text-foreground/70">{cm.type}</span>
                              <span className="font-medium">{cm.percentage}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${cm.percentage}%`, backgroundColor: DIFF_COLOR[i % DIFF_COLOR.length] }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Strategy details */}
                    {report.their_strategy && (
                      <div className="space-y-3">
                        {report.their_strategy.content_pillars?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Content Pillars</p>
                            <div className="flex flex-wrap gap-1">
                              {report.their_strategy.content_pillars.map((p, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border text-foreground/70">
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {report.their_strategy.posting_cadence && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Posting Cadence</p>
                            <p className="text-xs text-foreground/80">{report.their_strategy.posting_cadence}</p>
                          </div>
                        )}
                        {report.their_strategy.audience_focus && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Audience Focus</p>
                            <p className="text-xs text-foreground/80">{report.their_strategy.audience_focus}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* ── Head-to-Head Scorecard ── */}
              {(report.vs_brand_scorecard?.length ?? 0) > 0 && (
                <Section id="scorecard" title="Head-to-Head Scorecard" icon={<Target className="w-4 h-4" />} open={section} toggle={toggle} defaultOpen>
                  <p className="text-[10px] text-muted-foreground mb-3">
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Competitor</span>
                    &nbsp;&nbsp;
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Your Brand</span>
                  </p>
                  <div className="space-y-2.5 mb-5">
                    {report.vs_brand_scorecard.map((row, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-foreground/80">{row.dimension}</span>
                          <div className="flex items-center gap-2">
                            <ScoreBadge val={row.competitor} compare={row.brand} />
                            <span className="text-[10px] text-muted-foreground">vs</span>
                            <ScoreBadge val={row.brand} compare={row.competitor} />
                          </div>
                        </div>
                        <div className="flex gap-1 h-1.5">
                          <div className="flex-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${row.competitor * 10}%` }} />
                          </div>
                          <div className="flex-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${row.brand * 10}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Radar chart */}
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={report.vs_brand_scorecard.slice(0, 6)}>
                      <PolarGrid stroke="#333" />
                      <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 9, fill: '#888' }} />
                      <Radar name={name} dataKey="competitor" stroke="#f87171" fill="#f87171" fillOpacity={0.15} strokeWidth={2} />
                      <Radar name="Your Brand" dataKey="brand" stroke="#4ade80" fill="#4ade80" fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </Section>
              )}

              {/* ── What They Do Better ── */}
              {(report.what_they_do_better?.length ?? 0) > 0 && (
                <Section id="better" title={`What ${name} Does Better`} icon={<TrendingUp className="w-4 h-4 text-red-400" />} open={section} toggle={toggle} defaultOpen>
                  <div className="space-y-3">
                    {report.what_they_do_better.map((item, i) => (
                      <div key={i} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded-full bg-red-400/20 text-red-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm font-semibold text-red-300">{item.area}</span>
                        </div>
                        <p className="text-xs text-foreground/80 mb-2">{item.detail}</p>
                        {item.impact && (
                          <p className="text-[10px] text-red-400/80 mb-2">Impact: {item.impact}</p>
                        )}
                        <div className="pt-2 border-t border-red-500/15">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">Your response</p>
                          <p className="text-xs text-foreground/80 flex items-start gap-1.5">
                            <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                            {item.how_to_respond}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ── Opportunities ── */}
              {(report.opportunities?.length ?? 0) > 0 && (
                <Section id="opps" title="Your Opportunities vs This Competitor" icon={<Lightbulb className="w-4 h-4 text-amber-400" />} open={section} toggle={toggle} defaultOpen>
                  <div className="space-y-3">
                    {report.opportunities.map((opp, i) => {
                      const dc = difficultyConfig[opp.difficulty] ?? difficultyConfig.medium
                      return (
                        <div key={i} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-semibold text-amber-300">{opp.opportunity}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              {opp.time_to_impact && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Clock className="w-3 h-3" /> {opp.time_to_impact}
                                </span>
                              )}
                              <span className={`text-[10px] font-semibold ${dc.color}`}>{dc.label}</span>
                            </div>
                          </div>
                          <p className="text-xs text-foreground/70 mb-2">{opp.rationale}</p>
                          <div className="pt-2 border-t border-amber-500/15">
                            <p className="text-xs text-foreground/80 flex items-start gap-1.5">
                              <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                              {opp.action}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* ── Threat Assessment ── */}
              {report.threat_assessment && (
                <Section id="threat" title="Threat Assessment" icon={<AlertTriangle className="w-4 h-4" />} open={section} toggle={toggle}>
                  {(() => {
                    const tc = threatConfig[report.threat_assessment.overall_threat] ?? threatConfig.medium
                    return (
                      <div className={`rounded-xl border px-4 py-3 mb-4 ${tc.bg}`}>
                        <div className={`flex items-center gap-2 text-sm font-semibold mb-1 ${tc.color}`}>
                          {tc.icon} {tc.label}
                        </div>
                        <p className="text-xs text-foreground/80">{report.threat_assessment.threat_rationale}</p>
                      </div>
                    )
                  })()}
                  <div className="grid grid-cols-2 gap-4">
                    {(report.threat_assessment.areas_of_direct_competition?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-2">Direct Competition</p>
                        <ul className="space-y-1">
                          {report.threat_assessment.areas_of_direct_competition.map((a, i) => (
                            <li key={i} className="text-xs text-foreground/70 flex gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />{a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(report.threat_assessment.areas_of_no_overlap?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2">No Overlap</p>
                        <ul className="space-y-1">
                          {report.threat_assessment.areas_of_no_overlap.map((a, i) => (
                            <li key={i} className="text-xs text-foreground/70 flex gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />{a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Section>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function Section({
  id,
  title,
  icon,
  open,
  toggle,
  children,
  defaultOpen = false,
}: {
  id: string
  title: string
  icon: React.ReactNode
  open: string | null
  toggle: (id: string) => void
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const isOpen = open === null ? defaultOpen : open === id
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => toggle(id)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2.5 text-sm font-semibold">
          <span className="text-primary">{icon}</span>
          {title}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {isOpen && <div className="px-5 pb-5 border-t border-border pt-4">{children}</div>}
    </div>
  )
}
