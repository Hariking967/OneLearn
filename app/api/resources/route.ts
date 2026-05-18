import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createResource, deleteResource } from '@/lib/db/resources'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const projectId = formData.get('projectId') as string
    const file = formData.get('file') as File
    const type = formData.get('type') as 'pdf' | 'docx'
    const storagePath = `${user.id}/${projectId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('resources')
      .upload(storagePath, file)
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
    const resource = await createResource(projectId, file.name, type, undefined, storagePath)
    return NextResponse.json(resource, { status: 201 })
  }

  const { projectId, label, type, url } = await req.json()
  if (!projectId || !label || !type) {
    return NextResponse.json({ error: 'projectId, label, type required' }, { status: 400 })
  }
  const resource = await createResource(projectId, label, type, url)
  return NextResponse.json(resource, { status: 201 })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await deleteResource(id)
  return new NextResponse(null, { status: 204 })
}
