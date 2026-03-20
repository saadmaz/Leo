'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Building2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  reason?: string  // e.g. "You've reached your free plan message limit."
}

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const router = useRouter()
  const [upgrading, setUpgrading] = useState<'pro' | 'agency' | null>(null)
  const [error, setError] = useState('')

  async function handleUpgrade(plan: 'pro' | 'agency') {
    setUpgrading(plan)
    setError('')
    try {
      const { url } = await api.billing.checkout(plan)
      window.location.href = url
    } catch (err) {
      setError(String(err))
      setUpgrading(null)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>

            <div className="mb-5">
              <h2 className="text-xl font-bold">Upgrade your plan</h2>
              {reason && (
                <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
              )}
            </div>

            {error && (
              <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            )}

            <div className="space-y-3">
              {/* Pro */}
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-violet-400" />
                    <span className="font-semibold">Pro</span>
                    <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">Popular</span>
                  </div>
                  <span className="text-lg font-bold">$29<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  10 projects · 500 messages/mo · Unlimited ingestions
                </p>
                <button
                  onClick={() => handleUpgrade('pro')}
                  disabled={!!upgrading}
                  className="mt-3 w-full rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                >
                  {upgrading === 'pro' ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Upgrade to Pro'}
                </button>
              </div>

              {/* Agency */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-amber-400" />
                    <span className="font-semibold">Agency</span>
                  </div>
                  <span className="text-lg font-bold">$99<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Unlimited projects · Unlimited messages · Unlimited ingestions
                </p>
                <button
                  onClick={() => handleUpgrade('agency')}
                  disabled={!!upgrading}
                  className="mt-3 w-full rounded-lg bg-amber-600 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                >
                  {upgrading === 'agency' ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Upgrade to Agency'}
                </button>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              <button
                onClick={() => { onClose(); router.push('/billing') }}
                className="hover:text-foreground underline-offset-2 hover:underline"
              >
                View all plan details →
              </button>
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
