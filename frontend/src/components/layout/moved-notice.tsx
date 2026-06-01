'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'

const MESSAGES: Record<string, { title: string; description: string }> = {
  translate: {
    title: 'Translation moved to Content Library',
    description: 'Open any content card and choose "Translate" from the action row.',
  },
  'visual-brief': {
    title: 'Visual Brief moved to Campaigns',
    description: 'Click the "Visual Brief" button in the Campaigns header.',
  },
  podcast: {
    title: 'Podcast Show Notes merged into this page',
    description: 'Use the "Podcast Show Notes" toggle at the top of the form.',
  },
  'learning-propagation': {
    title: 'Learning Propagation moved here',
    description: 'Select the "Insights" tab at the top of the Experiment Log.',
  },
  'board-report': {
    title: 'Board Report moved to Reports',
    description: 'Select the "Board Report" tab in the Reports page.',
  },
}

// Reads ?movedFrom=<key> from the current URL on mount, shows a contextual
// toast, then strips the param so it doesn't persist in history.
export function MovedNotice() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const key = params.get('movedFrom')
    if (!key) return

    const msg = MESSAGES[key]
    if (msg) {
      toast.info(msg.title, { description: msg.description, duration: 7000 })
    }

    params.delete('movedFrom')
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
