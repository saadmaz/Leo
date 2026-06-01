import { TierGate } from '@/components/billing/TierGate'

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="pro"
      feature="Campaign management with AI-generated briefs, multi-channel content packs, and performance tracking."
    >
      {children}
    </TierGate>
  )
}
