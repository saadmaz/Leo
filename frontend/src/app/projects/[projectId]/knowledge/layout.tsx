import { TierGate } from '@/components/billing/TierGate'

export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="pro"
      feature="Brand knowledge base for storing, organising, and semantically searching your core brand information."
    >
      {children}
    </TierGate>
  )
}
