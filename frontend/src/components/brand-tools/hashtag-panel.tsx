'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X, Hash } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { HashtagResearch } from './hashtag-research'

export function HashtagPanel() {
  const { hashtagPanelOpen, setHashtagPanelOpen, activeProject } = useAppStore()

  if (!activeProject) return null

  return (
    <AnimatePresence>
      {hashtagPanelOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setHashtagPanelOpen(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-background border-l border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Hashtag Research</span>
              </div>
              <button
                onClick={() => setHashtagPanelOpen(false)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <HashtagResearch projectId={activeProject.id} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
