import { TierGate } from '@/components/billing/TierGate'

export default function BrandChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="pro"
      feature="Brand Q&A searches your content library, competitor snapshots, and brand strategy to answer questions about your brand."
    >
      {children}
    </TierGate>
  )
}
