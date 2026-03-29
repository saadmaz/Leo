'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send } from 'lucide-react'
import type { CarouselIntakeQuestion, BrandProfile } from '@/types'

interface CarouselIntakeProps {
  question: CarouselIntakeQuestion
  questionNumber: number
  totalQuestions: number
  brandProfile: BrandProfile | null
  disabled?: boolean
  onAnswer: (answer: string) => void
}

export function CarouselIntakeQuestion({
  question,
  questionNumber,
  totalQuestions,
  brandProfile,
  disabled,
  onAnswer,
}: CarouselIntakeProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')

  const isFreeText = question.type === 'free_text' || !question.options?.length

  function handleOption(value: string) {
    if (disabled || selected) return
    setSelected(value)
    onAnswer(value)
  }

  function handleSubmitText() {
    const trimmed = freeText.trim()
    if (!trimmed || disabled) return
    onAnswer(trimmed)
    setFreeText('')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3 w-full max-w-md"
    >
      <div className="space-y-0.5">
        <p className="text-[11px] text-muted-foreground font-medium tracking-wide uppercase">
          Question {questionNumber} of {totalQuestions}
        </p>
        <p className="text-sm font-medium text-foreground">{question.text}</p>
      </div>

      {isFreeText ? (
        <div className="space-y-2">
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSubmitText() }}
            placeholder={question.placeholder ?? 'Type your answer…'}
            disabled={disabled}
            rows={3}
            className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50 resize-none"
          />
          <button
            onClick={handleSubmitText}
            disabled={disabled || !freeText.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            Generate Carousel
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {question.options!.map((opt) => {
            const isRecommended = brandProfile?.suggested_carousel_type === opt.value
            const isSelected = selected === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleOption(opt.value)}
                disabled={disabled || selected !== null}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left text-sm transition-all
                  ${isSelected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : isRecommended && !selected
                    ? 'border-primary/40 bg-primary/5 text-foreground'
                    : 'border-border hover:border-primary/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                  }
                  disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="flex-1">
                  <span className="font-medium">{opt.label}</span>
                  {opt.description && (
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      {opt.description}
                    </span>
                  )}
                </span>
                {isRecommended && !selected && (
                  <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5">
                    Suggested
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
