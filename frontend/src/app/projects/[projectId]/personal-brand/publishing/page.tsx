'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Loader2, ExternalLink, CheckCircle2, XCircle, RefreshCw,
  Link2, Share2, Twitter, Linkedin, Instagram,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'
import { BackButton } from '@/components/layout/back-button'
import type { ConnectedPlatform } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  linkedin:  { label: 'LinkedIn',   color: 'bg-blue-700',     icon: <Linkedin className="w-4 h-4" /> },
  twitter:   { label: 'Twitter/X',  color: 'bg-neutral-700',  icon: <Twitter className="w-4 h-4" /> },
  instagram: { label: 'Instagram',  color: 'bg-pink-600',     icon: <Instagram className="w-4 h-4" /> },
  facebook:  { label: 'Facebook',   color: 'bg-blue-600',     icon: <Share2 className="w-4 h-4" /> },
  tiktok:    { label: 'TikTok',     color: 'bg-neutral-900',  icon: <Share2 className="w-4 h-4" /> },
  youtube:   { label: 'YouTube',    color: 'bg-red-600',      icon: <Share2 className="w-4 h-4" /> },
  threads:   { label: 'Threads',    color: 'bg-neutral-800',  icon: <Share2 className="w-4 h-4" /> },
  pinterest: { label: 'Pinterest',  color: 'bg-red-500',      icon: <Share2 className="w-4 h-4" /> },
  reddit:    { label: 'Reddit',     color: 'bg-orange-600',   icon: <Share2 className="w-4 h-4" /> },
}

const ALL_PLATFORMS = Object.keys(PLATFORM_META)

// ---------------------------------------------------------------------------
// Platform card
// ---------------------------------------------------------------------------

function PlatformCard({
  platform,
  connected,
  onConnect,
  connecting,
}: {
  platform: string
  connected: ConnectedPlatform | undefined
  onConnect: (platform: string) => void
  connecting: boolean
}) {
  const meta = PLATFORM_META[platform] ?? { label: platform, color: 'bg-muted', icon: <Share2 className="w-4 h-4" /> }

  return (
    <div className={cn(
      'rounded-xl border border-border bg-card p-4 flex items-center gap-4',
      connected ? 'border-green-500/30 bg-green-500/5' : '',
    )}>
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0', meta.color)}>
        {meta.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{meta.label}</p>
        {connected ? (
          <p className="text-xs text-muted-foreground truncate">@{connected.username || connected.displayName}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Not connected</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {connected ? (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connected
          </span>
        ) : (
          <button
            onClick={() => onConnect(platform)}
            disabled={connecting}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            Connect
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PublishingPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId

  const [connected, setConnected] = useState<ConnectedPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.persona.getPublishingProfile(projectId)
      setConnected(data.connectedPlatforms)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load publishing profile')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function handleConnect(platform: string) {
    setConnecting(platform)
    try {
      const data = await api.persona.getConnectUrl(projectId, platform)
      const url = (data as Record<string, string>).url || (data as Record<string, string>).generateJWT
      if (url) {
        const win = window.open(url, '_blank', 'width=600,height=700')
        // Poll until window closes, then refresh
        const poll = setInterval(() => {
          if (win?.closed) {
            clearInterval(poll)
            setRefreshing(true)
            load()
          }
        }, 1000)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not generate connect URL')
    } finally {
      setConnecting(null)
    }
  }

  function handleRefresh() {
    setRefreshing(true)
    load()
  }

  const connectedMap = Object.fromEntries(connected.map((c) => [c.platform, c]))

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <SidebarToggle />
        <BackButton />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-foreground leading-tight">Publishing</h1>
          <p className="text-xs text-muted-foreground">Connect your social accounts to publish directly</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-2xl font-bold text-foreground">{connected.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Connected platforms</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-2xl font-bold text-foreground">{ALL_PLATFORMS.length - connected.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Available to connect</p>
              </div>
            </div>

            {/* Connected */}
            {connected.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3">Connected accounts</h2>
                <div className="space-y-2">
                  {connected.map((c) => (
                    <PlatformCard
                      key={c.platform}
                      platform={c.platform}
                      connected={c}
                      onConnect={handleConnect}
                      connecting={connecting === c.platform}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Available */}
            <section>
              <h2 className="text-sm font-semibold text-foreground mb-3">
                {connected.length > 0 ? 'Add more platforms' : 'Connect a platform to get started'}
              </h2>
              <div className="space-y-2">
                {ALL_PLATFORMS.filter((p) => !connectedMap[p]).map((p) => (
                  <PlatformCard
                    key={p}
                    platform={p}
                    connected={undefined}
                    onConnect={handleConnect}
                    connecting={connecting === p}
                  />
                ))}
              </div>
            </section>

            {/* Help note */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">How it works:</strong> Click "Connect" to open the platform's auth page.
                Once you approve access, your account will appear here. Posts generated in the Content Engine can then be published
                or scheduled directly from that page.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
