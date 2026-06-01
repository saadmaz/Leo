'use client'

import { useParams, useRouter } from 'next/navigation'
import { Globe, ArrowRight, Layout } from 'lucide-react'
import { SidebarToggle } from '@/components/layout/sidebar'

const INTEGRATIONS = [
  {
    id: 'wordpress',
    label: 'WordPress',
    description: 'Publish content directly to your WordPress site. Supports custom post types, categories, and SEO meta fields.',
    icon: <Layout className="w-6 h-6" />,
    href: (projectId: string) => `/projects/${projectId}/settings/integrations/wordpress`,
    available: true,
  },
]

export default function IntegrationsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <div>
          <h1 className="font-semibold">Integrations</h1>
          <p className="text-xs text-muted-foreground">Connect Leo to your publishing and marketing stack</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-3">
          {INTEGRATIONS.map((integration) => (
            <button
              key={integration.id}
              onClick={() => router.push(integration.href(projectId))}
              disabled={!integration.available}
              className="group w-full text-left p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                  {integration.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-sm">{integration.label}</p>
                    {!integration.available && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 bg-muted rounded px-1.5 py-px">
                        soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{integration.description}</p>
                </div>
                {integration.available && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                )}
              </div>
            </button>
          ))}

          <p className="text-xs text-muted-foreground text-center pt-4">
            More integrations — Webflow, HubSpot, Shopify — coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}
