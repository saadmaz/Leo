import { TierGate } from '@/components/billing/TierGate'

export default function ImagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <TierGate
      tier="pro"
      feature="AI image generation that creates brand-consistent visuals from natural language prompts."
    >
      {children}
    </TierGate>
  )
}
