'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trash2, ArrowRight, BookOpen, Sparkles, FolderOpen, Plus } from 'lucide-react'
import { CreateProjectDialog } from '@/components/project/CreateProjectDialog'
import type { Project } from '@/lib/supabase/types'

interface Props { initialProjects: Project[] }

export function DashboardClient({ initialProjects }: Props) {
  const [projects, setProjects] = useState(initialProjects)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
    setProjects(p => p.filter(proj => proj.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            Your Projects
          </h1>
          <p className="text-sm" style={{ color: 'hsl(270 8% 52%)' }}>
            {projects.length === 0
              ? 'Create your first AI-powered learning journey'
              : `${projects.length} project${projects.length !== 1 ? 's' : ''} — keep learning`}
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {/* Divider */}
      <div className="mb-8" style={{ height: '1px', background: 'linear-gradient(90deg, hsl(271 91% 65% / 0.3), transparent)' }} />

      {/* Empty state */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full blur-2xl"
                 style={{ background: 'hsl(271 91% 65% / 0.2)', transform: 'scale(1.5)' }} />
            <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl"
                 style={{ background: 'hsl(271 91% 65% / 0.12)', border: '1px solid hsl(271 91% 65% / 0.25)' }}>
              <Sparkles className="h-9 w-9" style={{ color: 'hsl(271 91% 68%)' }} />
            </div>
          </div>
          <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
          <p className="text-sm max-w-sm mb-8" style={{ color: 'hsl(270 8% 50%)' }}>
            Add a topic and our AI will build a personalised prerequisite knowledge graph to guide your learning.
          </p>
          <CreateProjectDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <div
              key={project.id}
              className="project-card group rounded-xl p-5 flex flex-col gap-4 relative"
            >
              {/* Delete button */}
              <button
                onClick={() => handleDelete(project.id)}
                disabled={deletingId === project.id}
                className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg hover:bg-red-500/10"
                style={{ color: 'hsl(270 8% 45%)' }}
              >
                <Trash2 className="h-3.5 w-3.5 hover:text-red-400 transition-colors" />
              </button>

              {/* Icon + Title */}
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                     style={{ background: 'hsl(271 91% 65% / 0.12)', border: '1px solid hsl(271 91% 65% / 0.2)' }}>
                  <FolderOpen className="h-4 w-4" style={{ color: 'hsl(271 91% 68%)' }} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="font-semibold text-sm leading-tight truncate pr-6">
                    {project.name}
                  </h3>
                  {project.main_topic && (
                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: 'hsl(271 91% 65% / 0.12)', color: 'hsl(271 91% 72%)', border: '1px solid hsl(271 91% 65% / 0.2)' }}>
                      <BookOpen className="h-2.5 w-2.5" />
                      {project.main_topic}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {project.description && (
                <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'hsl(270 8% 50%)' }}>
                  {project.description}
                </p>
              )}

              {/* Footer */}
              <div className="mt-auto pt-2" style={{ borderTop: '1px solid hsl(270 15% 13%)' }}>
                <Link href={`/project/${project.id}`}>
                  <button className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                          style={{ background: 'hsl(271 91% 65% / 0.1)', color: 'hsl(271 91% 72%)', border: '1px solid hsl(271 91% 65% / 0.18)' }}>
                    Open project
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </Link>
              </div>
            </div>
          ))}

          {/* New project card */}
          <CreateProjectDialog>
            <button className="project-card rounded-xl p-5 flex flex-col items-center justify-center gap-3 min-h-40 cursor-pointer transition-all border-dashed"
                    style={{ borderStyle: 'dashed', borderColor: 'hsl(270 15% 18%)' }}>
              <div className="flex items-center justify-center w-9 h-9 rounded-lg"
                   style={{ background: 'hsl(271 91% 65% / 0.08)', border: '1px dashed hsl(271 91% 65% / 0.3)' }}>
                <Plus className="h-4 w-4" style={{ color: 'hsl(271 91% 65% / 0.7)' }} />
              </div>
              <span className="text-xs font-medium" style={{ color: 'hsl(270 8% 45%)' }}>
                New project
              </span>
            </button>
          </CreateProjectDialog>
        </div>
      )}
    </div>
  )
}
