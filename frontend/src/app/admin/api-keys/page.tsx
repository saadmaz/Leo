'use client'

import { useEffect, useState } from 'react'
import { adminApi, ApiKeyStatus } from '@/lib/admin-api'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  KeyRound,
  AlertTriangle,
} from 'lucide-react'

const CATEGORY_ORDER = [
  'LLM',
  'Search',
  'Scraping',
  'Social',
  'Brand',
  'Storage',
  'Email',
  'Email CRM',
  'Payments',
  'CRM',
  'PR',
  'Translation',
]

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    adminApi.apiKeys
      .list()
      .then(setKeys)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const grouped = CATEGORY_ORDER.reduce<Record<string, ApiKeyStatus[]>>((acc, cat) => {
    const items = keys.filter((k) => k.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  // Any uncategorised
  const uncategorised = keys.filter((k) => !CATEGORY_ORDER.includes(k.category))
  if (uncategorised.length > 0) grouped['Other'] = uncategorised

  const totalConfigured = keys.filter((k) => k.configured).length
  const totalMissing = keys.filter((k) => !k.configured).length

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configuration status of all third-party API keys. Values are masked.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-6">
          {error}
        </div>
      )}

      {/* Summary bar */}
      {!loading && (
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold">{totalConfigured}</span>
            <span className="text-muted-foreground">configured</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2 text-sm">
            <XCircle className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold">{totalMissing}</span>
            <span className="text-muted-foreground">missing</span>
          </div>
          {totalMissing > 0 && (
            <>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5 text-sm text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                {totalMissing} key{totalMissing > 1 ? 's' : ''} not set — features that depend on them will fail
              </div>
            </>
          )}
        </div>
      )}

      {/* Category groups */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(grouped).map(([category, items]) => (
            <CategoryCard key={category} category={category} items={items} />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryCard({
  category,
  items,
}: {
  category: string
  items: ApiKeyStatus[]
}) {
  const missing = items.filter((k) => !k.configured).length
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            {category}
          </span>
          {missing > 0 ? (
            <Badge variant="destructive" className="text-xs font-normal">
              {missing} missing
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs font-normal text-emerald-600 bg-emerald-500/10">
              All set
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {items.map((key) => (
          <KeyRow key={key.id} item={key} />
        ))}
      </CardContent>
    </Card>
  )
}

function KeyRow({ item }: { item: ApiKeyStatus }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {item.configured ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
        )}
        <span className="text-sm truncate">{item.name}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.note && (
          <span className="text-xs text-muted-foreground">{item.note}</span>
        )}
        {item.maskedKey ? (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
            {item.maskedKey}
          </code>
        ) : (
          <span className="text-xs text-muted-foreground/50 italic">not set</span>
        )}
      </div>
    </div>
  )
}
