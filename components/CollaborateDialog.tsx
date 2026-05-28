'use client'

import { useState } from 'react'
import { Users, Mail, Loader2, Check, X, UserPlus } from 'lucide-react'
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
}

export function CollaborateDialog({ projectId }: Props) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleInvite() {
    if (!email.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/collaboration/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, email: email.trim() }),
      })
      const body = await res.json()
      if (!res.ok) {
        setResult({ ok: false, msg: body.error ?? 'Failed to invite' })
      } else {
        setResult({ ok: true, msg: `${email} now has collaborative access.` })
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
          className="text-xs gap-1.5 text-violet-400 hover:text-violet-300 border border-violet-800 hover:bg-violet-950"
        >
          <Users className="h-3.5 w-3.5" />
          Collaborate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" style={{ background: 'hsl(240 12% 8%)', border: '1px solid hsl(270 15% 16%)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>
            <UserPlus className="h-4 w-4 text-violet-400" />
            Collaborate on project
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-500 -mt-1">
          Add a collaborator by email. Both of you will see and edit the same project in real-time.
        </p>

        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              placeholder="colleague@example.com"
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm bg-gray-900 border border-gray-800 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-700"
            />
          </div>
          <button
            onClick={handleInvite}
            disabled={loading || !email.trim()}
            className="h-9 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
            style={{ background: 'hsl(271 91% 65% / 0.15)', border: '1px solid hsl(271 91% 65% / 0.3)', color: 'hsl(271 91% 78%)' }}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Invite'}
          </button>
        </div>

        {result && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${result.ok ? 'text-green-400 bg-green-950/50 border border-green-900' : 'text-red-400 bg-red-950/50 border border-red-900'}`}>
            {result.ok ? <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
            {result.msg}
          </div>
        )}

        <div className="mt-2 p-3 rounded-lg text-xs text-gray-600" style={{ background: 'hsl(240 12% 7%)', border: '1px solid hsl(270 15% 12%)' }}>
          Collaborators can view and edit all topics and resources. They see live updates instantly.
        </div>
      </DialogContent>
    </Dialog>
  )
}
