'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAppStore } from '@/stores/app-store'

// Module-level cache: stores raw flag docs for the session so we never
// re-fetch the same flag document twice.
const docCache: Record<string, Record<string, unknown> | null | undefined> = {}

// Tracks in-flight fetches to prevent duplicate concurrent requests.
const inFlight: Record<string, boolean> = {}

export function useFeatureFlag(key: string): { enabled: boolean; loading: boolean } {
  const { billingStatus, credits } = useAppStore()

  // Initialise from cache when already available — avoids an extra render.
  const [flagDoc, setFlagDoc] = useState<Record<string, unknown> | null | undefined>(
    () => (key in docCache ? docCache[key] : undefined),
  )

  useEffect(() => {
    if (key in docCache) {
      setFlagDoc(docCache[key])
      return
    }
    if (inFlight[key]) return
    inFlight[key] = true

    getDoc(doc(db, 'featureFlags', key))
      .then((snap) => {
        const data = snap.exists() ? (snap.data() as Record<string, unknown>) : null
        docCache[key] = data
        setFlagDoc(data)
      })
      .catch(() => {
        docCache[key] = null
        setFlagDoc(null)
      })
      .finally(() => {
        inFlight[key] = false
      })
  }, [key])

  const tierLoading = billingStatus === null && credits === null
  const loading = flagDoc === undefined || tierLoading

  if (loading) return { enabled: false, loading: true }

  // Unknown flag → fail-open (same behaviour as backend)
  if (flagDoc === null) return { enabled: true, loading: false }

  const uid = auth.currentUser?.uid ?? ''
  const tier = ((credits?.plan ?? billingStatus?.plan) || 'free') as string

  // 1. Per-user override takes highest precedence
  const overrides = (flagDoc.userOverrides ?? {}) as Record<string, boolean>
  if (uid && uid in overrides) return { enabled: Boolean(overrides[uid]), loading: false }

  // 2. Global master switch
  if (!flagDoc.enabled) return { enabled: false, loading: false }

  // 3. Tier gate
  const allowedTiers = (flagDoc.allowedTiers ?? null) as string[] | null
  if (allowedTiers !== null && !allowedTiers.includes(tier)) return { enabled: false, loading: false }

  return { enabled: true, loading: false }
}
