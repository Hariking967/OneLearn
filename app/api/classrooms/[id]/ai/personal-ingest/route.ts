import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { chunkText } from '@/lib/rag/chunker'
import { embedBatch } from '@/lib/rag/embedder'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { resourceId } = await req.json()
  if (!resourceId) return NextResponse.json({ error: 'resourceId required' }, { status: 400 })

  const { data: resource } = await supabase
    .from('personal_resources')
    .select('*')
    .eq('id', resourceId)
    .eq('user_id', user.id)
    .single()
  if (!resource) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let rawText = ''
  if (resource.storage_path) {
    const { data: blob } = await admin.storage
      .from('personal-resources')
      .download(resource.storage_path)
    if (blob) {
      const buffer = Buffer.from(await blob.arrayBuffer())
      if (resource.type === 'pdf') {
        const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
        rawText = (await pdfParse(buffer)).text
      } else if (resource.type === 'docx') {
        const mammoth = await import('mammoth')
        rawText = (await mammoth.extractRawText({ buffer })).value
      } else {
        rawText = buffer.toString('utf-8')
      }
    }
  }

  if (!rawText.trim()) return NextResponse.json({ error: 'No text extracted' }, { status: 422 })

  const chunks = chunkText(rawText)
  const embeddings = await embedBatch(chunks)

  await admin.from('classroom_resource_chunks').delete().eq('file_id', resourceId).eq('user_id', user.id)

  const rows = chunks.map((content, i) => ({
    classroom_id: id,
    file_id: resourceId,
    user_id: user.id,
    chunk_index: i,
    content,
    embedding: embeddings[i],
  }))

  await admin.from('classroom_resource_chunks').insert(rows)
  await admin.from('personal_resources').update({ ingested: true }).eq('id', resourceId)

  return NextResponse.json({ chunks: chunks.length })
}
