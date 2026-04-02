'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import type { PersonalCore } from '@/types'

const STEPS = [
  'Analysing your answers…',
  'Building your identity profile…',
  'Discovering your voice…',
  'Mapping your content strategy…',
  'Finalising your Personal Core…',
]

interface InterviewExtractionProgressProps {
  projectId: string
  onDone: (core: PersonalCore) => void
  onError?: (message: string) => void
}

export function InterviewExtractionProgress({
  projectId,
  onDone,
  onError,
}: InterviewExtractionProgressProps) {
  const { setPersonalCore } = useAppStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [pct, setPct] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    api.persona.streamExtract(projectId, {
      onStep: (label, status) => {
        if (status === 'running') {
          const idx = STEPS.findIndex((s) => s.toLowerCase().includes(label.toLowerCase().slice(0, 10)))
          if (idx >= 0) setCurrentStep(idx)
        }
        if (status === 'done') {
          setCompletedSteps((prev) => {
            const idx = STEPS.findIndex((s) => s.toLowerCase().includes(label.toLowerCase().slice(0, 10)))
            return idx >= 0 && !prev.includes(idx) ? [...prev, idx] : prev
          })
        }
      },
      onProgress: (p) => setPct(p),
      onDone: (core) => {
        setCompletedSteps([0, 1, 2, 3, 4])
        setPct(100)
        setDone(true)
        setPersonalCore(core)
        setTimeout(() => onDone(core), 1200)
      },
      onError: (msg) => {
        setError(msg)
        onError?.(msg)
      },
    })
  }, [projectId, onDone, onError, setPersonalCore])

  if (error) {
    return (
      <div className="w-full max-w-md mx-auto text-center space-y-4 p-8">
        <div className="text-4xl">⚠️</div>
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground">Please try again or contact support.</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-md mx-auto space-y-8 p-8"
    >
      {/* Icon */}
      <div className="flex justify-center">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </motion.div>
          ) : (
            <motion.div key="loading" className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Title */}
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold text-foreground">
          {done ? 'Your Personal Core is ready' : 'Building your Personal Core…'}
        </h2>
        {!done && (
          <p className="text-sm text-muted-foreground">This takes about 20 seconds</p>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const isDone = completedSteps.includes(i)
          const isActive = currentStep === i && !isDone
          return (
            <div key={step} className="flex items-center gap-3">
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-border" />
                )}
              </div>
              <span
                className={`text-sm ${
                  isDone ? 'text-foreground' : isActive ? 'text-foreground font-medium' : 'text-muted-foreground/50'
                }`}
              >
                {step}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </motion.div>
  )
}
