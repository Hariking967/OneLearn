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

  const { topic, count = 10, fileIds } = await req.json()
  const query = topic?.trim() || 'key concepts and definitions'
  const chunks = await retrieveChunks(query, id, user.id, fileIds ?? [], 8)
  const context = chunks.map(c => c.content).join('\n\n')

  if (!context) return NextResponse.json({ flashcards: [] })

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Generate ${count} flashcards from this content. Return ONLY a valid JSON array, no other text:\n[{"front":"term or question","back":"definition or answer"}]\n\nContent:\n${context}`,
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return NextResponse.json({ flashcards: [] })

  try {
    return NextResponse.json({ flashcards: JSON.parse(match[0]) })
  } catch {
    return NextResponse.json({ flashcards: [] })
  }
}
