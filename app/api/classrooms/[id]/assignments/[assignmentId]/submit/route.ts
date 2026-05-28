import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { answers } = await request.json()

  const { data: assignment } = await supabase
    .from('classroom_assignments')
    .select('*').eq('id', assignmentId).single()
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  let score: number | null = null
  let ai_review: unknown = null

  if (assignment.type === 'mcq' && Array.isArray(assignment.questions) && Array.isArray(answers)) {
    const questions = assignment.questions as Array<{ question: string; options: string[]; correct: number }>
    let correct = 0
    const review: Array<{ question: string; correct: boolean; correctAnswer: string; userAnswer: string }> = []
    questions.forEach((q, i) => {
      const isCorrect = answers[i] === q.correct
      if (isCorrect) correct++
      review.push({ question: q.question, correct: isCorrect, correctAnswer: q.options[q.correct], userAnswer: q.options[answers[i]] ?? 'No answer' })
    })
    score = Math.round((correct / questions.length) * 100)
    ai_review = review
  } else if (assignment.type === 'descriptive' && OPENROUTER_API_KEY) {
    const questions = assignment.questions as Array<{ question: string; expectedAnswer?: string }>
    try {
      const prompt = `You are grading student descriptive answers. For each question, provide a score (0-10) and brief feedback.\n\n${
        questions.map((q, i) => `Q${i+1}: ${q.question}\nExpected: ${q.expectedAnswer ?? 'Open ended'}\nStudent Answer: ${(answers as string[])[i] ?? 'No answer'}`).join('\n\n')
      }\n\nReturn JSON: { "total_score": number (0-100), "reviews": [{ "question_index": number, "score": number, "feedback": string }] }`

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      })
      const json = await res.json()
      const parsed = JSON.parse(json.choices[0].message.content)
      score = parsed.total_score
      ai_review = parsed.reviews
    } catch {
      score = null
    }
  }

  const { data, error } = await supabase
    .from('assignment_submissions')
    .upsert({ assignment_id: assignmentId, student_id: user.id, answers, score, ai_review })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
