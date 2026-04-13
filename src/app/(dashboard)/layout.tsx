import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import {
  SidebarInset,
} from '@/components/ui/sidebar'

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

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
          <SidebarTrigger className="-ml-1" />
          <div className="ml-auto flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-glow animate-pulse" />
            <span className="text-xs text-muted-foreground">Sistema Activo</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-gradient-to-br from-muted/30 via-background to-muted/20 p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
