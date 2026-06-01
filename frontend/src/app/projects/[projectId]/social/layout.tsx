import { TierGate } from '@/components/billing/TierGate'

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="agency"
      feature="Social media management including community reply drafting, social proof harvesting, and employee advocacy post generation."
    >
      {children}
    </TierGate>
  )
}
