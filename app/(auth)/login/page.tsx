'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

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
    <div className="neon-card" style={{ padding: 36 }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <div className="brand-mark" style={{ width: 26, height: 26, borderRadius: 8 }}>
          <div className="brand-mark-diamond" />
        </div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, letterSpacing: '-0.01em' }}>
          One<em style={{ fontStyle: 'italic', color: 'var(--purple-2)' }}>learn</em>
        </div>
      </div>

      {/* Heading */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, lineHeight: 1, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
          Welcome <em style={{ fontStyle: 'italic', color: 'var(--purple-2)' }}>back.</em>
        </h1>
        <p style={{ fontSize: 13, color: 'var(--mute)', margin: 0, fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' }}>
          Sign in to continue your learning journey
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 14px', borderRadius: 10, fontSize: 13,
            background: 'hsl(0 72% 51% / 0.08)',
            border: '1px solid hsl(0 72% 51% / 0.22)',
            color: 'hsl(0 85% 72%)',
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Email */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Email address
          </label>
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mute)" strokeWidth="1.6" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required
              className="neon-input"
              style={{ width: '100%', height: 42, paddingLeft: 38, paddingRight: 14, borderRadius: 10, fontSize: 13 }}
            />
          </div>
        </div>

        {/* Password */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mute)" strokeWidth="1.6" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input
              type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              className="neon-input"
              style={{ width: '100%', height: 42, paddingLeft: 38, paddingRight: 42, borderRadius: 10, fontSize: 13 }}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: 2 }}>
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary"
          style={{ height: 42, borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          {loading ? <><Loader2 size={14} className="animate-spin" /> Signing in…</> : <>Sign in <span style={{ transition: 'transform 0.18s' }}>→</span></>}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>

      <button type="button" onClick={handleGoogleSignIn} disabled={googleLoading || loading}
        style={{
          width: '100%', height: 42, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)',
          color: 'var(--ink-2)', cursor: 'pointer', transition: 'all 0.18s',
          opacity: (googleLoading || loading) ? 0.5 : 1,
        }}>
        {googleLoading ? <Loader2 size={14} className="animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </button>

      <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--line)', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--mute)', margin: 0, fontFamily: 'var(--font-mono)' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--purple-2)', fontWeight: 500 }}>
            Create one free
          </Link>
        </p>
      </div>
    </div>
  )
}
