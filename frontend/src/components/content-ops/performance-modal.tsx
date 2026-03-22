'use client'

import { useState } from 'react'
import { X, TrendingUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { ContentLibraryItem } from '@/types'

interface Props {
  item: ContentLibraryItem
  projectId: string
  onClose: () => void
  onSaved: () => void
}

export function PerformanceModal({ item, projectId, onClose, onSaved }: Props) {
  const [likes, setLikes] = useState('')
  const [comments, setComments] = useState('')
  const [shares, setShares] = useState('')
  const [reach, setReach] = useState('')
  const [saves, setSaves] = useState('')
  const [engagementRate, setEngagementRate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    try {
      const data: Record<string, number | string> = {}
      if (likes)          data.likes = parseInt(likes)
      if (comments)       data.comments = parseInt(comments)
      if (shares)         data.shares = parseInt(shares)
      if (reach)          data.reach = parseInt(reach)
      if (saves)          data.saves = parseInt(saves)
      if (engagementRate) data.engagement_rate = parseFloat(engagementRate)
      if (notes)          data.notes = notes

      await api.performance.record(projectId, item.id, data)
      toast.success('Performance logged')
      if (data.engagement_rate && (data.engagement_rate as number) >= 3.0) {
        toast.success('High performer! Added to brand memory.', { duration: 4000 })
      }
      onSaved()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Failed to save performance data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-sm font-semibold">Log Performance</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Content preview */}
          <div className="bg-muted/40 rounded-lg p-3 text-xs text-foreground/70 line-clamp-2">
            {item.content}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-3">
            <MetricInput label="Likes" value={likes} onChange={setLikes} placeholder="e.g. 1200" />
            <MetricInput label="Comments" value={comments} onChange={setComments} placeholder="e.g. 45" />
            <MetricInput label="Shares / Reposts" value={shares} onChange={setShares} placeholder="e.g. 30" />
            <MetricInput label="Reach / Impressions" value={reach} onChange={setReach} placeholder="e.g. 8000" />
            <MetricInput label="Saves" value={saves} onChange={setSaves} placeholder="e.g. 200" />
            <MetricInput
              label="Engagement Rate %"
              value={engagementRate}
              onChange={setEngagementRate}
              placeholder="e.g. 4.2"
              isFloat
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What worked? Why did this perform well?"
              rows={2}
              className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Tip */}
          <p className="text-[10px] text-muted-foreground bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
            Content with ≥3% engagement rate is automatically added to LEO&apos;s brand memory as a positive signal.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Performance
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricInput({
  label, value, onChange, placeholder, isFloat = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  isFloat?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      <input
        type="number"
        step={isFloat ? '0.1' : '1'}
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}
