'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Mail, Lock, Sparkles, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    let { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error?.message === 'Email not confirmed') {
      const confirmRes = await fetch('/api/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!confirmRes.ok) {
        const body = await confirmRes.json()
        setError(body.error ?? 'Failed to confirm account')
        setLoading(false)
        return
      }
      ;({ error } = await supabase.auth.signInWithPassword({ email, password }))
    }

    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="neon-card rounded-2xl p-8">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl"
             style={{ background: 'hsl(271 91% 65% / 0.15)', border: '1px solid hsl(271 91% 65% / 0.3)' }}>
          <Sparkles className="h-4.5 w-4.5" style={{ color: 'hsl(271 91% 70%)' }} />
        </div>
        <span className="font-bold text-lg gradient-text">OneLearn</span>
      </div>

      {/* Heading */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight mb-1.5">Welcome back</h1>
        <p className="text-sm" style={{ color: 'hsl(270 8% 52%)' }}>
          Sign in to continue your learning journey
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl text-sm"
               style={{ background: 'hsl(0 72% 51% / 0.1)', border: '1px solid hsl(0 72% 51% / 0.25)', color: 'hsl(0 85% 72%)' }}>
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: 'hsl(270 15% 78%)' }}>
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: 'hsl(270 8% 42%)' }} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="neon-input w-full h-11 pl-10 pr-4 rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: 'hsl(270 15% 78%)' }}>
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: 'hsl(270 8% 42%)' }} />
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="neon-input w-full h-11 pl-10 pr-12 rounded-xl text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-100"
              style={{ color: 'hsl(270 8% 42%)' }}
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
              : 'Sign in'}
          </button>
        </div>
      </form>

      <div className="mt-6 pt-6" style={{ borderTop: '1px solid hsl(270 15% 14%)' }}>
        <p className="text-center text-sm" style={{ color: 'hsl(270 8% 50%)' }}>
          Don't have an account?{' '}
          <Link href="/signup"
                className="font-semibold transition-opacity hover:opacity-80"
                style={{ color: 'hsl(271 91% 72%)' }}>
            Create one free
          </Link>
        </p>
      </div>
    </div>
  )
}
