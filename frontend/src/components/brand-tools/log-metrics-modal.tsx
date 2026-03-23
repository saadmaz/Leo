'use client'

import { useState } from 'react'
import { X, BarChart2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface Props {
  projectId: string
  itemId: string
  platform: string
  onClose: () => void
}

export function LogMetricsModal({ projectId, itemId, platform, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    platform,
    impressions: '',
    reach: '',
    clicks: '',
    likes: '',
    comments: '',
    shares: '',
  })

  function num(v: string) { return parseInt(v || '0', 10) }

  async function save() {
    setSaving(true)
    try {
      await api.analytics.logMetrics(projectId, itemId, {
        platform: form.platform,
        impressions: num(form.impressions),
        reach: num(form.reach),
        clicks: num(form.clicks),
        likes: num(form.likes),
        comments: num(form.comments),
        shares: num(form.shares),
      })
      toast.success('Metrics saved')
      onClose()
    } catch {
      toast.error('Failed to save metrics')
    } finally {
      setSaving(false)
    }
  }

  const fields: { key: keyof typeof form; label: string }[] = [
    { key: 'impressions', label: 'Impressions' },
    { key: 'reach',       label: 'Reach' },
    { key: 'clicks',      label: 'Clicks' },
    { key: 'likes',       label: 'Likes' },
    { key: 'comments',    label: 'Comments' },
    { key: 'shares',      label: 'Shares' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Log Performance Metrics</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {fields.map(({ key, label }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <input
                  type="number"
                  min="0"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="0"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 pb-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Metrics'}
          </button>
        </div>
      </div>
    </div>
  )
}
