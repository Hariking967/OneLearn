'use client'

import { useState } from 'react'
import { ClipboardList, Loader2, Plus, Trash2, CalendarClock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { ClassroomAssignment } from '@/lib/supabase/types'

interface MCQQuestion {
  question: string
  options: string[]
  correct: number
}

interface DescriptiveQuestion {
  question: string
  expectedAnswer: string
}

interface Props {
  classroomId: string
  onCreated: (assignment: ClassroomAssignment) => void
}

export function AssignmentCreatorDialog({ classroomId, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'mcq' | 'descriptive'>('mcq')
  const [deadline, setDeadline] = useState('')
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([
    { question: '', options: ['', '', '', ''], correct: 0 },
  ])
  const [descQuestions, setDescQuestions] = useState<DescriptiveQuestion[]>([
    { question: '', expectedAnswer: '' },
  ])
  const [autoCorrect, setAutoCorrect] = useState(true)
  const [aiTopics, setAiTopics] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addMcq() {
    setMcqQuestions(q => [...q, { question: '', options: ['', '', '', ''], correct: 0 }])
  }

  function addDesc() {
    setDescQuestions(q => [...q, { question: '', expectedAnswer: '' }])
  }

  async function handleAiGenerate() {
    if (!aiTopics.trim()) return
    setAiGenerating(true)
    setAiError(null)
    try {
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: aiTopics, type, numQuestions: 5 }),
      })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error ?? 'Generation failed'); return }
      if (type === 'mcq') {
        setMcqQuestions(data.questions.map((q: any) => ({
          question: q.question ?? '',
          options: q.options ?? ['', '', '', ''],
          correct: q.correct ?? 0,
        })))
      } else {
        setDescQuestions(data.questions.map((q: any) => ({
          question: q.question ?? '',
          expectedAnswer: q.expectedAnswer ?? '',
        })))
      }
      setStep(3)
    } finally { setAiGenerating(false) }
  }

  async function handleCreate() {
    if (!title.trim()) { setError('Title is required'); return }
    setLoading(true)
    setError(null)
    const questions = type === 'mcq' ? mcqQuestions : descQuestions
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, type, questions, deadline: deadline || null, auto_correct: autoCorrect }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Failed'); return }
      onCreated(body)
      setOpen(false)
      setStep(1)
      setTitle('')
      setDescription('')
      setDeadline('')
      setMcqQuestions([{ question: '', options: ['', '', '', ''], correct: 0 }])
      setDescQuestions([{ question: '', expectedAnswer: '' }])
      setAiTopics('')
      setAiError(null)
      setAutoCorrect(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: 'hsl(142 71% 45% / 0.1)', border: '1px solid hsl(142 71% 45% / 0.25)', color: 'hsl(142 71% 55%)' }}>
          <ClipboardList className="h-3 w-3" /> Create assignment
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'hsl(240 12% 8%)', border: '1px solid hsl(270 15% 16%)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>
            <ClipboardList className="h-4 w-4 text-green-400" />
            Create assignment
          </DialogTitle>
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{ width: 6, height: 6, borderRadius: '50%', background: step === s ? 'oklch(0.42 0.18 295)' : 'var(--line)', transition: 'background 0.2s' }} />
            ))}
          </div>
        </DialogHeader>

        {/* Step 1: Title / Description / Deadline */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Assignment title"
              className="w-full h-10 px-3 rounded-lg text-sm bg-gray-900 border border-gray-800 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-700"
            />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Instructions or context (optional)"
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border border-gray-800 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-700 resize-none"
            />
            <div className="flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-gray-600 shrink-0" />
              <input
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="flex-1 h-8 px-2 rounded-lg text-xs bg-gray-900 border border-gray-800 text-gray-400 focus:outline-none focus:border-gray-600"
              />
            </div>
            {error && <p style={{ fontSize: 12, color: 'hsl(0 85% 70%)', margin: 0, fontFamily: 'var(--font-mono)' }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={() => { if (!title.trim()) { setError('Title required'); return }; setError(null); setStep(2) }}
                style={{ padding: '7px 16px', borderRadius: 9, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)', fontSize: 13, cursor: 'pointer' }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: AI Generate or Manual Questions */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Type toggle */}
            <div style={{ display: 'flex', gap: 8 }}>
              {(['mcq', 'descriptive'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: type === t ? 'oklch(0.42 0.18 295 / 0.15)' : 'none', border: type === t ? '1px solid oklch(0.42 0.18 295 / 0.3)' : '1px solid var(--line)', color: type === t ? 'var(--purple-2)' : 'var(--mute)' }}>
                  {t === 'mcq' ? 'MCQ' : 'Descriptive'}
                </button>
              ))}
            </div>

            {/* AI Generate section */}
            <div style={{ padding: 14, borderRadius: 10, background: 'oklch(0.42 0.18 295 / 0.06)', border: '1px solid oklch(0.42 0.18 295 / 0.15)' }}>
              <p style={{ fontSize: 12, color: 'var(--purple-2)', margin: '0 0 8px', fontFamily: 'var(--font-mono)' }}>✨ AI Generate</p>
              <textarea
                value={aiTopics}
                onChange={e => setAiTopics(e.target.value)}
                placeholder="Enter topics (e.g. Binary Trees, Sorting algorithms)"
                rows={2}
                style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: 'var(--ink)', resize: 'none', boxSizing: 'border-box' }}
              />
              {aiError && <p style={{ fontSize: 11, color: 'hsl(0 85% 70%)', margin: '6px 0 0' }}>{aiError}</p>}
              <button
                onClick={handleAiGenerate}
                disabled={aiGenerating || !aiTopics.trim()}
                style={{ marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 8, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: aiGenerating || !aiTopics.trim() ? 'var(--mute)' : 'var(--purple-2)', fontSize: 12, cursor: aiGenerating || !aiTopics.trim() ? 'not-allowed' : 'pointer' }}>
                {aiGenerating ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</> : '✨ Generate Questions'}
              </button>
            </div>

            {/* Separator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <span style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>or add manually</span>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>

            {/* Manual question builder */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Questions</p>
              {type === 'mcq' ? (
                <>
                  {mcqQuestions.map((q, qi) => (
                    <div key={qi} className="p-4 rounded-xl space-y-3" style={{ background: 'hsl(240 12% 7%)', border: '1px solid hsl(270 15% 14%)' }}>
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-gray-600 mt-2 w-5 shrink-0">Q{qi+1}</span>
                        <input
                          value={q.question}
                          onChange={e => setMcqQuestions(qs => qs.map((x, i) => i === qi ? { ...x, question: e.target.value } : x))}
                          placeholder="Question text"
                          className="flex-1 h-9 px-3 rounded-lg text-sm bg-gray-900 border border-gray-800 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-800"
                        />
                        {mcqQuestions.length > 1 && (
                          <button onClick={() => setMcqQuestions(qs => qs.filter((_, i) => i !== qi))}
                                  className="mt-1 text-gray-700 hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="ml-7 grid grid-cols-2 gap-2">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${qi}`}
                              checked={q.correct === oi}
                              onChange={() => setMcqQuestions(qs => qs.map((x, i) => i === qi ? { ...x, correct: oi } : x))}
                              className="accent-green-500"
                            />
                            <input
                              value={opt}
                              onChange={e => setMcqQuestions(qs => qs.map((x, i) => i === qi ? { ...x, options: x.options.map((o, j) => j === oi ? e.target.value : o) } : x))}
                              placeholder={`Option ${oi + 1}`}
                              className="flex-1 h-8 px-2 rounded-lg text-xs bg-gray-900 border border-gray-800 text-gray-300 placeholder-gray-700 focus:outline-none focus:border-green-800"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="ml-7 text-xs text-gray-700">Select the correct answer with the radio button</p>
                    </div>
                  ))}
                  <button onClick={addMcq} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add question
                  </button>
                </>
              ) : (
                <>
                  {descQuestions.map((q, qi) => (
                    <div key={qi} className="p-4 rounded-xl space-y-2" style={{ background: 'hsl(240 12% 7%)', border: '1px solid hsl(270 15% 14%)' }}>
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-gray-600 mt-2 w-5 shrink-0">Q{qi+1}</span>
                        <input
                          value={q.question}
                          onChange={e => setDescQuestions(qs => qs.map((x, i) => i === qi ? { ...x, question: e.target.value } : x))}
                          placeholder="Question text"
                          className="flex-1 h-9 px-3 rounded-lg text-sm bg-gray-900 border border-gray-800 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-800"
                        />
                        {descQuestions.length > 1 && (
                          <button onClick={() => setDescQuestions(qs => qs.filter((_, i) => i !== qi))}
                                  className="mt-1 text-gray-700 hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="ml-7">
                        <textarea
                          value={q.expectedAnswer}
                          onChange={e => setDescQuestions(qs => qs.map((x, i) => i === qi ? { ...x, expectedAnswer: e.target.value } : x))}
                          placeholder="Model answer / expected points (for AI grading)"
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg text-xs bg-gray-900 border border-gray-800 text-gray-400 placeholder-gray-700 focus:outline-none focus:border-green-800 resize-none"
                        />
                      </div>
                    </div>
                  ))}
                  <button onClick={addDesc} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add question
                  </button>
                </>
              )}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <button onClick={() => setStep(1)} style={{ padding: '7px 14px', borderRadius: 9, background: 'none', border: '1px solid var(--line)', color: 'var(--mute)', fontSize: 13, cursor: 'pointer' }}>← Back</button>
              <button onClick={() => setStep(3)} style={{ padding: '7px 16px', borderRadius: 9, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)', fontSize: 13, cursor: 'pointer' }}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 3: Review + Auto-correct + Create */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--line)' }}>
              <p style={{ fontSize: 12, color: 'var(--mute)', margin: '0 0 8px', fontFamily: 'var(--font-mono)' }}>
                {(type === 'mcq' ? mcqQuestions : descQuestions).length} questions · {type === 'mcq' ? 'MCQ' : 'Descriptive'}
              </p>
              {(type === 'mcq' ? mcqQuestions : descQuestions).slice(0, 3).map((q: any, i: number) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--ink-2)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i + 1}. {q.question || '(empty)'}</p>
              ))}
              {(type === 'mcq' ? mcqQuestions : descQuestions).length > 3 && (
                <p style={{ fontSize: 11, color: 'var(--mute)', margin: 0 }}>+{(type === 'mcq' ? mcqQuestions : descQuestions).length - 3} more</p>
              )}
            </div>

            {/* Auto-correct toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 12, color: 'var(--ink-2)', flex: 1 }}>Auto-correct with AI on submission</span>
              <button
                onClick={() => setAutoCorrect(a => !a)}
                style={{ width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer', background: autoCorrect ? 'oklch(0.42 0.18 295)' : 'var(--bg-3)', border: '1px solid var(--line)', transition: 'background 0.2s', flexShrink: 0, outline: 'none' }}>
                <div style={{ position: 'absolute', top: 2, left: autoCorrect ? 17 : 2, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
              </button>
            </div>

            {error && <p style={{ fontSize: 12, color: 'hsl(0 85% 70%)', margin: 0, fontFamily: 'var(--font-mono)' }}>{error}</p>}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <button onClick={() => setStep(2)} style={{ padding: '7px 14px', borderRadius: 9, background: 'none', border: '1px solid var(--line)', color: 'var(--mute)', fontSize: 13, cursor: 'pointer' }}>← Back</button>
              <button
                onClick={handleCreate}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 9, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)', fontSize: 13, cursor: 'pointer' }}>
                {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null} Create
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
