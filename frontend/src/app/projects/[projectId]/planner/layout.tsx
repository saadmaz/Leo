import { TierGate } from '@/components/billing/TierGate'

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="pro"
      feature="Content planner for mapping out campaigns and editorial themes across weeks and months."
    >
      {children}
    </TierGate>
  )
}
