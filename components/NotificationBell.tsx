'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, CheckCheck, X } from 'lucide-react'
import type { Notification } from '@/lib/supabase/types'

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(data => Array.isArray(data) && setNotifications(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setNotifications(n => n.map(x => ({ ...x, read: true })))
  }

  async function markRead(id: string) {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-all"
        style={{ color: 'hsl(270 8% 52%)', background: open ? 'hsl(271 91% 65% / 0.1)' : 'transparent' }}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center animate-pulse"
                style={{ background: 'hsl(271 91% 65%)', color: 'white', fontSize: '10px' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-up"
             style={{ background: 'hsl(240 12% 9%)', border: '1px solid hsl(270 15% 16%)' }}>
          <div className="flex items-center justify-between px-4 py-3"
               style={{ borderBottom: '1px solid hsl(270 15% 14%)' }}>
            <span className="text-sm font-semibold text-gray-200" style={{ fontFamily: 'var(--font-display)' }}>
              Notifications
            </span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
                  <CheckCheck className="h-3 w-3" /> All read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-600 text-xs gap-2">
                <Bell className="h-6 w-6 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                  style={{
                    borderBottom: '1px solid hsl(270 15% 11%)',
                    background: n.read ? 'transparent' : 'hsl(271 91% 65% / 0.04)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${n.read ? 'text-gray-500' : 'text-gray-200'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-xs text-gray-700 mt-1">
                      {new Date(n.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                         style={{ background: 'hsl(271 91% 65%)' }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
