'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ClipboardList, CheckCircle, Loader2, Clock } from 'lucide-react'
import type { ClassroomAssignment, AssignmentSubmission } from '@/lib/supabase/types'

interface Props {
  assignment: ClassroomAssignment
  existingSubmission: AssignmentSubmission | null
}

export function AssignmentPageClient({ assignment, existingSubmission }: Props) {
  const questions = (assignment.questions as any[]) ?? []
  const [mcqAnswers, setMcqAnswers] = useState<number[]>(Array(questions.length).fill(-1))
  const [descAnswers, setDescAnswers] = useState<string[]>(Array(questions.length).fill(''))
  const [submitted, setSubmitted] = useState(!!existingSubmission)
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(existingSubmission)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    try {
      const answers = assignment.type === 'mcq' ? mcqAnswers : descAnswers
      const res = await fetch(`/api/classrooms/${assignment.classroom_id}/assignments/${assignment.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (res.ok) {
        const body = await res.json()
        setSubmission(body)
        setSubmitted(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const review = submission?.ai_review as any[]

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <header className="animate-fade-down border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-4 shrink-0">
        <Link href="/dashboard">
          <button className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-all">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </Link>
        <div className="flex items-center gap-2.5">
          <ClipboardList className="h-4 w-4 text-green-400" />
          <h1 className="text-sm font-bold text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>
            {assignment.title}
          </h1>
        </div>
        {assignment.deadline && (
          <div className="flex items-center gap-1 text-xs text-gray-600 ml-2">
            <Clock className="h-3 w-3" />
            Due {new Date(assignment.deadline).toLocaleString()}
          </div>
        )}
        {submitted && submission?.score != null && (
          <div className="ml-auto flex items-center gap-1.5 text-sm font-bold"
               style={{ color: (submission.score >= 70) ? 'hsl(142 71% 55%)' : (submission.score >= 40) ? 'hsl(38 92% 65%)' : 'hsl(0 72% 60%)' }}>
            <CheckCircle className="h-4 w-4" />
            Score: {submission.score}%
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        {assignment.description && (
          <p className="text-sm text-gray-500 mb-6 p-4 rounded-xl" style={{ background: 'hsl(240 12% 8%)', border: '1px solid hsl(270 15% 14%)' }}>
            {assignment.description}
          </p>
        )}

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl text-center" style={{ background: 'hsl(142 71% 45% / 0.08)', border: '1px solid hsl(142 71% 45% / 0.25)' }}>
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-400" style={{ fontFamily: 'var(--font-display)' }}>
                {submission?.score != null ? `You scored ${submission.score}%` : 'Submitted successfully'}
              </p>
            </div>

            {Array.isArray(review) && review.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Review</h3>
                {review.map((r: any, i: number) => (
                  <div key={i} className="p-4 rounded-xl" style={{ background: 'hsl(240 12% 8%)', border: `1px solid ${r.correct !== false ? 'hsl(142 71% 45% / 0.2)' : 'hsl(0 72% 51% / 0.2)'}` }}>
                    <p className="text-xs font-medium text-gray-300 mb-1">
                      {assignment.type === 'mcq' ? r.question : `Q${(r.question_index ?? i) + 1}`}
                    </p>
                    {assignment.type === 'mcq' ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className={r.correct ? 'text-green-400' : 'text-red-400'}>{r.correct ? '✓ Correct' : '✗ Incorrect'}</span>
                        {!r.correct && <span className="text-gray-600">Correct: {r.correctAnswer}</span>}
                      </div>
                    ) : (
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Score:</span>
                          <span className={`font-semibold ${(r.score ?? 0) >= 7 ? 'text-green-400' : (r.score ?? 0) >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {r.score}/10
                          </span>
                        </div>
                        {r.feedback && <p className="text-gray-500">{r.feedback}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((q: any, qi: number) => (
              <div key={qi} className="p-5 rounded-2xl animate-fade-up" style={{ background: 'hsl(240 12% 8%)', border: '1px solid hsl(270 15% 14%)', animationDelay: `${qi * 60}ms` }}>
                <p className="text-sm font-semibold text-gray-200 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                  <span className="text-gray-600 mr-2">Q{qi + 1}.</span>
                  {q.question}
                </p>
                {assignment.type === 'mcq' ? (
                  <div className="space-y-2">
                    {(q.options as string[]).map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() => setMcqAnswers(a => a.map((x, i) => i === qi ? oi : x))}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all"
                        style={mcqAnswers[qi] === oi ? {
                          background: 'hsl(271 91% 65% / 0.12)',
                          border: '1px solid hsl(271 91% 65% / 0.35)',
                          color: 'hsl(271 91% 80%)',
                        } : {
                          background: 'hsl(240 12% 6%)',
                          border: '1px solid hsl(270 15% 12%)',
                          color: 'hsl(270 8% 60%)',
                        }}
                      >
                        <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs shrink-0"
                              style={mcqAnswers[qi] === oi ? { borderColor: 'hsl(271 91% 65%)', background: 'hsl(271 91% 65%)', color: 'white' } : { borderColor: 'hsl(270 15% 22%)' }}>
                          {String.fromCharCode(65 + oi)}
                        </span>
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={descAnswers[qi]}
                    onChange={e => setDescAnswers(a => a.map((x, i) => i === qi ? e.target.value : x))}
                    placeholder="Write your answer here…"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl text-sm bg-gray-950 border border-gray-800 text-gray-200 placeholder-gray-700 focus:outline-none focus:border-violet-700 resize-none"
                  />
                )}
              </div>
            ))}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{ background: 'hsl(142 71% 45% / 0.15)', border: '1px solid hsl(142 71% 45% / 0.3)', color: 'hsl(142 71% 55%)', fontFamily: 'var(--font-display)' }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4" /> Submit assignment</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
