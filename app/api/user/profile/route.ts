import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()

  if (!data) {
    const { data: created } = await supabase
      .from('user_profiles')
      .upsert({ id: user.id })
      .select().single()
    return NextResponse.json(created ?? { id: user.id })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowed: Record<string, unknown> = {}
  if (body.display_name !== undefined) allowed.display_name = body.display_name

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({ id: user.id, ...allowed, updated_at: new Date().toISOString() })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
