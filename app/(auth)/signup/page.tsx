'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Mail, Lock, User, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
  ]
  const strength = checks.filter(Boolean).length
  const colors = ['hsl(0 72% 51%)', 'hsl(38 92% 50%)', 'hsl(142 71% 45%)']
  const labels = ['Weak', 'Fair', 'Strong']
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
               style={{ background: i < strength ? colors[strength - 1] : 'hsl(270 15% 18%)' }} />
        ))}
      </div>
      <p className="text-xs" style={{ color: strength > 0 ? colors[strength - 1] : 'hsl(270 8% 45%)' }}>
        {strength > 0 ? labels[strength - 1] : ''} {strength === 3 && '— great!'}
      </p>
    </div>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = await res.json()
    if (!res.ok) { setError(body.error); setLoading(false); return }

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) { setError(signInError.message); setLoading(false); return }

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
        <h1 className="text-2xl font-bold tracking-tight mb-1.5">Create your account</h1>
        <p className="text-sm" style={{ color: 'hsl(270 8% 52%)' }}>
          Start learning smarter with AI-powered knowledge graphs
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
              placeholder="Min. 6 characters"
              required
              minLength={6}
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
          <PasswordStrength password={password} />
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>
              : 'Create account'}
          </button>
        </div>

        <p className="text-xs text-center" style={{ color: 'hsl(270 8% 42%)' }}>
          By signing up you agree to our terms of service
        </p>
      </form>

      <div className="mt-6 pt-6" style={{ borderTop: '1px solid hsl(270 15% 14%)' }}>
        <p className="text-center text-sm" style={{ color: 'hsl(270 8% 50%)' }}>
          Already have an account?{' '}
          <Link href="/login"
                className="font-semibold transition-opacity hover:opacity-80"
                style={{ color: 'hsl(271 91% 72%)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
