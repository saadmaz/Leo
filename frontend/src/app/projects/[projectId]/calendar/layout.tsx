import { TierGate } from '@/components/billing/TierGate'

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="pro"
      feature="Content calendar with drag-and-drop scheduling and visual planning across all connected social accounts."
    >
      {children}
    </TierGate>
  )
}
