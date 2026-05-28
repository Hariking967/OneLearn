import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { deepseekCompletion } from '@/lib/ai/deepseek-client'

type Ctx = { params: Promise<{ id: string; meetId: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id, meetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify meet exists and is in this classroom
  const { data: meet } = await supabase
    .from('classroom_meets')
    .select('*')
    .eq('id', meetId)
    .eq('classroom_id', id)
    .single()

  if (!meet) return NextResponse.json({ error: 'Meet not found' }, { status: 404 })

  // Fetch all transcript segments
  const { data: segments } = await supabase
    .from('meet_transcript_segments')
    .select('*')
    .eq('meet_id', meetId)
    .order('created_at', { ascending: true })

  if (!segments?.length) {
    return NextResponse.json({ error: 'No transcript to summarize' }, { status: 400 })
  }

  // Build transcript text with speaker labels
  const transcriptText = segments
    .map(s => `[${s.speaker_name}]: ${s.text}`)
    .join('\n')

  // Generate AI summary
  const summary = await deepseekCompletion({
    systemPrompt: `You are an educational AI assistant. Summarize the following classroom meeting transcript into a clear, structured set of notes.
Include:
- Key topics discussed
- Important concepts explained
- Action items or homework (if any)
- Key questions raised and answers given
- Any decisions made

Format as clean markdown with headers. Be concise but comprehensive.`,
    messages: [{ role: 'user', content: `Meeting transcript:\n\n${transcriptText}` }],
    temperature: 0.3,
    maxTokens: 2000,
  })

  // Mark meet as ended with summary
  await supabase
    .from('classroom_meets')
    .update({ status: 'ended', ended_at: new Date().toISOString(), summary })
    .eq('id', meetId)

  // Find the classroom's project to save the resource
  const admin = adminSupabase
  const { data: classroomProject } = await admin
    .from('classroom_projects')
    .select('project_id')
    .eq('classroom_id', id)
    .limit(1)
    .single()

  if (classroomProject) {
    const label = `Meet Notes: ${meet.title} (${new Date(meet.started_at).toLocaleDateString()})`
    const { data: resource } = await admin
      .from('resources')
      .insert({
        project_id: classroomProject.project_id,
        type: 'note',
        label,
        url: summary,
        ingest_status: 'pending',
      })
      .select()
      .single()

    // Trigger async ingestion
    if (resource) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/project/${classroomProject.project_id}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: resource.id }),
      }).catch(() => {})
    }
  }

  return NextResponse.json({ summary, ok: true })
}
