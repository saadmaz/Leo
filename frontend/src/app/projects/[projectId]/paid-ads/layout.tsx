import { TierGate } from '@/components/billing/TierGate'

export default function PaidAdsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="agency"
      feature="Paid advertising tools including ad briefs, multi-variant copy generation, attribution models, and retargeting strategy."
    >
      {children}
    </TierGate>
  )
}
