'use client'

import { CheckCircle2, Loader2, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProgressStep {
  step: string
  label: string
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error'
}

interface SSEProgressPanelProps {
  steps: ProgressStep[]
  className?: string
}

export function SSEProgressPanel({ steps, className }: SSEProgressPanelProps) {
  if (steps.length === 0) return null

  return (
    <div className={cn('space-y-2', className)}>
      {steps.map((s) => (
        <div key={s.step} className="flex items-center gap-2.5 text-sm">
          {s.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
          {s.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
          {s.status === 'skipped' && <SkipForward className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          {s.status === 'error' && <span className="w-3.5 h-3.5 shrink-0 text-red-500 font-bold">!</span>}
          {s.status === 'pending' && <span className="w-3.5 h-3.5 shrink-0 rounded-full border border-border" />}
          <span className={cn(
            'text-muted-foreground',
            s.status === 'running' && 'text-foreground font-medium',
            s.status === 'done' && 'text-foreground',
            s.status === 'error' && 'text-red-500',
          )}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}
