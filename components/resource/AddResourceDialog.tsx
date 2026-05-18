'use client'

import { useState } from 'react'
import { Plus, Link2, PlayCircle, FileText, FileType, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Resource, ResourceType } from '@/lib/supabase/types'

interface Props { projectId: string; onAdded: (r: Resource) => void }

const FILE_TYPES: ResourceType[] = ['pdf', 'docx']

const typeConfig: Record<ResourceType, { label: string; icon: React.ElementType; placeholder?: string }> = {
  youtube: { label: 'YouTube Video',   icon: PlayCircle, placeholder: 'https://youtube.com/watch?v=...' },
  url:     { label: 'Web Link',        icon: Link2,     placeholder: 'https://...' },
  pdf:     { label: 'PDF File',        icon: FileText,  placeholder: undefined },
  docx:    { label: 'Word Document',   icon: FileType,  placeholder: undefined },
  note:    { label: 'Text Note',       icon: StickyNote, placeholder: undefined },
}

export function AddResourceDialog({ projectId, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<ResourceType>('youtube')
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [noteText, setNoteText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFileType = FILE_TYPES.includes(type)
  const isNote = type === 'note'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      let res: Response
      if (isFileType && file) {
        const form = new FormData()
        form.append('projectId', projectId)
        form.append('type', type)
        form.append('file', file)
        res = await fetch('/api/resources', { method: 'POST', body: form })
      } else if (isNote) {
        res = await fetch('/api/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, label: label || 'Note', type, url: null, noteText }),
        })
      } else {
        res = await fetch('/api/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, label: label || url, type, url }),
        })
      }
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const resource = await res.json()
      onAdded(resource)
      setUrl(''); setLabel(''); setFile(null); setNoteText(''); setOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const TypeIcon = typeConfig[type].icon

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Add Resource
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a resource</DialogTitle>
          <DialogDescription>Add learning materials shared across all topics in this project.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {error && <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}

          <div className="space-y-1.5">
            <Label>Resource type</Label>
            <Select value={type} onValueChange={v => { setType(v as ResourceType); setUrl(''); setLabel(''); setFile(null) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(typeConfig) as [ResourceType, typeof typeConfig[ResourceType]][]).map(([val, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <SelectItem key={val} value={val}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {cfg.label}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {isFileType && (
            <div className="space-y-1.5">
              <Label>File</Label>
              <Input
                type="file"
                accept={type === 'pdf' ? '.pdf' : '.docx,.doc'}
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
          )}

          {isNote && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="note-label">Title</Label>
                <Input id="note-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="Note title" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note-text">Content</Label>
                <Textarea id="note-text" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Paste your notes here…" rows={5} required />
              </div>
            </>
          )}

          {!isFileType && !isNote && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="res-url">URL</Label>
                <Input
                  id="res-url"
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder={typeConfig[type].placeholder}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-label">Label (optional)</Label>
                <Input id="res-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="Friendly name" />
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Adding…' : (
              <><TypeIcon className="mr-2 h-4 w-4" /> Add {typeConfig[type].label}</>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
