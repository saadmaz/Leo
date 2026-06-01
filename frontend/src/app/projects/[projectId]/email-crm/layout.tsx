import { TierGate } from '@/components/billing/TierGate'

export default function EmailCrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="pro"
      feature="Email marketing automation with smart segmentation, multi-step sequences, lead scoring, and win/loss analysis."
    >
      {children}
    </TierGate>
  )
}
