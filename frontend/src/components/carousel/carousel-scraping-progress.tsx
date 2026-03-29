'use client'

import { motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'

interface ScrapingStep {
  message: string
  done: boolean
}

interface CarouselScrapingProgressProps {
  steps: ScrapingStep[]
}

export function CarouselScrapingProgress({ steps }: CarouselScrapingProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 space-y-2 w-full max-w-sm"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-3">
        Building Brand Profile
      </p>
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2.5">
          {step.done ? (
            <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Check className="w-2.5 h-2.5 text-primary" />
            </div>
          ) : (
            <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
          )}
          <span className={`text-sm ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {step.message}
          </span>
        </div>
      ))}
    </motion.div>
  )
}
