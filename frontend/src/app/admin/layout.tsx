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
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

type AuthState = 'checking' | 'login' | 'forbidden' | 'ok'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authState, setAuthState] = useState<AuthState>('checking')

  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  async function checkAuth() {
    const user = auth.currentUser
    if (!user) { setAuthState('login'); return }
    const ok = await isSuperAdmin()
    if (ok) setAuthState('ok')
    else setAuthState('forbidden')
  }

  useEffect(() => {
    // Wait for Firebase auth to initialise
    const unsub = auth.onAuthStateChanged(() => checkAuth())
    return unsub
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // onAuthStateChanged will fire and re-run checkAuth
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setLoginError('Incorrect email or password.')
      } else if (code === 'auth/too-many-requests') {
        setLoginError('Too many attempts. Please wait and try again.')
      } else {
        setLoginError('Something went wrong. Please try again.')
      }
      setLoginLoading(false)
    }
  }

  if (authState === 'checking') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  if (authState === 'login') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center flex flex-col items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">LEO Admin</h1>
            <p className="text-sm text-muted-foreground">Sign in to access the admin panel</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="admin-email" className="text-sm font-medium">Email</label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="admin-password" className="text-sm font-medium">Password</label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {loginError && <p className="text-sm text-destructive">{loginError}</p>}
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (authState === 'forbidden') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Shield className="w-10 h-10 text-destructive mx-auto" />
          <p className="text-lg font-semibold">Access denied</p>
          <p className="text-sm text-muted-foreground">This account does not have super admin privileges.</p>
          <Button variant="outline" onClick={() => signOut(auth).then(() => setAuthState('login'))}>
            Sign out
          </Button>
        </div>
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
            onClick={() => signOut(auth).then(() => setAuthState('login'))}
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
