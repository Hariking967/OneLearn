'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, LogOut, GraduationCap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
    { href: '/dashboard', label: 'Projects', icon: LayoutDashboard, meta: null },
    { href: '/classrooms', label: 'Classrooms', icon: GraduationCap, meta: null },
  ]

  return (
    <aside style={{
      position: 'sticky', top: 0, height: '100vh',
      width: 240, flexShrink: 0,
      borderRight: '1px solid var(--line)',
      background: 'linear-gradient(180deg, rgba(20,20,28,0.7), rgba(10,10,15,0.98))',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column',
      padding: '20px 18px',
      zIndex: 5,
    }}>

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 22, marginBottom: 18, borderBottom: '1px solid var(--line)' }}>
        {/* Brand mark */}
        <div className="brand-mark">
          <div className="brand-mark-diamond" />
        </div>
        {/* Brand name */}
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, letterSpacing: '-0.01em', lineHeight: 1 }}>
          One<em style={{ fontStyle: 'italic', color: 'var(--purple-2)' }}>learn</em>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 8px 10px' }}>
          Workspace
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ href, label, icon: Icon, meta }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                <div
                  className={`sidebar-link${active ? ' active' : ''}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11,
                    padding: '9px 10px', borderRadius: 8,
                    color: active ? '#fff' : 'var(--ink-2)',
                    fontSize: 13, fontWeight: 400,
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.18s, color 0.18s',
                    ...(active ? {
                      background: 'linear-gradient(90deg, var(--purple-glow), transparent 80%)',
                    } : {}),
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = '' }}
                >
                  {/* Left active indicator */}
                  {active && (
                    <span style={{
                      position: 'absolute', left: -18, top: 8, bottom: 8,
                      width: 2, background: 'var(--purple)', borderRadius: 2,
                      boxShadow: '0 0 12px var(--purple)',
                    }} />
                  )}
                  <span style={{ width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: 0.85 }}>
                    <Icon size={15} />
                  </span>
                  <span style={{ flex: 1 }}>{label}</span>
                  {meta != null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--mute)', marginLeft: 'auto' }}>
                      {meta}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User widget */}
      <div style={{
        marginTop: 'auto',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 14,
        background: 'linear-gradient(180deg, oklch(0.42 0.18 295 / 0.06), transparent)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow orb */}
        <div style={{
          position: 'absolute', right: '-30%', bottom: '-50%',
          width: 140, height: 140, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--purple-glow), transparent 60%)',
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }} />

        {userEmail && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, position: 'relative', marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--purple-2), var(--purple-3))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-serif)', fontSize: 14, color: '#fff',
              flexShrink: 0, border: '1px solid var(--line)',
            }}>
              {userEmail[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userEmail}
              </div>
              <div style={{ fontSize: 10, color: 'var(--purple-2)', fontFamily: 'var(--font-mono)', marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                active
              </div>
            </div>
          </div>
        )}

        <button
          onClick={signOut}
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 10px', borderRadius: 8,
            color: 'var(--mute)', fontSize: 12,
            fontFamily: 'var(--font-sans)',
            background: 'none', border: 'none', cursor: 'pointer',
            width: '100%',
            transition: 'color 0.18s, background 0.18s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'hsl(0 85% 70%)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.05)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)'; (e.currentTarget as HTMLButtonElement).style.background = ''; }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
