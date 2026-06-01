'use client'

import { CheckCircle, Loader2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BlogH2Section } from '@/lib/api'

interface SectionState {
  status: 'pending' | 'in_progress' | 'complete'
  wordTarget: number
  nlpTermsCovered: string[]
}

interface SectionProgressTrackerProps {
  sections: BlogH2Section[]
  sectionStates: Record<string, SectionState>
  currentSection: string | null
  className?: string
}

export function SectionProgressTracker({
  sections,
  sectionStates,
  currentSection,
  className,
}: SectionProgressTrackerProps) {
  if (sections.length === 0) return null

  const allSections = [
    { heading: 'Introduction', purpose: 'Hook and context', word_target: 175 },
    ...sections,
    { heading: 'Conclusion', purpose: 'Summary and CTA', word_target: 120 },
  ]

  const completedCount = Object.values(sectionStates).filter((s) => s.status === 'complete').length
  const totalCount = allSections.length

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-xs font-semibold">Draft Progress</p>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{totalCount} sections
        </span>
      </div>

      <div className="p-3 space-y-1">
        {allSections.map((section) => {
          const state = sectionStates[section.heading]
          const status = state?.status ?? 'pending'
          const isCurrent = currentSection === section.heading

          return (
            <div
              key={section.heading}
              className={cn(
                'flex items-center gap-2.5 p-2 rounded-lg transition-colors',
                isCurrent && 'bg-primary/5',
                status === 'complete' && !isCurrent && 'opacity-60',
              )}
            >
              {status === 'complete' ? (
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              ) : status === 'in_progress' ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-xs truncate',
                  isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}>
                  {section.heading}
                </p>
                {state?.nlpTermsCovered && state.nlpTermsCovered.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {state.nlpTermsCovered.slice(0, 3).map((t) => (
                      <span key={t} className="text-[9px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                        {t}
                      </span>
                    ))}
                    {state.nlpTermsCovered.length > 3 && (
                      <span className="text-[9px] text-muted-foreground">+{state.nlpTermsCovered.length - 3}</span>
                    )}
                  </div>
                )}
              </div>

              <span className="text-[10px] text-muted-foreground shrink-0">
                ~{section.word_target}w
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
