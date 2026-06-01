'use client'

import { useParams, useRouter } from 'next/navigation'
import { Shield, ShieldCheck, Clock, RefreshCw, ArrowRight } from 'lucide-react'
import { SidebarToggle } from '@/components/layout/sidebar'

export default function BrandHubPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <div>
          <h1 className="font-semibold">Brand Intelligence</h1>
          <p className="text-xs text-muted-foreground">Point-in-time audits and ongoing health monitoring</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Explainer */}
          <div className="grid grid-cols-2 gap-4">
            {/* Brand Audit */}
            <button
              onClick={() => router.push(`/projects/${projectId}/brand-audit`)}
              className="group text-left p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" />
                  Point-in-time
                </div>
              </div>

              <h2 className="font-semibold text-base mb-1">Brand Audit</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Run on demand. Paste any content pieces — ads, emails, social posts, landing pages — and get a
                consistency score against your brand core. Identifies off-brand language, tone mismatches, and
                specific copy fixes.
              </p>

              <div className="space-y-1.5">
                {[
                  'Score content against your Brand Core',
                  'Identify off-brand tone and language',
                  'Get specific copy rewrites',
                  'Batch audit up to 10 pieces at once',
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-1 h-1 rounded-full bg-orange-500 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-2 transition-all">
                Open Brand Audit <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Brand Health */}
            <button
              onClick={() => router.push(`/projects/${projectId}/brand-health`)}
              className="group text-left p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <RefreshCw className="w-3 h-3" />
                  Ongoing monitoring
                </div>
              </div>

              <h2 className="font-semibold text-base mb-1">Brand Health</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Continuous tracking. Score any piece of content against your brand voice in real time and check
                how far your published content has drifted from your brand guidelines over time. Use this before
                every publish.
              </p>

              <div className="space-y-1.5">
                {[
                  'Real-time brand voice scoring',
                  'Brand drift detection over time',
                  'Compare against competitor content',
                  'Alerts when content goes off-brand',
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-2 transition-all">
                Open Brand Health <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>

          {/* When to use each */}
          <div className="p-5 rounded-xl border border-border bg-muted/30 space-y-3">
            <p className="text-sm font-semibold">When to use each</p>
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div className="space-y-2">
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-orange-500" /> Brand Audit
                </p>
                <p>→ Before launching a new campaign</p>
                <p>→ When onboarding a new agency or writer</p>
                <p>→ Quarterly brand consistency review</p>
                <p>→ After a rebrand — check all existing assets</p>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Brand Health
                </p>
                <p>→ Before every piece of content you publish</p>
                <p>→ Weekly review of your content library</p>
                <p>→ When testing if AI-generated content is on-brand</p>
                <p>→ Tracking brand voice consistency over months</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
