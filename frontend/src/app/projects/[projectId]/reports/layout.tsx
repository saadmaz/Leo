import { TierGate } from '@/components/billing/TierGate'

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="agency"
      feature="Advanced reporting including AI-generated weekly digests, deep research reports, and board-ready presentation decks."
    >
      {children}
    </TierGate>
  )
}
