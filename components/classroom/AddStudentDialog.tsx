'use client'

import { useState } from 'react'
import { UserPlus, Mail, Loader2, Check, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Props {
  classroomId: string
  onAdded?: () => void
}

export function AddStudentDialog({ classroomId, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleAdd() {
    if (!email.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const body = await res.json()
      if (!res.ok) {
        setResult({ ok: false, msg: body.error ?? 'Failed to add student' })
      } else {
        setResult({ ok: true, msg: `${email} has been added to the classroom.` })
        setEmail('')
        onAdded?.()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: 'hsl(271 91% 65% / 0.1)', border: '1px solid hsl(271 91% 65% / 0.25)', color: 'hsl(271 91% 75%)' }}>
          <UserPlus className="h-3 w-3" /> Add student
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm" style={{ background: 'hsl(240 12% 8%)', border: '1px solid hsl(270 15% 16%)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>
            <UserPlus className="h-4 w-4 text-violet-400" />
            Add student
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="student@example.com"
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm bg-gray-900 border border-gray-800 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-700"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={loading || !email.trim()}
            className="h-9 px-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-1"
            style={{ background: 'hsl(271 91% 65% / 0.15)', border: '1px solid hsl(271 91% 65% / 0.3)', color: 'hsl(271 91% 78%)' }}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
          </button>
        </div>
        {result && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${result.ok ? 'text-green-400 bg-green-950/50 border border-green-900' : 'text-red-400 bg-red-950/50 border border-red-900'}`}>
            {result.ok ? <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
            {result.msg}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
