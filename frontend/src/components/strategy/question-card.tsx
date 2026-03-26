'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send } from 'lucide-react'
import type { StrategyQuestion } from '@/types'

interface QuestionCardProps {
  question: StrategyQuestion
  questionNumber: number
  totalQuestions: number
  disabled?: boolean
  onAnswer: (answer: string) => void
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  disabled,
  onAnswer,
}: QuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')

  const hasOptions = question.options && question.options.length > 0

  function handleOptionClick(opt: string) {
    if (disabled) return
    setSelected(opt)
    onAnswer(opt)
  }

  function handleFreeTextSubmit() {
    const trimmed = freeText.trim()
    if (!trimmed || disabled) return
    onAnswer(trimmed)
    setFreeText('')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3 w-full max-w-md"
    >
      <div className="space-y-0.5">
        <p className="text-[11px] text-muted-foreground font-medium tracking-wide uppercase">
          Question {questionNumber} of {totalQuestions}
        </p>
        <p className="text-sm font-medium text-foreground">{question.text}</p>
      </div>

      {hasOptions ? (
        <div className="space-y-2">
          {question.options!.map((opt) => (
            <button
              key={opt}
              onClick={() => handleOptionClick(opt)}
              disabled={disabled || selected !== null}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left text-sm transition-all
                ${selected === opt
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border hover:border-primary/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                }
                disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFreeTextSubmit() }}
            placeholder={question.placeholder ?? 'Type your answer…'}
            disabled={disabled}
            className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
          />
          <button
            onClick={handleFreeTextSubmit}
            disabled={disabled || !freeText.trim()}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.div>
  )
}
