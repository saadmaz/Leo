'use client'

import { CheckCircle2, Clock, AlertCircle, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Pillar1Doc } from '@/types'

interface DocumentCardProps {
  doc: Pillar1Doc
  onClick?: () => void
  className?: string
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export function DocumentCard({ doc, onClick, className }: DocumentCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{doc.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(doc.created_at)}</p>
          </div>
        </div>
        <StatusBadge status={doc.status} />
      </div>
      {doc.credits_spent > 0 && (
        <p className="text-xs text-muted-foreground mt-2">{doc.credits_spent} credits used</p>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Pillar1Doc['status'] }) {
  if (status === 'complete') return (
    <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
      <CheckCircle2 className="w-3 h-3" /> Done
    </span>
  )
  if (status === 'draft') return (
    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
      <Clock className="w-3 h-3" /> Draft
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">
      <AlertCircle className="w-3 h-3" /> Error
    </span>
  )
}
