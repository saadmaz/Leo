import { TierGate } from '@/components/billing/TierGate'

export default function ExperimentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="agency"
      feature="A/B testing framework with experiment logging, messaging resonance analysis, and learning propagation across channels."
    >
      {children}
    </TierGate>
  )
}
