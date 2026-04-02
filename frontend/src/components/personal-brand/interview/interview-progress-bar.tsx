'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const MODULES = [
  { key: 'A', label: 'Identity' },
  { key: 'B', label: 'Story' },
  { key: 'C', label: 'Voice' },
  { key: 'D', label: 'Goals' },
  { key: 'E', label: 'Landscape' },
]

interface InterviewProgressBarProps {
  currentModule: string
  answeredCount: number
  totalCount: number
}

export function InterviewProgressBar({
  currentModule,
  answeredCount,
  totalCount,
}: InterviewProgressBarProps) {
  const pct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0
  const currentIdx = MODULES.findIndex((m) => m.key === currentModule)

  return (
    <div className="w-full space-y-3">
      {/* Module dots */}
      <div className="flex items-center justify-center gap-0">
        {MODULES.map((mod, i) => {
          const isDone = i < currentIdx
          const isActive = mod.key === currentModule
          return (
            <div key={mod.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all',
                    isDone && 'bg-primary border-primary text-primary-foreground',
                    isActive && 'bg-primary/10 border-primary text-primary',
                    !isDone && !isActive && 'bg-muted border-border text-muted-foreground',
                  )}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : mod.key}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium transition-colors',
                    isActive ? 'text-primary' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/50',
                  )}
                >
                  {mod.label}
                </span>
              </div>
              {i < MODULES.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-10 mx-1 mb-4 rounded-full transition-colors',
                    i < currentIdx ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Fill bar */}
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        {answeredCount} of {totalCount} questions answered
      </p>
    </div>
  )
}
