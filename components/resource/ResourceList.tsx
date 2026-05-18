'use client'

import { FileText, PlayCircle, Link2, FileType, StickyNote, Trash2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Resource } from '@/lib/supabase/types'

const TypeIcon: Record<Resource['type'], React.ElementType> = {
  pdf:     FileText,
  docx:    FileType,
  youtube: PlayCircle,
  url:     Link2,
  note:    StickyNote,
}

const TypeColor: Record<Resource['type'], string> = {
  pdf:     'text-red-500',
  docx:    'text-blue-500',
  youtube: 'text-red-600',
  url:     'text-gray-500',
  note:    'text-yellow-600',
}

interface Props { resources: Resource[]; onDelete: (id: string) => void }

export function ResourceList({ resources, onDelete }: Props) {
  if (resources.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">
        No resources yet — add PDFs, YouTube videos, web links, or notes above.
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {resources.map(r => {
        const Icon = TypeIcon[r.type]
        const color = TypeColor[r.type]
        return (
          <li key={r.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-muted/40 transition-colors group">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`shrink-0 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.label}</p>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:underline truncate max-w-xs block"
                  >
                    {r.url}
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {r.ingested_at ? (
                <Badge variant="outline" className="text-xs text-green-600 border-green-200">Indexed</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Clock className="h-3 w-3" /> Pending
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(r.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity h-7 w-7"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
