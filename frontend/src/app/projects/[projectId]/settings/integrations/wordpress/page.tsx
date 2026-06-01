'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Globe, Plus, Trash2, CheckCircle, Loader2, ExternalLink, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { api, type CMSConnection } from '@/lib/api'
import { SidebarToggle } from '@/components/layout/sidebar'

export default function WordPressIntegrationsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [connections, setConnections] = useState<CMSConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [siteUrl, setSiteUrl] = useState('')
  const [username, setUsername] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    api.blog.listCMSConnections(projectId).then((res) => {
      setConnections(res.connections)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [projectId])

  async function handleConnect() {
    if (!siteUrl.trim() || !username.trim() || !appPassword.trim()) {
      toast.error('All fields are required')
      return
    }
    setConnecting(true)
    try {
      const conn = await api.blog.addCMSConnection(projectId, {
        site_url: siteUrl.trim(),
        username: username.trim(),
        app_password: appPassword.trim(),
      })
      setConnections((prev) => [...prev, conn])
      setSiteUrl('')
      setUsername('')
      setAppPassword('')
      setShowForm(false)
      toast.success(`Connected to ${conn.site_name || conn.site_url}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await api.blog.removeCMSConnection(projectId, id)
      setConnections((prev) => prev.filter((c) => c.id !== id))
      toast.success('Connection removed')
    } catch {
      toast.error('Failed to remove connection')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <div className="text-primary"><Settings className="w-5 h-5" /></div>
        <div>
          <h1 className="font-semibold text-sm">WordPress Integration</h1>
          <p className="text-xs text-muted-foreground">Publish blog drafts directly to WordPress</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl mx-auto w-full">

        {/* How it works */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <p className="text-sm font-semibold">Setup Instructions</p>
          <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
            <li>Log into your WordPress dashboard</li>
            <li>
              Go to <strong className="text-foreground">Users → Profile → Application Passwords</strong>
            </li>
            <li>Enter a name (e.g. &ldquo;Leo&rdquo;) and click <strong className="text-foreground">Add New Application Password</strong></li>
            <li>Copy the generated password — it only shows once</li>
            <li>Paste your site URL, WordPress username, and the application password below</li>
          </ol>
          <a
            href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary flex items-center gap-1 hover:underline"
          >
            WordPress Application Passwords guide <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Existing connections */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading connections…
          </div>
        ) : (
          <>
            {connections.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Connected Sites</p>
                {connections.map((conn) => (
                  <div key={conn.id} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
                    <Globe className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conn.site_name || conn.site_url}</p>
                      <p className="text-xs text-muted-foreground truncate">{conn.site_url}</p>
                      <p className="text-xs text-muted-foreground">User: {conn.username}</p>
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    <button
                      onClick={() => handleDelete(conn.id)}
                      disabled={deletingId === conn.id}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive disabled:opacity-50"
                    >
                      {deletingId === conn.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors w-full justify-center"
              >
                <Plus className="w-4 h-4" />
                Connect WordPress Site
              </button>
            ) : (
              <div className="p-5 rounded-xl border border-border bg-card space-y-4">
                <p className="text-sm font-semibold">Connect WordPress Site</p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Site URL</label>
                    <input
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                      placeholder="https://yourblog.com"
                      className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WordPress Username</label>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Application Password</label>
                    <input
                      type="password"
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                      className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Generated in WP Admin → Users → Profile → Application Passwords
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {connecting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Testing connection…</>
                    ) : (
                      'Connect'
                    )}
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
