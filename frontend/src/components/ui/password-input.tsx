'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        type={show ? 'text' : 'password'}
        className={cn('pr-10', className)}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-all duration-150"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        <span
          className={cn(
            'block transition-all duration-150',
            show ? 'rotate-0 opacity-60' : 'rotate-0 opacity-100',
          )}
        >
          {show
            ? <EyeOff className="w-4 h-4" />
            : <Eye className="w-4 h-4" />
          }
        </span>
      </button>
    </div>
  )
}
