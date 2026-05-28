'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'

export function StudyDigest() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    setLoading(true)
    setText('')
    try {
      const res = await fetch('/api/dashboard/digest')
      if (!res.ok || !res.body) { setLoading(false); return }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      setLoaded(true)
      setLoading(false)
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setText(prev => prev + decoder.decode(value, { stream: true }))
      }
    } catch {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (!loaded && !loading) return null

  return (
    <div
      className="rounded-2xl p-5 mb-8 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, hsl(271 91% 65% / 0.08), hsl(240 12% 9%))',
        border: '1px solid hsl(271 91% 65% / 0.2)',
      }}
    >
      {/* Glow */}
      <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full blur-3xl pointer-events-none"
           style={{ background: 'hsl(271 91% 65% / 0.12)' }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                 style={{ background: 'hsl(271 91% 65% / 0.15)', border: '1px solid hsl(271 91% 65% / 0.3)' }}>
              <Sparkles className="h-3.5 w-3.5" style={{ color: 'hsl(271 91% 70%)' }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'hsl(271 91% 72%)' }}>
              Today's Focus
            </span>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
            style={{ color: 'hsl(270 8% 45%)' }}
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : 'hover:opacity-80'}`} />
          </button>
        </div>

        {loading && !text && (
          <div className="flex items-center gap-2 py-2" style={{ color: 'hsl(270 8% 50%)' }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs">Thinking about your study plan…</span>
          </div>
        )}

        {text && (
          <p className="text-sm leading-relaxed" style={{ color: 'hsl(270 15% 78%)' }}>
            {text}
          </p>
        )}
      </div>
    </div>
  )
}
