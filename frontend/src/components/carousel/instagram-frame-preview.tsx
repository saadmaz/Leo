'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface InstagramFramePreviewProps {
  htmlContent: string
  format?: 'portrait' | 'square' | 'landscape' | 'stories'
}

const FORMAT_HEIGHT: Record<string, number> = {
  portrait: 525,
  square: 420,
  landscape: 220,
  stories: 747,
}

export function InstagramFramePreview({
  htmlContent,
  format = 'portrait',
}: InstagramFramePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const viewH = FORMAT_HEIGHT[format] ?? 525
  // IG frame total height = viewport + header (65) + dots (30) + actions (45) + caption (60)
  const frameH = viewH + 65 + 30 + 45 + 60

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(htmlContent)
    doc.close()
  }, [htmlContent])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-3 w-full"
    >
      <div
        className="rounded-xl overflow-hidden shadow-xl border border-border"
        style={{ width: 420 }}
      >
        <iframe
          ref={iframeRef}
          title="Instagram carousel preview"
          width={420}
          height={frameH}
          style={{ display: 'block', border: 'none' }}
          sandbox="allow-scripts"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Use ← → keys or swipe to navigate · {format} format
      </p>
    </motion.div>
  )
}
