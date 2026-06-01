import { TierGate } from '@/components/billing/TierGate'

export default function PublishLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="pro"
      feature="Publish queue for scheduling and directly posting approved content across connected social accounts via Ayrshare."
    >
      {children}
    </TierGate>
  )
}
