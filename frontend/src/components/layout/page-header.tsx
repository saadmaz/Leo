'use client'

import { cn } from '@/lib/utils'
import { SidebarToggle } from '@/components/layout/sidebar'
import { BackButton } from '@/components/layout/back-button'

interface PageHeaderProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
  showBack?: boolean
  /** Tailwind classes for the icon container, e.g. "bg-violet-500/10 text-violet-600" */
  iconColor?: string
  className?: string
}

export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
  showBack = false,
  iconColor,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-card/60 backdrop-blur-sm',
        className,
      )}
    >
      <SidebarToggle />
      {showBack && <BackButton />}

      {icon && (
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            iconColor ?? 'bg-muted text-muted-foreground',
          )}
        >
          {icon}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold leading-tight truncate">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  )
}
