import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  const { email } = await request.json()

  const { data: user, error: findError } = await adminSupabase
    .schema('auth')
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (findError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { error } = await adminSupabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
