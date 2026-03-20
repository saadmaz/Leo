import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-border flex items-center justify-center mb-6">
        <Sparkles className="w-5 h-5 text-primary" />
      </div>
      <h1 className="text-5xl font-bold mb-3">404</h1>
      <p className="text-muted-foreground mb-8 max-w-xs">
        This page doesn&apos;t exist. It may have been moved or deleted.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Back to LEO
      </Link>
    </div>
  )
}
