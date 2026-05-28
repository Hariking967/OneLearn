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

  const { fileId } = await req.json()
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })

  const { data: file } = await supabase
    .from('classroom_resource_files')
    .select('*')
    .eq('id', fileId)
    .eq('classroom_id', id)
    .single()
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  let rawText = ''

  if (file.storage_path) {
    const { data: blob } = await admin.storage
      .from('classroom-resources')
      .download(file.storage_path)

    if (!blob) return NextResponse.json({ error: 'Could not download file' }, { status: 500 })
    const buffer = Buffer.from(await blob.arrayBuffer())

    if (file.type === 'pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      rawText = (await pdfParse(buffer)).text
    } else if (file.type === 'docx') {
      const mammoth = await import('mammoth')
      rawText = (await mammoth.extractRawText({ buffer: buffer })).value
    } else {
      rawText = buffer.toString('utf-8')
    }
  } else if (file.url) {
    rawText = `Resource: ${file.name}\nURL: ${file.url}`
  }

  if (!rawText.trim()) {
    return NextResponse.json({ error: 'No text content extracted' }, { status: 422 })
  }

  const chunks = chunkText(rawText)
  const embeddings = await embedBatch(chunks)

  await admin.from('classroom_resource_chunks').delete().eq('file_id', fileId)

  const rows = chunks.map((content, i) => ({
    classroom_id: id,
    file_id: fileId,
    user_id: null,
    chunk_index: i,
    content,
    embedding: embeddings[i],
  }))

  const { error: insertError } = await admin.from('classroom_resource_chunks').insert(rows)
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  await admin.from('classroom_resource_files').update({ ingested: true }).eq('id', fileId)

  return NextResponse.json({ chunks: chunks.length })
}
