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

  const { topic, count = 5, fileIds } = await req.json()
  const query = topic?.trim() || 'key concepts'
  const chunks = await retrieveChunks(query, id, user.id, fileIds ?? [], 8)
  const context = chunks.map(c => c.content).join('\n\n')

  if (!context) return NextResponse.json({ questions: [] })

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Generate ${count} MCQ questions from this content. Return ONLY a valid JSON array:\n[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A. ...","explanation":"..."}]\n\nContent:\n${context}`,
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return NextResponse.json({ questions: [] })

  try {
    return NextResponse.json({ questions: JSON.parse(match[0]) })
  } catch {
    return NextResponse.json({ questions: [] })
  }
}
