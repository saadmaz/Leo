'use client'

import { useParams } from 'next/navigation'
import { redirect } from 'next/navigation'
import { useAppStore } from '@/stores/app-store'
import { TierGate } from '@/components/billing/TierGate'

export default function PersonalBrandLayout({ children }: { children: React.ReactNode }) {
  const { activeProject } = useAppStore()
  const params = useParams<{ projectId: string }>()

  // If project is loaded and is not personal type, redirect to dashboard
  if (activeProject && activeProject.id === params.projectId &&
      activeProject.projectType !== 'personal') {
    redirect(`/projects/${params.projectId}/dashboard`)
  }

  return (
    <TierGate
      tier="pro"
      feature="Personal brand building with an AI-driven discovery interview, content generation in your voice, and platform strategy."
    >
      {children}
    </TierGate>
  )
}
