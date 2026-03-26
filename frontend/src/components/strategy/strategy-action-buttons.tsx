'use client'

import { Calendar, PenLine, BarChart2, DollarSign, RefreshCw, FileDown, BookmarkPlus } from 'lucide-react'
import type { MarketingStrategy } from '@/types'

interface StrategyActionButtonsProps {
  strategy: MarketingStrategy
  onFollowUp: (message: string) => void
}

const ACTIONS = [
  { icon: Calendar,      label: 'Build Content Calendar',   message: 'Build me a detailed content calendar from this strategy.' },
  { icon: PenLine,       label: 'Write the Content Now',    message: 'Start writing the first week of content based on this strategy.' },
  { icon: BarChart2,     label: 'Show Trends Data',         message: 'Show me the Google Trends data and seasonal insights from the research.' },
  { icon: DollarSign,    label: 'Adjust Budget',            message: 'Revise the budget breakdown. What if my budget was half of what I stated?' },
  { icon: RefreshCw,     label: 'Different Funnel Stage',   message: 'Refocus this strategy on a different funnel stage.' },
  { icon: BookmarkPlus,  label: 'Steal From Competitors',   message: 'Show me one specific tactic a competitor is using that I can do better.' },
]

export function StrategyActionButtons({ strategy, onFollowUp }: StrategyActionButtonsProps) {
  function handleExportPDF() {
    // Open the full markdown in a new tab for manual print/save
    const blob = new Blob([strategy.fullMarkdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${strategy.title.replace(/[^a-z0-9]/gi, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {ACTIONS.map((action) => (
        <button
          key={action.label}
          onClick={() => onFollowUp(action.message)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/30 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted transition-all"
        >
          <action.icon className="w-3 h-3" />
          {action.label}
        </button>
      ))}
      <button
        onClick={handleExportPDF}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/30 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted transition-all"
      >
        <FileDown className="w-3 h-3" />
        Export Strategy
      </button>
    </div>
  )
}
