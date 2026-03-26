'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import type { MarketingStrategy, StrategySection } from '@/types'

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function StrategySection({ section, defaultOpen }: { section: StrategySection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(section.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <span className="text-sm font-semibold text-foreground">{section.heading}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-3 pb-4 relative">
              <button
                onClick={handleCopy}
                className="absolute top-3 right-4 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? <><Check className="w-3 h-3 text-emerald-500" /><span className="text-emerald-500">Copied</span></> : <><Copy className="w-3 h-3" />Copy</>}
              </button>
              <div className="prose prose-sm dark:prose-invert max-w-none pr-12">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {section.content}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Streaming preview (while generating)
// ---------------------------------------------------------------------------

export function StrategyStreamPreview({ markdown }: { markdown: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5 w-full space-y-2"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs text-muted-foreground font-medium">Generating your strategy...</span>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Full saved strategy document
// ---------------------------------------------------------------------------

interface StrategyDocumentProps {
  strategy: MarketingStrategy
}

export function StrategyDocument({ strategy }: StrategyDocumentProps) {
  const [allCopied, setAllCopied] = useState(false)

  function copyAll() {
    navigator.clipboard.writeText(strategy.fullMarkdown)
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 1500)
  }

  const sections = strategy.sections?.length ? strategy.sections : []

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card w-full overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-border bg-muted/20">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              v{strategy.version}
            </span>
            <span className="text-xs text-muted-foreground capitalize">{strategy.funnelType} funnel</span>
          </div>
          <h3 className="text-sm font-semibold text-foreground">{strategy.title}</h3>
        </div>
        <button
          onClick={copyAll}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-0.5"
        >
          {allCopied ? <><Check className="w-3 h-3 text-emerald-500" /><span className="text-emerald-500">Copied all</span></> : <><Copy className="w-3 h-3" />Copy all</>}
        </button>
      </div>

      {/* Collapsible sections */}
      <div className="p-4 space-y-2">
        {sections.map((section, i) => (
          <StrategySection
            key={section.heading}
            section={section}
            defaultOpen={i === 0}
          />
        ))}
        {sections.length === 0 && (
          <div className="prose prose-sm dark:prose-invert max-w-none p-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{strategy.fullMarkdown}</ReactMarkdown>
          </div>
        )}
      </div>
    </motion.div>
  )
}
