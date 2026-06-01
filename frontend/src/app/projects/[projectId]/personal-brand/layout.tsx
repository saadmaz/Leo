import { TierGate } from '@/components/billing/TierGate'

export default function PersonalBrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="pro"
      feature="Personal brand building with an AI-driven discovery interview, content generation in your voice, and platform strategy."
    >
      {children}
    </TierGate>
  )
}
