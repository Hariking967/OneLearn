'use client'

import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { NotificationBell } from '@/components/NotificationBell'

const PAGE_NAMES: Record<string, string> = {
  '/dashboard': 'Projects',
  '/classrooms': 'Classrooms',
}

function getPageName(pathname: string): string {
  if (PAGE_NAMES[pathname]) return PAGE_NAMES[pathname]
  if (pathname.startsWith('/classroom/')) return 'Classroom'
  if (pathname.startsWith('/project/')) return 'Project'
  if (pathname.startsWith('/topic/')) return 'Topic'
  return 'Workspace'
}

interface Props {
  userEmail?: string
}

export function TopBar({ userEmail }: Props) {
  const pathname = usePathname()
  const page = getPageName(pathname)
  const initial = userEmail?.[0]?.toUpperCase() ?? '?'

  return (
    <header
      className="animate-fade-down"
      style={{
        position: 'sticky', top: 0, zIndex: 4,
        display: 'flex', alignItems: 'center', gap: 18,
        padding: '12px 32px',
        borderBottom: '1px solid var(--line)',
        background: 'rgba(10,10,15,0.75)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      {/* Breadcrumb */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Workspace
        <span style={{ margin: '0 8px', color: 'var(--line)' }}>/</span>
        <b style={{ color: 'var(--ink)', fontWeight: 500, fontFamily: 'var(--font-sans)', textTransform: 'none', letterSpacing: '-0.01em' }}>{page}</b>
      </div>

      {/* Search */}
      <div style={{
        marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 9,
        background: 'rgba(255,255,255,0.02)', minWidth: 260,
      }}>
        <Search style={{ width: 13, height: 13, color: 'var(--mute)', flexShrink: 0 }} />
        <input
          placeholder="Search projects, topics…"
          style={{
            background: 'none', border: 'none', outline: 'none',
            color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontSize: 13,
            flex: 1, boxShadow: 'none',
          }}
        />
        <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--mute)', border: '1px solid var(--line)', padding: '1px 5px', borderRadius: 4 }}>⌘K</kbd>
      </div>

      {/* Notification + Avatar */}
      <NotificationBell />
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--purple-2), var(--purple-3))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-serif)', fontSize: 14, color: '#fff',
        border: '1px solid var(--line)', flexShrink: 0,
      }}>
        {initial}
      </div>
    </header>
  )
}
