'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Classroom } from '@/lib/supabase/types'

interface Props {
  projectId: string
}

export function AssignToClassroomDialog({ projectId }: Props) {
  const [open, setOpen] = useState(false)
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/classrooms')
      .then(r => r.json())
      .then(data => Array.isArray(data) && setClassrooms(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  async function assign(classroomId: string) {
    setAssigning(classroomId)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/assign-classroom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Failed to assign')
      } else {
        setDone(d => ({ ...d, [classroomId]: true }))
      }
    } finally {
      setAssigning(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5"
          style={{ color: 'hsl(38 92% 65%)', border: '1px solid hsl(38 92% 50% / 0.3)', background: 'hsl(38 92% 50% / 0.08)' }}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          Assign to classroom
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm" style={{ background: 'hsl(240 12% 8%)', border: '1px solid hsl(270 15% 16%)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>
            <GraduationCap className="h-4 w-4 text-yellow-400" />
            Assign to classroom
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-500 -mt-1">
          All students in the selected classroom will receive an independent copy of this project.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-gray-600 text-xs gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading classrooms…
          </div>
        ) : classrooms.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-600">
            You have no classrooms. Create one first.
          </div>
        ) : (
          <div className="space-y-2">
            {classrooms.map(c => (
              <div key={c.id}
                   className="flex items-center justify-between gap-3 p-3 rounded-xl"
                   style={{ background: 'hsl(240 12% 7%)', border: '1px solid hsl(270 15% 13%)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <GraduationCap className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(38 92% 55%)' }} />
                  <span className="text-sm text-gray-200 truncate">{c.name}</span>
                </div>
                {done[c.id] ? (
                  <span className="flex items-center gap-1 text-xs text-green-400 shrink-0">
                    <Check className="h-3.5 w-3.5" /> Assigned
                  </span>
                ) : (
                  <button
                    onClick={() => assign(c.id)}
                    disabled={assigning === c.id}
                    className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'hsl(38 92% 50% / 0.1)', border: '1px solid hsl(38 92% 50% / 0.25)', color: 'hsl(38 92% 65%)' }}
                  >
                    {assigning === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Assign'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg text-xs text-red-400 bg-red-950/50 border border-red-900">
            <X className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
