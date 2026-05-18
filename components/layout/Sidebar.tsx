'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, LogOut, Sparkles, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface SidebarProps {
  userEmail?: string
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { href: '/dashboard', label: 'Projects', icon: LayoutDashboard },
  ]

  return (
    <aside className="flex flex-col w-56 min-h-screen shrink-0"
           style={{ background: '#0d0d14', borderRight: '1px solid #1e1a2e' }}>

      {/* Logo */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid hsl(270 15% 11%)' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg"
               style={{ background: 'hsl(271 91% 65% / 0.15)', border: '1px solid hsl(271 91% 65% / 0.25)' }}>
            <Sparkles className="h-4 w-4" style={{ color: 'hsl(271 91% 68%)' }} />
          </div>
          <span className="font-bold text-base gradient-text">OneLearn</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest"
           style={{ color: 'hsl(270 8% 38%)' }}>
          Menu
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'text-white'
                  : 'hover:bg-white/5'
              )}
              style={active ? {
                background: 'hsl(271 91% 65% / 0.15)',
                color: 'hsl(271 91% 78%)',
                boxShadow: 'inset 0 0 0 1px hsl(271 91% 65% / 0.2)',
              } : { color: 'hsl(270 8% 58%)' }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ background: 'hsl(271 91% 65%)', boxShadow: '0 0 6px hsl(271 91% 65%)' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User & Sign out */}
      <div className="px-2 py-4" style={{ borderTop: '1px solid hsl(270 15% 11%)' }}>
        {userEmail && (
          <div className="px-3 py-2 mb-2 rounded-lg" style={{ background: 'hsl(240 12% 10%)' }}>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                   style={{ background: 'hsl(271 91% 65% / 0.2)', color: 'hsl(271 91% 72%)' }}>
                {userEmail[0].toUpperCase()}
              </div>
              <span className="text-xs truncate" style={{ color: 'hsl(270 8% 55%)' }}>
                {userEmail}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-white/5"
          style={{ color: 'hsl(270 8% 50%)' }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
