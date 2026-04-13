import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { SidebarInset } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/layout/theme-toggle'

interface User {
  email: string
  full_name?: string | null
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch full_name from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const userData: User = {
    email: user.email ?? '',
    full_name: (profile as { full_name: string | null } | null)?.full_name,
  }

  return (
    <SidebarProvider>
      <AppSidebar user={userData} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-glow animate-pulse" />
            <span className="text-xs text-muted-foreground">Sistema Activo</span>
            <ThemeToggle variant="icon" />
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-gradient-to-br from-muted/30 via-background to-muted/20 p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
