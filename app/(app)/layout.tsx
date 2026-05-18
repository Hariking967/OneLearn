import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen" style={{ background: '#0d0d14' }}>
      <Sidebar userEmail={user.email} />
      <main className="flex-1 overflow-auto" style={{ background: '#111118' }}>{children}</main>
    </div>
  )
}
