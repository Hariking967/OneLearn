import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ id: string }> }

// GET: return user_tree_nodes for project (ordered by level, position)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_tree_nodes')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST: create a single node
export async function POST(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, parent_id, position } = await req.json()

  const { data, error } = await supabase
    .from('user_tree_nodes')
    .insert({
      project_id: projectId,
      user_id: user.id,
      name,
      description: description ?? null,
      parent_id: parent_id ?? null,
      position: position ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT: full replace — body is array of nodes
export async function PUT(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nodes: Array<{
    id?: string
    name: string
    description?: string | null
    parent_id?: string | null
    position?: number
  }> = await req.json()

  // Delete all existing nodes for this project+user
  const { error: delError } = await supabase
    .from('user_tree_nodes')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  if (!nodes.length) return NextResponse.json([])

  // Insert all new nodes
  const { data, error } = await supabase
    .from('user_tree_nodes')
    .insert(
      nodes.map((n, i) => ({
        project_id: projectId,
        user_id: user.id,
        name: n.name,
        description: n.description ?? null,
        parent_id: n.parent_id ?? null,
        position: n.position ?? i,
      }))
    )
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// DELETE: by node id (query param ?nodeId=...)
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id: _projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const nodeId = url.searchParams.get('nodeId')
  if (!nodeId) return NextResponse.json({ error: 'nodeId required' }, { status: 400 })

  const { error } = await supabase
    .from('user_tree_nodes')
    .delete()
    .eq('id', nodeId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
