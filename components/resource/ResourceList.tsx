'use client'

import { FileText, PlayCircle, Link2, FileType, StickyNote, Trash2, Loader2, CheckCircle } from 'lucide-react'
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
  youtube: 'text-red-500',
  url:     'text-gray-500',
  note:    'text-yellow-500',
}

interface Props {
  resources: Resource[]
  projectId: string
  onDelete: (id: string) => void
}

export function ResourceList({ resources, projectId, onDelete }: Props) {
  if (resources.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 text-xs border border-dashed border-gray-800 rounded-xl">
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
          <li
            key={r.id}
            className="flex items-start justify-between gap-3 p-3 border border-gray-800 rounded-lg hover:bg-gray-800/40 transition-colors group"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div className={`shrink-0 mt-0.5 ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-200 truncate">{r.label}</p>
                {r.url && r.type !== 'note' && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-gray-600 hover:text-gray-400 hover:underline truncate max-w-[160px] block"
                  >
                    {r.url}
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              {(r.ingest_status === 'indexing') && (
                <span className="flex items-center gap-1 text-xs text-yellow-500 shrink-0">
                  <Loader2 className="h-3 w-3 animate-spin" /> Indexing…
                </span>
              )}
              {(r.ingest_status === 'done' || (r.ingested_at && r.ingest_status !== 'error')) && (
                <span className="flex items-center gap-1 text-xs text-green-500 shrink-0">
                  <CheckCircle className="h-3 w-3" /> Indexed
                </span>
              )}
              {r.ingest_status === 'error' && (
                <span className="text-xs text-red-500 shrink-0">Index failed</span>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(r.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-opacity h-6 w-6"
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
