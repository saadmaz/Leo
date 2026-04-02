'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const MODULE_META: Record<string, { icon: string; subtitle: string; description: string }> = {
  A: {
    icon: '🎯',
    subtitle: 'Identity & Positioning',
    description: "Let's start with who you are and what you stand for. This module defines the foundation of your personal brand.",
  },
  B: {
    icon: '📖',
    subtitle: 'Story & Expertise',
    description: "Your story is your most powerful differentiator. We'll capture your origin, achievements, and what you know better than anyone.",
  },
  C: {
    icon: '🎙️',
    subtitle: 'Voice & Tone',
    description: "Your voice is what makes content feel unmistakably like you. We'll define how you naturally communicate and what to avoid.",
  },
  D: {
    icon: '🚀',
    subtitle: 'Goals & Platforms',
    description: "Where do you want to show up and why? This module sets the strategic direction and platform focus for your brand.",
  },
  E: {
    icon: '🔍',
    subtitle: 'Competitive Landscape',
    description: "Understanding who's already in your space helps us find your unique angle and the gaps you can own.",
  },
}

interface InterviewModuleIntroProps {
  moduleKey: string
  questionCount: number
  onStart: () => void
}

export function InterviewModuleIntro({ moduleKey, questionCount, onStart }: InterviewModuleIntroProps) {
  const [countdown, setCountdown] = useState(5)
  const meta = MODULE_META[moduleKey] ?? { icon: '📋', subtitle: 'Module ' + moduleKey, description: '' }

  useEffect(() => {
    if (countdown <= 0) { onStart(); return }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, onStart])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md mx-auto rounded-2xl border border-border bg-card p-8 text-center space-y-4"
    >
      <div className="text-4xl">{meta.icon}</div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-primary uppercase tracking-widest">Module {moduleKey}</p>
        <h2 className="text-xl font-bold text-foreground">{meta.subtitle}</h2>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{meta.description}</p>
      <p className="text-xs text-muted-foreground">{questionCount} questions in this module</p>
      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Start this module
        <ArrowRight className="w-4 h-4" />
      </button>
      <p className="text-[11px] text-muted-foreground">Auto-continuing in {countdown}s</p>
    </motion.div>
  )
}
