'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, Minus } from 'lucide-react'
import type { ResearchStep } from '@/types'

interface ResearchProgressProps {
  steps: ResearchStep[]
}

export function ResearchProgress({ steps }: ResearchProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3 w-full max-w-md"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Researching your industry...</p>
        <span className="text-[11px] text-muted-foreground">~20–30 seconds</span>
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2.5"
            >
              <StatusIcon status={s.status} />
              <span
                className={`text-xs ${
                  s.status === 'done'    ? 'text-foreground' :
                  s.status === 'running' ? 'text-foreground font-medium' :
                                           'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {steps.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Starting research...
        </div>
      )}
    </motion.div>
  )
}

function StatusIcon({ status }: { status: ResearchStep['status'] }) {
  if (status === 'done') {
    return (
      <span className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
        <Check className="w-2.5 h-2.5 text-emerald-500" />
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Loader2 className="w-2.5 h-2.5 text-primary animate-spin" />
      </span>
    )
  }
  return (
    <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center shrink-0">
      <Minus className="w-2.5 h-2.5 text-muted-foreground" />
    </span>
  )
}
