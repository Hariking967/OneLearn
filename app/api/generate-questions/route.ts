import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deepseekCompletion } from '@/lib/ai/deepseek-client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topics, type, numQuestions = 5 } = await req.json()
  if (!topics) return NextResponse.json({ error: 'topics required' }, { status: 400 })

  const prompt = type === 'mcq'
    ? `Generate ${numQuestions} multiple choice questions about: ${topics}. Return a JSON array only (no markdown): [{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0}]. The "correct" field is the 0-based index of the correct option.`
    : `Generate ${numQuestions} descriptive questions about: ${topics}. Return a JSON array only (no markdown): [{"question": "...", "expectedAnswer": "..."}]`

  let raw = ''
  try {
    raw = await deepseekCompletion({ messages: [{ role: 'user', content: prompt }], temperature: 0.6, maxTokens: 2000 })
  } catch {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }

  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return NextResponse.json({ error: 'AI returned invalid format' }, { status: 500 })

  try {
    return NextResponse.json({ questions: JSON.parse(match[0]) })
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }
}
