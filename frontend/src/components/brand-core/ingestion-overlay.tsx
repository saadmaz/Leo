'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Globe, Instagram, CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/lib/api'
import type { IngestionStep } from '@/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Main overlay
// ---------------------------------------------------------------------------

export function IngestionOverlay() {
  const {
    ingestionOpen, setIngestionOpen,
    ingestionSteps, ingestionProgress, ingestionRunning,
    addIngestionStep, setIngestionProgress, setIngestionRunning,
    resetIngestion, onIngestionDone,
    activeProject, setBrandCorePanelOpen,
  } = useAppStore()

  const [websiteUrl, setWebsiteUrl] = useState(activeProject?.websiteUrl ?? '')
  const [instagramHandle, setInstagramHandle] = useState(
    activeProject?.instagramUrl
      ? activeProject.instagramUrl.replace(/.*instagram\.com\//, '').replace(/\/$/, '')
      : ''
  )
  const [done, setDone] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Sync pre-fill when the overlay opens for a new project
  useEffect(() => {
    if (ingestionOpen && activeProject) {
      setWebsiteUrl(activeProject.websiteUrl ?? '')
      setInstagramHandle(
        activeProject.instagramUrl
          ? activeProject.instagramUrl.replace(/.*instagram\.com\//, '').replace(/\/$/, '')
          : ''
      )
    }
  }, [ingestionOpen, activeProject?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ingestionOpen || !activeProject) return null

  async function startIngestion() {
    if (!websiteUrl.trim() && !instagramHandle.trim()) return
    if (!activeProject) return

    resetIngestion()
    setDone(false)
    setErrorMsg('')
    setIngestionRunning(true)

    await api.streamIngestion(
      activeProject.id,
      {
        websiteUrl: websiteUrl.trim() || undefined,
        instagramHandle: instagramHandle.trim() || undefined,
      },
      {
        onStep: (step) => addIngestionStep(step),
        onProgress: (pct) => setIngestionProgress(pct),
        onDone: (brandCore) => {
          onIngestionDone(activeProject.id, brandCore)
          setIngestionRunning(false)
          setDone(true)
        },
        onError: (message) => {
          setIngestionRunning(false)
          setErrorMsg(message)
        },
      },
    )
  }

  function handleClose() {
    if (ingestionRunning) return  // don't close mid-stream
    setIngestionOpen(false)
    resetIngestion()
    setWebsiteUrl('')
    setInstagramHandle('')
    setDone(false)
    setErrorMsg('')
  }

  function handleViewBrandCore() {
    handleClose()
    setBrandCorePanelOpen(true)
  }

  const canStart = (websiteUrl.trim() || instagramHandle.trim()) && !ingestionRunning && !done

  return (
    <AnimatePresence>
      {ingestionOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={ingestionRunning ? undefined : handleClose}
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-sm">Build Brand Core</h2>
                </div>
                {!ingestionRunning && (
                  <button
                    onClick={handleClose}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="p-6 space-y-5">
                {/* Input form — hide while running */}
                {!ingestionRunning && !done && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <p className="text-sm text-muted-foreground">
                      Give LEO your brand&apos;s digital presence. It&apos;ll crawl the content
                      and extract your Brand Core automatically.
                    </p>

                    <div className="space-y-3">
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          type="url"
                          placeholder="https://yourbrand.com"
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          className="w-full rounded-xl border border-input bg-background pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                        />
                      </div>

                      <div className="relative">
                        <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="@yourbrand (Instagram handle)"
                          value={instagramHandle}
                          onChange={(e) => setInstagramHandle(e.target.value)}
                          className="w-full rounded-xl border border-input bg-background pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                        />
                      </div>
                    </div>

                    {errorMsg && (
                      <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{errorMsg}</p>
                    )}

                    <button
                      onClick={startIngestion}
                      disabled={!canStart}
                      className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                    >
                      Analyse brand
                    </button>
                  </motion.div>
                )}

                {/* Progress steps */}
                {(ingestionRunning || (done && ingestionSteps.length > 0)) && (
                  <div className="space-y-4">
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        animate={{ width: `${ingestionProgress}%` }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      />
                    </div>

                    {/* Steps list */}
                    <div className="space-y-2.5">
                      <AnimatePresence initial={false}>
                        {ingestionSteps.map((step) => (
                          <motion.div
                            key={step.label}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-start gap-3"
                          >
                            <StepIcon status={step.status} />
                            <div className="min-w-0">
                              <p className={cn(
                                'text-sm',
                                step.status === 'done' && 'text-muted-foreground',
                                step.status === 'error' && 'text-destructive',
                                step.status === 'running' && 'text-foreground font-medium',
                              )}>
                                {step.label}
                              </p>
                              {step.detail && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.detail}</p>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {ingestionRunning && (
                        <motion.div
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Analysing…</span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}

                {/* Success state */}
                {done && !errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 p-4">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Brand Core built</p>
                        <p className="text-xs text-muted-foreground">Your brand intelligence is ready.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleViewBrandCore}
                        className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        View Brand Core
                      </button>
                      <button
                        onClick={handleClose}
                        className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Step icon
// ---------------------------------------------------------------------------

function StepIcon({ status }: { status: IngestionStep['status'] }) {
  if (status === 'done') return <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
  if (status === 'error') return <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
  if (status === 'running') return <Loader2 className="w-4 h-4 text-primary shrink-0 animate-spin mt-0.5" />
  return <div className="w-4 h-4 rounded-full border border-border shrink-0 mt-0.5" />
}
