'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Sparkles, Search, AlertCircle, GitBranch, Bot } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog'

type Step = 'form' | 'choice' | 'searching' | 'building'

interface Props {
  children?: React.ReactNode
  classroomId?: string
}

export function CreateProjectDialog({ children, classroomId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [mainTopic, setMainTopic] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setStep('choice')
  }

  async function handleChooseAI() {
    setStep('searching')
    await new Promise(r => setTimeout(r, 800))
    setStep('building')

    const res = await fetch('/api/generate-graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName, mainTopic, classroomId }),
    })

    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Something went wrong')
      setStep('form')
      return
    }

    const { projectId } = await res.json()
    closeAndReset()
    router.push(`/project/${projectId}`)
    router.refresh()
  }

  async function handleChooseCustom() {
    setStep('building')
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName, mainTopic, pathMode: 'custom', classroomId }),
    })

    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Something went wrong')
      setStep('form')
      return
    }

    const { projectId } = await res.json()
    closeAndReset()
    router.push(`/project/${projectId}`)
    router.refresh()
  }

  function closeAndReset() {
    setOpen(false)
    setProjectName('')
    setMainTopic('')
    setStep('form')
    setError(null)
  }

  function handleOpenChange(val: boolean) {
    if (step === 'searching' || step === 'building') return
    setOpen(val)
    if (!val) closeAndReset()
  }

  const trigger = children ?? (
    <button
      className="btn-primary flex items-center gap-2 h-9 px-4 rounded-xl text-sm"
    >
      <Plus className="h-4 w-4" /> New Project
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md border-0 p-0 overflow-hidden"
                     style={{ background: 'hsl(240 12% 8%)', border: '1px solid hsl(270 25% 18%)', boxShadow: '0 32px 80px hsl(240 20% 3% / 0.95), 0 0 80px hsl(271 91% 65% / 0.08)' }}>
        {/* Accessibility: Hidden title for screen readers */}
        <DialogTitle className="sr-only">Create new learning project</DialogTitle>
        <DialogDescription className="sr-only">
          Enter a project name and main topic. AI will build a personalized knowledge graph with prerequisites and learning paths.
        </DialogDescription>

        {step === 'form' && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg"
                   style={{ background: 'hsl(271 91% 65% / 0.15)', border: '1px solid hsl(271 91% 65% / 0.25)' }}>
                <Sparkles className="h-4 w-4" style={{ color: 'hsl(271 91% 68%)' }} />
              </div>
              <h2 className="font-semibold text-base">New learning project</h2>
            </div>
            <p className="text-sm mb-6 ml-11" style={{ color: 'hsl(270 8% 50%)' }}>
              AI will build a personalised knowledge graph from your topic.
            </p>

            {error && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl text-sm mb-4"
                   style={{ background: 'hsl(0 72% 51% / 0.1)', border: '1px solid hsl(0 72% 51% / 0.25)', color: 'hsl(0 85% 72%)' }}>
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: 'hsl(270 15% 78%)' }}>
                  Project name
                </label>
                <input
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="e.g. Machine Learning Mastery"
                  required
                  className="neon-input w-full h-10 px-3.5 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: 'hsl(270 15% 78%)' }}>
                  Main topic to learn
                </label>
                <input
                  value={mainTopic}
                  onChange={e => setMainTopic(e.target.value)}
                  placeholder="e.g. Machine Learning, Quantum Physics, React…"
                  required
                  className="neon-input w-full h-10 px-3.5 rounded-xl text-sm"
                />
                <p className="text-xs" style={{ color: 'hsl(270 8% 42%)' }}>
                  AI will search the web and create a prerequisite knowledge graph.
                </p>
              </div>

              <div className="pt-1">
                <button type="submit" className="btn-primary w-full h-10 rounded-xl text-sm flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate knowledge graph
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'choice' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg"
                   style={{ background: 'hsl(271 91% 65% / 0.15)', border: '1px solid hsl(271 91% 65% / 0.25)' }}>
                <GitBranch className="h-4 w-4" style={{ color: 'hsl(271 91% 68%)' }} />
              </div>
              <h2 className="font-semibold text-base">Choose your learning path</h2>
            </div>
            <p className="text-sm mb-6 ml-11" style={{ color: 'hsl(270 8% 50%)' }}>
              How do you want to structure your learning for <span style={{ color: 'hsl(270 15% 85%)' }}>"{mainTopic}"</span>?
            </p>
            {error && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl text-sm mb-4"
                   style={{ background: 'hsl(0 72% 51% / 0.1)', border: '1px solid hsl(0 72% 51% / 0.25)', color: 'hsl(0 85% 72%)' }}>
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-3">
              <button onClick={handleChooseAI}
                className="w-full text-left p-4 rounded-xl transition-all"
                style={{ background: 'hsl(271 91% 65% / 0.08)', border: '1px solid hsl(271 91% 65% / 0.25)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(271 91% 65% / 0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'hsl(271 91% 65% / 0.08)')}>
                <div className="flex items-center gap-3 mb-1">
                  <Bot className="h-4 w-4 shrink-0" style={{ color: 'hsl(271 91% 68%)' }} />
                  <span className="font-medium text-sm">Let AI build my learning path</span>
                  <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: 'hsl(271 91% 65% / 0.2)', color: 'hsl(271 91% 75%)' }}>Recommended</span>
                </div>
                <p className="text-xs ml-7" style={{ color: 'hsl(270 8% 50%)' }}>AI generates a prerequisite knowledge graph with the best learning order.</p>
              </button>
              <button onClick={handleChooseCustom}
                className="w-full text-left p-4 rounded-xl transition-all"
                style={{ background: 'hsl(240 12% 10%)', border: '1px solid hsl(270 25% 18%)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'hsl(271 91% 65% / 0.4)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'hsl(270 25% 18%)')}>
                <div className="flex items-center gap-3 mb-1">
                  <GitBranch className="h-4 w-4 shrink-0" style={{ color: 'hsl(270 15% 70%)' }} />
                  <span className="font-medium text-sm">I'll define my own path</span>
                </div>
                <p className="text-xs ml-7" style={{ color: 'hsl(270 8% 50%)' }}>Add topics yourself and build your own learning structure.</p>
              </button>
            </div>
            <button onClick={() => setStep('form')} className="mt-4 text-xs w-full text-center" style={{ color: 'hsl(270 8% 45%)' }}>← Back</button>
          </div>
        )}

        {step === 'searching' && (
          <div className="flex flex-col items-center justify-center py-16 px-6 gap-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl"
                   style={{ background: 'hsl(271 91% 65% / 0.3)', transform: 'scale(1.8)' }} />
              <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl"
                   style={{ background: 'hsl(271 91% 65% / 0.12)', border: '1px solid hsl(271 91% 65% / 0.25)' }}>
                <Search className="h-7 w-7 animate-pulse-glow" style={{ color: 'hsl(271 91% 68%)' }} />
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold mb-1">Searching the web…</p>
              <p className="text-sm" style={{ color: 'hsl(270 8% 50%)' }}>
                Finding the best resources for <span style={{ color: 'hsl(270 15% 85%)' }}>"{mainTopic}"</span>
              </p>
            </div>
          </div>
        )}

        {step === 'building' && (
          <div className="flex flex-col items-center justify-center py-16 px-6 gap-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl"
                   style={{ background: 'hsl(271 91% 65% / 0.3)', transform: 'scale(1.8)' }} />
              <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl"
                   style={{ background: 'hsl(271 91% 65% / 0.12)', border: '1px solid hsl(271 91% 65% / 0.25)' }}>
                <Sparkles className="h-7 w-7 animate-spin" style={{ color: 'hsl(271 91% 68%)' }} />
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold mb-1">Building your knowledge graph…</p>
              <p className="text-sm" style={{ color: 'hsl(270 8% 50%)' }}>
                AI is mapping prerequisites and learning paths
              </p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-1.5 w-1.5 rounded-full animate-bounce"
                     style={{ background: 'hsl(271 91% 65%)', boxShadow: '0 0 6px hsl(271 91% 65%)', animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
