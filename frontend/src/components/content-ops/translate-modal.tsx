'use client'

import { useRef, useState } from 'react'
import { X, Languages, Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

const LANGUAGES = [
  { code: 'ES', label: 'Spanish' },
  { code: 'FR', label: 'French' },
  { code: 'DE', label: 'German' },
  { code: 'PT', label: 'Portuguese' },
  { code: 'JA', label: 'Japanese' },
  { code: 'ZH', label: 'Chinese Simplified' },
  { code: 'AR', label: 'Arabic' },
  { code: 'HI', label: 'Hindi' },
  { code: 'IT', label: 'Italian' },
  { code: 'NL', label: 'Dutch' },
]

interface TranslateModalProps {
  open: boolean
  onClose: () => void
  content: string
  contentId: string
  projectId: string
}

export function TranslateModal({ open, onClose, content, contentId: _contentId, projectId }: TranslateModalProps) {
  const [targetLang, setTargetLang] = useState('ES')
  const [result, setResult] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  if (!open) return null

  async function handleTranslate() {
    if (!content.trim()) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setResult('')
    setStreaming(true)

    try {
      await api.pillar1.streamTranslate(
        projectId,
        { content, source_lang: 'EN', target_langs: [targetLang] },
        {
          onDelta: (text) => setResult((prev) => prev + text),
          onError: (msg) => { toast.error(msg); setStreaming(false) },
          onDone: () => setStreaming(false),
        },
        ctrl.signal,
      )
    } catch {
      setStreaming(false)
    }
  }

  function handleCopy() {
    if (!result) return
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  function handleClose() {
    abortRef.current?.abort()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Translate Content</span>
          </div>
          <button onClick={handleClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5 overflow-y-auto flex-1">
          {/* Source preview */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Source (English)</p>
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2.5 border border-border line-clamp-3 leading-relaxed">
              {content}
            </p>
          </div>

          {/* Language selector */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
              Target Language
            </label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              disabled={streaming}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Result */}
          {(result || streaming) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Translation
                {streaming && <span className="ml-1.5 text-primary animate-pulse">…</span>}
              </p>
              <textarea
                readOnly
                value={result}
                rows={6}
                className="w-full px-3 py-2.5 text-sm bg-muted/30 border border-border rounded-lg focus:outline-none resize-none leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={handleTranslate}
            disabled={streaming || !content.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {streaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
            {streaming ? 'Translating…' : 'Translate'}
          </button>
          {result && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
          <button
            onClick={handleClose}
            className="ml-auto px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
