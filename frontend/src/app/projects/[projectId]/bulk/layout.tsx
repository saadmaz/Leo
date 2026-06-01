import { TierGate } from '@/components/billing/TierGate'

export default function BulkLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="pro"
      feature="Bulk content generation — create up to 20 pieces simultaneously from a single brief or CSV import."
    >
      {children}
    </TierGate>
  )
}
