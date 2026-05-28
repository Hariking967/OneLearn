import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { retrieveChunks } from '@/lib/rag/retriever'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const { chatId, message, strictFileIds } = await req.json()
  if (!chatId || !message) return new Response(JSON.stringify({ error: 'chatId and message required' }), { status: 400 })

  await admin.from('classroom_ai_messages').insert({ chat_id: chatId, role: 'user', content: message })

  const chunks = await retrieveChunks(message, id, user.id, strictFileIds ?? [], 6)
  const context = chunks.length > 0
    ? `Relevant context from classroom resources:\n\n${chunks.map(c => c.content).join('\n\n---\n\n')}`
    : 'No relevant context found in the classroom resources.'

  const { data: history } = await admin
    .from('classroom_ai_messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(20)

  const messages: { role: 'user' | 'assistant'; content: string }[] = (history ?? [])
    .slice(0, -1)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  messages.push({
    role: 'user',
    content: `${context}\n\nQuestion: ${message}`,
  })

  const strictNote = strictFileIds?.length
    ? '\n\nIMPORTANT: You are in strict resource mode. Only use the provided context to answer. Do not use general knowledge.'
    : ''

  const stream = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are OneAI, a classroom learning assistant. Help students understand their course material using the provided resource context.${strictNote}`,
    messages,
    stream: true,
  })

  const encoder = new TextEncoder()
  let fullResponse = ''

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            fullResponse += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } finally {
        await admin.from('classroom_ai_messages').insert({
          chat_id: chatId,
          role: 'assistant',
          content: fullResponse || '(no response)',
        })
        const { data: chat } = await admin
          .from('classroom_ai_chats')
          .select('title')
          .eq('id', chatId)
          .single()
        if (chat?.title === 'New Chat' && message.length > 0) {
          await admin
            .from('classroom_ai_chats')
            .update({ title: message.slice(0, 60) })
            .eq('id', chatId)
        }
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
