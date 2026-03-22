'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BackButton({ className }: { className?: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      className={cn(
        'p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
        className,
      )}
      title="Go back"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
    </button>
  )
}
