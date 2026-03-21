import { Skeleton } from '@/components/ui/skeleton'

export default function ChatLoading() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar placeholder */}
      <div className="w-64 shrink-0 border-r border-border bg-card" />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar placeholder */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card shrink-0">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="w-32 h-4 rounded" />
          <div className="flex-1" />
          <Skeleton className="w-24 h-6 rounded-full" />
        </div>

        {/* Message skeletons */}
        <div className="flex-1 overflow-hidden px-4 py-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {[
              { role: 'user', lines: [60] },
              { role: 'assistant', lines: [100, 85, 70] },
              { role: 'user', lines: [45] },
              { role: 'assistant', lines: [100, 90] },
            ].map((item, i) => (
              <div key={i} className={`flex gap-4 px-4 ${item.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <Skeleton className="w-8 h-8 shrink-0 rounded-lg" />
                <div className={`flex flex-col gap-2 ${item.role === 'user' ? 'items-end' : ''}`} style={{ maxWidth: '65%' }}>
                  {item.lines.map((w, j) => (
                    <Skeleton key={j} className="h-4 rounded" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Composer placeholder */}
        <div className="px-4 py-3 border-t border-border bg-card">
          <div className="mx-auto max-w-3xl">
            <Skeleton className="w-full h-12 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
