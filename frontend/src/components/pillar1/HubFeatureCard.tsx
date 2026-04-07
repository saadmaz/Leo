'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HubFeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  lastRun?: string | null
  status?: 'never' | 'complete' | 'draft'
  credits: number
  className?: string
}

export function HubFeatureCard({
  icon, title, description, href, lastRun, status = 'never', credits, className,
}: HubFeatureCardProps) {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push(href)}
      className={cn(
        'group relative text-left p-5 rounded-xl border border-border bg-card',
        'hover:border-primary/50 hover:shadow-sm transition-all duration-200',
        className,
      )}
    >
      {/* Status dot */}
      {status === 'complete' && (
        <span className="absolute top-3 right-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </span>
      )}

      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <span className="font-semibold text-sm">{title}</span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{description}</p>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {status === 'never' ? 'Never run' : lastRun ? `Last: ${new Date(lastRun).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
        </span>
        <span className="flex items-center gap-1 text-primary group-hover:gap-2 transition-all">
          {credits} cr <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  )
}
