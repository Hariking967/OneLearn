import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { retrieveChunks } from '@/lib/rag/retriever'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: classroom } = await supabase
    .from('classrooms').select('id').eq('id', id).eq('teacher_id', user.id).single()
  if (!classroom) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { prompt, type, count = 5 } = await req.json()
  if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 })
  if (!['mcq', 'descriptive'].includes(type)) return NextResponse.json({ error: 'type must be mcq or descriptive' }, { status: 400 })

  const chunks = await retrieveChunks(prompt, id, user.id, [], 8)
  const context = chunks.length > 0
    ? chunks.map(c => c.content).join('\n\n---\n\n')
    : 'No classroom resources available yet.'

  const systemPrompt = type === 'mcq'
    ? `You are an exam writer. Generate exactly ${count} multiple-choice questions from the provided context. Return ONLY a valid JSON array, no other text:\n[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A. ...","explanation":"..."}]`
    : `You are an exam writer. Generate exactly ${count} descriptive questions from the provided context. Return ONLY a valid JSON array, no other text:\n[{"question":"...","model_answer":"...","marks":10}]`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Context from classroom resources:\n\n${context}\n\nTopic/Prompt: ${prompt}` }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })

  try {
    const questions = JSON.parse(jsonMatch[0])
    return NextResponse.json({ questions, type })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI' }, { status: 500 })
  }
}
