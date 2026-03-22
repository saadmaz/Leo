'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { BrandVoiceScorer } from './brand-voice-scorer'

interface BrandVoiceScorerPanelProps {
  projectId: string
}

export function BrandVoiceScorerPanel({ projectId }: BrandVoiceScorerPanelProps) {
  const { brandVoiceScorerOpen, setBrandVoiceScorerOpen } = useAppStore()

  return (
    <AnimatePresence>
      {brandVoiceScorerOpen && (
        <motion.div
          key="brand-voice-scorer"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="fixed inset-y-0 right-0 w-96 bg-card border-l border-border shadow-xl z-40 flex flex-col"
        >
          <BrandVoiceScorer
            projectId={projectId}
            onClose={() => setBrandVoiceScorerOpen(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
