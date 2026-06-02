'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Layout, ArrowRight, CheckCircle2, AlertCircle, ExternalLink,
  BarChart2, Search, Loader2, X, Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import { SidebarToggle } from '@/components/layout/sidebar'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GA4Status {
  configured: boolean
  property_id: string | null
  connected: boolean
}

interface GSCStatusData {
  connected: boolean
  domain: string | null
  last_synced: string | null
}

// ---------------------------------------------------------------------------
// GA4 Card
// ---------------------------------------------------------------------------

function GA4Card({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<GA4Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [propertyInput, setPropertyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [showInput, setShowInput] = useState(false)

  useEffect(() => {
    api.integrations.ga4Status(projectId)
      .then(setStatus)
      .catch(() => setStatus({ configured: false, property_id: null, connected: false }))
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleSave() {
    if (!propertyInput.trim()) return
    setSaving(true)
    try {
      await api.integrations.setGA4Property(projectId, propertyInput.trim())
      setStatus((s) => s ? { ...s, property_id: propertyInput.trim(), connected: s.configured } : s)
      setShowInput(false)
      setPropertyInput('')
      toast.success('GA4 property saved')
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    try {
      await api.integrations.clearGA4Property(projectId)
      setStatus((s) => s ? { ...s, property_id: null, connected: false } : s)
      toast.success('GA4 property removed')
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  const isConnected = status?.connected
  const isConfigured = status?.configured

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start gap-4">
        <div className={cn(
          'p-2.5 rounded-xl shrink-0',
          isConnected ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground',
        )}>
          <BarChart2 className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">Google Analytics 4</p>
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            ) : isConnected ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Not connected
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Pull live sessions, traffic sources, and top-pages data directly from your GA4 property into Leo analytics.
          </p>
        </div>
      </div>

      {!loading && !isConfigured && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
            <p className="font-medium">Service account not configured</p>
            <p>Ask your administrator to set <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">GA4_SERVICE_ACCOUNT_KEY</code> in the server environment.</p>
          </div>
        </div>
      )}

      {!loading && isConfigured && (
        <div className="space-y-2">
          {isConnected ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <span className="text-xs font-mono text-green-800 dark:text-green-300 truncate">
                  Property {status?.property_id}
                </span>
              </div>
              <button
                onClick={handleDisconnect}
                className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                title="Remove property"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : showInput ? (
            <div className="flex gap-2">
              <input
                value={propertyInput}
                onChange={(e) => setPropertyInput(e.target.value.replace(/\D/g, ''))}
                placeholder="GA4 Property ID (e.g. 123456789)"
                className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              />
              <button
                onClick={handleSave}
                disabled={saving || !propertyInput.trim()}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
              <button
                onClick={() => { setShowInput(false); setPropertyInput('') }}
                className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowInput(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" /> Enter Property ID
              </button>
              <a
                href="https://analytics.google.com/analytics/web/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Open GA4 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {!isConnected && !showInput && (
            <p className="text-[11px] text-muted-foreground">
              Find your Property ID in GA4 → Admin → Property Settings. Grant the Leo service account email Viewer access.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GSC Card
// ---------------------------------------------------------------------------

function GSCCard({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<GSCStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    api.integrations.gscStatus(projectId)
      .then((s) => setStatus({ connected: s.connected, domain: s.domain, last_synced: s.last_synced }))
      .catch(() => setStatus({ connected: false, domain: null, last_synced: null }))
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleConnect() {
    try {
      const { auth_url } = await api.blog.getGSCAuthUrl(projectId)
      window.location.href = auth_url
    } catch {
      toast.error('Failed to start Google authorisation')
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await api.blog.disconnectGSC(projectId)
      setStatus({ connected: false })
      toast.success('Google Search Console disconnected')
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start gap-4">
        <div className={cn(
          'p-2.5 rounded-xl shrink-0',
          status?.connected ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground',
        )}>
          <Search className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">Google Search Console</p>
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            ) : status?.connected ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Not connected
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Access real keyword rankings, click-through rates, and impression data from Google's own index for your verified domains.
          </p>
        </div>
      </div>

      {!loading && status?.connected && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-green-800 dark:text-green-300 truncate">
              {status.domain ?? 'Connected'}
            </p>
            {status.last_synced && (
              <p className="text-[11px] text-green-700 dark:text-green-400 mt-0.5">
                Last synced {new Date(status.last_synced).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="shrink-0 text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
          >
            {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            Disconnect
          </button>
        </div>
      )}

      {!loading && !status?.connected && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleConnect}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" /> Connect with Google
          </button>
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Open GSC <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const gscConnected = searchParams.get('gsc_connected')
    const gscError = searchParams.get('gsc_error')
    if (gscConnected) {
      toast.success('Google Search Console connected!')
      router.replace(`/projects/${projectId}/settings/integrations`)
    } else if (gscError) {
      toast.error('Google Search Console connection failed')
      router.replace(`/projects/${projectId}/settings/integrations`)
    }
  }, [searchParams, projectId, router])

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
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Analytics */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Analytics</p>
            <div className="space-y-3">
              <GA4Card projectId={projectId} />
              <GSCCard projectId={projectId} />
            </div>
          </div>

          {/* Publishing */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Publishing</p>
            <button
              onClick={() => router.push(`/projects/${projectId}/settings/integrations/wordpress`)}
              className="group w-full text-left p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                  <Layout className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">WordPress</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Publish content directly to your WordPress site. Supports custom post types, categories, and SEO meta fields.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          </div>

          <p className="text-xs text-muted-foreground text-center pt-2">
            More integrations — Webflow, HubSpot, Shopify — coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}
