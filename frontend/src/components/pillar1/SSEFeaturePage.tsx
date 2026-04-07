'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { SidebarToggle } from '@/components/layout/sidebar'
import { SSEProgressPanel } from './SSEProgressPanel'
import { cn } from '@/lib/utils'
import type { ProgressStep } from '@/types'

interface SSEFeaturePageProps {
  projectId: string
  title: string
  subtitle: string
  icon: ReactNode
  credits: number
  steps: ProgressStep[]
  isStreaming: boolean
  streamText: string
  form: ReactNode
  result: ReactNode
  onSubmit: () => void
  submitLabel: string
  canSubmit: boolean
  className?: string
}

export function SSEFeaturePage({
  projectId,
  title,
  subtitle,
  icon,
  credits,
  steps,
  isStreaming,
  streamText,
  form,
  result,
  onSubmit,
  submitLabel,
  canSubmit,
  className,
}: SSEFeaturePageProps) {
  const router = useRouter()

  return (
    <div className={cn('flex flex-col flex-1 overflow-hidden', className)}>
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <SidebarToggle />
        <button
          onClick={() => router.push(`/projects/${projectId}/strategy`)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-primary">{icon}</div>
        <div>
          <h1 className="font-semibold">{title}</h1>
          <p className="text-xs text-muted-foreground">{subtitle} · {credits} credits</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Form card */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            {form}
            <button
              onClick={onSubmit}
              disabled={isStreaming || !canSubmit}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {isStreaming
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
                : submitLabel}
            </button>
          </div>

          {/* Progress steps */}
          {steps.length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <SSEProgressPanel steps={steps} />
            </div>
          )}

          {/* Streaming text */}
          {isStreaming && streamText && (
            <div className="p-4 rounded-xl border border-border bg-muted/30">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                {streamText}
                <span className="inline-block w-1 h-3.5 bg-foreground ml-0.5 animate-pulse" />
              </pre>
            </div>
          )}

          {/* Result */}
          {result}
        </div>
      </div>
    </div>
  )
}
