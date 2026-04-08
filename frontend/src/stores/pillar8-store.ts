import { create } from 'zustand'
import type { ProgressStep } from '@/types'

interface Pillar8State {
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void
  streamText: string
  appendStreamText: (chunk: string) => void
  clearStreamText: () => void
  steps: ProgressStep[]
  upsertStep: (step: string, label: string, status: ProgressStep['status']) => void
  clearSteps: () => void
}

export const usePillar8Store = create<Pillar8State>((set) => ({
  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),
  streamText: '',
  appendStreamText: (chunk) => set((s) => ({ streamText: s.streamText + chunk })),
  clearStreamText: () => set({ streamText: '' }),
  steps: [],
  upsertStep: (step, label, status) =>
    set((s) => {
      const idx = s.steps.findIndex((x) => x.step === step)
      const next = { step, label, status }
      if (idx === -1) return { steps: [...s.steps, next] }
      const steps = [...s.steps]
      steps[idx] = next
      return { steps }
    }),
  clearSteps: () => set({ steps: [] }),
}))
