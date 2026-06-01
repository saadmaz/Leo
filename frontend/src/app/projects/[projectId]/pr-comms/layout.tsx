import { TierGate } from '@/components/billing/TierGate'

export default function PrCommsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="agency"
      feature="PR and communications tools including press releases, media lists, pitch emails, and crisis communications playbooks."
    >
      {children}
    </TierGate>
  )
}
