import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const adminSupabase = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code)

    // Ensure user_profile exists (Google OAuth users bypass the trigger sometimes)
    if (session?.user) {
      const u = session.user
      const displayName = u.user_metadata?.full_name ?? u.user_metadata?.name ?? null
      await adminSupabase.from('user_profiles').upsert(
        { id: u.id, display_name: displayName },
        { onConflict: 'id', ignoreDuplicates: true }
      )
    }
  }
  return NextResponse.redirect(`${origin}/dashboard`)
}
