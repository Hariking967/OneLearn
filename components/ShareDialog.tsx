'use client'

import { useState } from 'react'
import { Share2, Mail, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Props {
  projectId: string
  projectName: string
}

export function ShareDialog({ projectId, projectName }: Props) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleShare() {
    if (!email.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/projects/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, email: email.trim() }),
      })
      const body = await res.json()
      if (!res.ok) {
        setResult({ ok: false, msg: body.error ?? 'Failed to share' })
      } else {
        setResult({ ok: true, msg: `A copy of "${projectName}" was sent to ${email}.` })
        setEmail('')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5 text-gray-400 hover:text-gray-200 border border-gray-700 hover:bg-gray-800"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share copy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" style={{ background: 'hsl(240 12% 8%)', border: '1px solid hsl(270 15% 16%)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>
            <Share2 className="h-4 w-4 text-gray-400" />
            Share a copy
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-500 -mt-1">
          The recipient gets an independent copy of this project. Their changes won&apos;t affect yours.
        </p>

        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleShare()}
              placeholder="recipient@example.com"
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm bg-gray-900 border border-gray-800 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600"
            />
          </div>
          <button
            onClick={handleShare}
            disabled={loading || !email.trim()}
            className="h-9 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
            style={{ background: 'hsl(270 15% 14%)', border: '1px solid hsl(270 15% 22%)', color: 'hsl(270 15% 75%)' }}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send copy'}
          </button>
        </div>

        {result && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${result.ok ? 'text-green-400 bg-green-950/50 border border-green-900' : 'text-red-400 bg-red-950/50 border border-red-900'}`}>
            {result.ok ? <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
            {result.msg}
          </div>
        )}

        <div className="mt-2 p-3 rounded-lg text-xs text-gray-600" style={{ background: 'hsl(240 12% 7%)', border: '1px solid hsl(270 15% 12%)' }}>
          Copied: project tree, topics, and resource links. The recipient gets their own independent copy.
        </div>
      </DialogContent>
    </Dialog>
  )
}
