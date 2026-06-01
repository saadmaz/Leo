'use client'

import { CheckCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NLPTermTrackerProps {
  terms: string[]
  coveredTerms: Set<string>
  className?: string
}

export function NLPTermTracker({ terms, coveredTerms, className }: NLPTermTrackerProps) {
  if (terms.length === 0) return null

  const covered = terms.filter((t) => coveredTerms.has(t.toLowerCase()))
  const missing = terms.filter((t) => !coveredTerms.has(t.toLowerCase()))
  const pct = Math.round((covered.length / terms.length) * 100)

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold">NLP Coverage</p>
          <span className={cn(
            'text-xs font-mono font-bold',
            pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-amber-500' : 'text-muted-foreground',
          )}>
            {pct}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-muted-foreground',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {covered.length}/{terms.length} terms covered
        </p>
      </div>

      <div className="p-3 space-y-1 max-h-48 overflow-y-auto">
        {terms.map((term) => {
          const isCovered = coveredTerms.has(term.toLowerCase())
          return (
            <div key={term} className="flex items-center gap-2">
              {isCovered ? (
                <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
              ) : (
                <Circle className="w-3 h-3 text-muted-foreground/40 shrink-0" />
              )}
              <span className={cn(
                'text-xs',
                isCovered ? 'text-foreground line-through decoration-green-500/40' : 'text-muted-foreground',
              )}>
                {term}
              </span>
            </div>
          )
        })}
      </div>

      {missing.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-amber-50 dark:bg-amber-900/20">
          <p className="text-[10px] text-amber-700 dark:text-amber-400">
            Missing: {missing.slice(0, 5).join(', ')}{missing.length > 5 ? ` +${missing.length - 5} more` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
