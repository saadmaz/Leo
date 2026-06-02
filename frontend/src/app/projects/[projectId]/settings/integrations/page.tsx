'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Layout, ArrowRight, CheckCircle2, AlertCircle, ExternalLink,
  BarChart2, Search, Loader2, X, Link2, RefreshCw, Zap, Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import { SidebarToggle } from '@/components/layout/sidebar'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GA4StatusData {
  connected: boolean
  property_id: string | null
  last_synced: string | null
}

interface GSCStatusData {
  connected: boolean
  domain: string | null
  last_synced: string | null
}

// ---------------------------------------------------------------------------
// GA4 Card — per-user OAuth
// ---------------------------------------------------------------------------

function GA4Card({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<GA4StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [propertyInput, setPropertyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPropertyInput, setShowPropertyInput] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  function loadStatus() {
    setLoading(true)
    api.ga4.status(projectId)
      .then(setStatus)
      .catch(() => setStatus({ connected: false, property_id: null, last_synced: null }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadStatus() }, [projectId])

  async function handleConnect() {
    if (!window) return
    try {
      // Build the canonical callback URL — proxied through Next.js rewrite
      const redirectUri = `${window.location.origin}/api/backend/auth/ga4/callback`
      const { url } = await api.ga4.authUrl(projectId, redirectUri)
      window.location.href = url   // same-tab redirect — required by GA4 OAuth
    } catch {
      toast.error('Failed to start Google authorisation')
    }
  }

  async function handleSaveProperty() {
    if (!propertyInput.trim()) return
    setSaving(true)
    try {
      await api.ga4.saveProperty(projectId, propertyInput.trim())
      setStatus((s) => s ? { ...s, property_id: propertyInput.trim() } : s)
      setShowPropertyInput(false)
      setPropertyInput('')
      toast.success('GA4 property saved')
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await api.ga4.disconnect(projectId)
      setStatus({ connected: false, property_id: null, last_synced: null })
      toast.success('Google Analytics 4 disconnected')
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleRefreshCache() {
    try {
      const { cleared } = await api.ga4.refreshCache(projectId)
      toast.success(`Cache cleared — ${cleared} entries removed`)
    } catch {
      toast.error('Failed to clear cache')
    }
  }

  const isConnected = status?.connected
  const hasProperty = Boolean(status?.property_id)

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start gap-4">
        <div className={cn(
          'p-2.5 rounded-xl shrink-0',
          isConnected && hasProperty
            ? 'bg-green-500/10 text-green-600'
            : isConnected
            ? 'bg-amber-500/10 text-amber-600'
            : 'bg-muted text-muted-foreground',
        )}>
          <BarChart2 className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">Google Analytics 4</p>
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            ) : isConnected && hasProperty ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            ) : isConnected ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3" /> Property needed
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Not connected
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Live session data, traffic sources, and conversion events from your GA4 property.
          </p>
        </div>
      </div>

      {/* Connected + property set */}
      {!loading && isConnected && hasProperty && (
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-green-800 dark:text-green-300">
                Property {status?.property_id}
              </p>
              {status?.last_synced && (
                <p className="text-[11px] text-green-700 dark:text-green-400 mt-0.5">
                  Connected {new Date(status.last_synced).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRefreshCache}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                title="Clear 6h data cache"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                title="Disconnect"
              >
                {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connected but no property set yet */}
      {!loading && isConnected && !hasProperty && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Google account connected</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
              Enter your GA4 Property ID to start pulling live data.
            </p>
          </div>

          {showPropertyInput ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={propertyInput}
                  onChange={(e) => setPropertyInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Property ID (e.g. 123456789)"
                  className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProperty() }}
                />
                <button
                  onClick={handleSaveProperty}
                  disabled={saving || !propertyInput.trim()}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
                <button
                  onClick={() => { setShowPropertyInput(false); setPropertyInput('') }}
                  className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Find in GA4 → Admin → Property Settings → Property ID.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPropertyInput(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" /> Enter Property ID
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      )}

      {/* Not connected */}
      {!loading && !isConnected && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleConnect}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" /> Connect Google Analytics 4
          </button>
          <a
            href="https://analytics.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Open GA4 <ExternalLink className="w-3 h-3" />
          </a>
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
      setStatus({ connected: false, domain: null, last_synced: null })
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
            Keyword rankings, impressions, and click data from Google&apos;s own index.
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
// Leo Analytics Tag Card
// ---------------------------------------------------------------------------

function LeoTagCard({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<{ enabled: boolean; token: string | null; pageviews_7d: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [enabling, setEnabling] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.tracking.status(projectId)
      .then((s) => setStatus({ enabled: s.enabled, token: s.token, pageviews_7d: s.pageviews_7d }))
      .catch(() => setStatus({ enabled: false, token: null, pageviews_7d: 0 }))
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleEnable() {
    setEnabling(true)
    try {
      const { token } = await api.tracking.enable(projectId)
      setStatus({ enabled: true, token, pageviews_7d: 0 })
      toast.success('Leo Analytics enabled!')
    } catch (err) {
      toast.error(String(err))
    } finally {
      setEnabling(false)
    }
  }

  async function handleDisable() {
    setDisabling(true)
    try {
      await api.tracking.disable(projectId)
      setStatus((s) => s ? { ...s, enabled: false } : s)
      toast.success('Leo Analytics disabled')
    } catch {
      toast.error('Failed to disable')
    } finally {
      setDisabling(false)
    }
  }

  function handleCopySnippet() {
    if (!status?.token) return
    const snippet = `<script src="${window.location.origin}/api/backend/track.js" data-token="${status.token}" async></script>`
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start gap-4">
        <div className={cn(
          'p-2.5 rounded-xl shrink-0',
          status?.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}>
          <Zap className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">Leo Analytics Tag</p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">Premium</span>
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            ) : status?.enabled ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Active
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Not enabled
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            First-party, cookieless analytics for your website. Better than GA — AI-powered insights, no consent banners required.
          </p>
        </div>
      </div>

      {!loading && status?.enabled && status.token && (
        <div className="space-y-3">
          {/* Stats row */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Last 7 days</p>
              <p className="text-lg font-bold tabular-nums">{status.pageviews_7d.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">pageviews</p>
            </div>
            <div className="flex-1" />
            <button
              onClick={handleDisable}
              disabled={disabling}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
            >
              {disabling ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              Disable
            </button>
          </div>

          {/* Embed snippet */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Embed Code</p>
            <p className="text-[11px] text-muted-foreground">Add this to the <code className="text-[10px] bg-muted px-1 py-0.5 rounded">&lt;head&gt;</code> of every page you want to track.</p>
            <div className="relative">
              <code className="block text-[10px] font-mono bg-muted/50 border border-border rounded-lg px-3 py-2 overflow-x-auto pr-8 text-muted-foreground">
                {`<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/api/backend/track.js"\n  data-token="${status.token}" async></script>`}
              </code>
              <button
                onClick={handleCopySnippet}
                className="absolute top-2 right-2 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Copy snippet"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !status?.enabled && (
        <button
          onClick={handleEnable}
          disabled={enabling}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {enabling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Enable Leo Analytics
        </button>
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
    const connected = searchParams.get('connected')
    const gscConnected = searchParams.get('gsc_connected')
    const gscError = searchParams.get('gsc_error')
    const ga4Error = searchParams.get('ga4_error')

    if (connected === 'ga4') {
      toast.success('Google Analytics 4 connected! Enter your Property ID below.')
      router.replace(`/projects/${projectId}/settings/integrations`)
    } else if (gscConnected) {
      toast.success('Google Search Console connected!')
      router.replace(`/projects/${projectId}/settings/integrations`)
    } else if (gscError) {
      toast.error('Google Search Console connection failed')
      router.replace(`/projects/${projectId}/settings/integrations`)
    } else if (ga4Error) {
      toast.error('Google Analytics 4 connection failed')
      router.replace(`/projects/${projectId}/settings/integrations`)
    }
  }, [searchParams, projectId, router])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <div>
          <h1 className="font-semibold">Integrations</h1>
          <p className="text-xs text-muted-foreground">Connect Leo to your analytics and publishing stack</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Leo Analytics (first-party) */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">First-Party Analytics</p>
            <LeoTagCard projectId={projectId} />
          </div>

          {/* Third-party Analytics */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Google Analytics</p>
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
