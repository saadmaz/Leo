'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { isSuperAdmin } from '@/lib/admin-api'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  BarChart2,
  ScrollText,
  ShieldAlert,
  ToggleLeft,
  Activity,
  LogOut,
  Shield,
  ChevronRight,
  Megaphone,
} from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/projects', label: 'Projects', icon: FolderOpen },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/admin/moderation', label: 'Moderation', icon: ShieldAlert },
  { href: '/admin/feature-flags', label: 'Feature Flags', icon: ToggleLeft },
  { href: '/admin/system', label: 'System Health', icon: Activity },
  { href: '/admin/communications', label: 'Communications', icon: Megaphone },
  { href: '/admin/audit-log', label: 'Audit Log', icon: ScrollText },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    isSuperAdmin().then((ok) => {
      if (!ok) router.replace('/projects')
      else setChecking(false)
    })
  }, [router])

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
        {/* Logo / brand */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm tracking-tight">LEO Admin</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="p-2 border-t border-border">
          <button
            onClick={() => signOut(auth).then(() => router.replace('/login'))}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
