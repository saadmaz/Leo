'use client'

import { motion } from 'framer-motion'
import { Download, Pencil, RefreshCw, Maximize2, Palette, Smartphone, BookmarkPlus } from 'lucide-react'

interface CarouselActionBarProps {
  onExport: () => void
  onEdit: () => void
  onRegenerate: () => void
  onChangeFormat: () => void
  onChangeStyle: () => void
  onStoriesVersion: () => void
  onSaveToLibrary: () => void
  exporting?: boolean
  disabled?: boolean
}

export function CarouselActionBar({
  onExport,
  onEdit,
  onRegenerate,
  onChangeFormat,
  onChangeStyle,
  onStoriesVersion,
  onSaveToLibrary,
  exporting,
  disabled,
}: CarouselActionBarProps) {
  const actions = [
    { icon: Download,     label: exporting ? 'Exporting…' : 'Export All Slides', onClick: onExport,       primary: true },
    { icon: Pencil,       label: 'Edit a Slide',       onClick: onEdit,          primary: false },
    { icon: RefreshCw,    label: 'Regenerate',          onClick: onRegenerate,    primary: false },
    { icon: Maximize2,    label: 'Change Format',       onClick: onChangeFormat,  primary: false },
    { icon: Palette,      label: 'Change Style',        onClick: onChangeStyle,   primary: false },
    { icon: Smartphone,   label: 'Stories Version',     onClick: onStoriesVersion, primary: false },
    { icon: BookmarkPlus, label: 'Save to Library',     onClick: onSaveToLibrary, primary: false },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap gap-2 mt-3"
    >
      {actions.map(({ icon: Icon, label, onClick, primary }) => (
        <button
          key={label}
          onClick={onClick}
          disabled={disabled || (exporting && primary)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
            ${primary
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </motion.div>
  )
}
