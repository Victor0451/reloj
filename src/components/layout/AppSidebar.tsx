'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/actions/auth'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { 
  User, 
  Settings, 
  LogOut, 
  LayoutDashboard, 
  Users, 
  Clock, 
  FileText, 
  DoorOpen, 
  Monitor, 
  Shield, 
  Fingerprint 
} from 'lucide-react'

interface AppSidebarProps {
  user: {
    email: string
    full_name?: string | null
  }
}

const menuItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Personas', href: '/dashboard/persons', icon: Users },
  { title: 'Eventos', href: '/dashboard/events', icon: Clock },
  { title: 'Reportes', href: '/dashboard/reports', icon: FileText },
  { title: 'Control de Puerta', href: '/dashboard/door-control', icon: DoorOpen },
  { title: 'Relojes', href: '/dashboard/devices', icon: Monitor },
  { title: 'Auditoría', href: '/dashboard/audit', icon: Shield },
  { title: 'Configuración', href: '/dashboard/settings', icon: Settings },
]

function getInitials(name: string | null | undefined, email: string): string {
  if (name && name.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const initials = getInitials(user.full_name, user.email)
  const displayName = user.full_name || user.email

  return (
    <Sidebar className="w-[240px] flex-shrink-0 border-r border-sidebar-border/10 glass">
      <SidebarHeader className="px-6 py-8">
        <div className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary to-accent opacity-25 blur transition duration-1000 group-hover:opacity-50 group-hover:duration-200"></div>
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-lg">
              <Fingerprint className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="flex flex-col">
            <h2 className="text-base font-bold leading-tight tracking-tight text-foreground font-heading">Hikvision</h2>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Gestión Biométrica</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {menuItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={item.href} />}
                      className={cn(
                        "relative flex h-10 w-full items-center gap-3 rounded-lg px-3 transition-all duration-200",
                        isActive 
                          ? "bg-primary/10 text-primary font-semibold shadow-sm" 
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn(
                        "h-4.5 w-4.5 transition-colors duration-200",
                        isActive ? "text-primary" : "group-hover:text-primary"
                      )} />
                      <span className="text-sm font-medium">{item.title}</span>
                      {isActive && (
                        <div className="absolute left-0 h-5 w-1 rounded-r-full bg-primary animate-in fade-in slide-in-from-left-2 duration-300" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all duration-200 hover:bg-sidebar-accent border border-transparent hover:border-sidebar-border/50"
          >
            <div className="relative">
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-primary to-accent opacity-0 transition duration-300 group-hover:opacity-100"></div>
              <Avatar className="h-9 w-9 shrink-0 ring-2 ring-background">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary-dark text-xs font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight text-foreground">{displayName}</p>
              <p className="truncate text-[11px] font-medium text-muted-foreground leading-tight">{user.email}</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56 glass-card p-2 border-sidebar-border/50">
            <div className="flex items-center gap-3 p-2">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{displayName}</p>
                <p className="truncate text-[10px] font-medium text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <DropdownMenuSeparator className="my-2 bg-sidebar-border/50" />
            <DropdownMenuItem 
              render={<Link href="/dashboard/settings" className="flex items-center gap-2 w-full" />}
              className="rounded-lg focus:bg-primary/10 focus:text-primary cursor-pointer transition-colors px-2 py-1.5"
            >
              <User className="h-4 w-4" />
              <span className="text-sm font-medium">Mi Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              render={<Link href="/dashboard/settings" className="flex items-center gap-2 w-full" />}
              className="rounded-lg focus:bg-primary/10 focus:text-primary cursor-pointer transition-colors px-2 py-1.5"
            >
              <Settings className="h-4 w-4" />
              <span className="text-sm font-medium">Configuración</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-2 bg-sidebar-border/50" />
            <DropdownMenuItem className="rounded-lg focus:bg-destructive/10 focus:text-destructive cursor-pointer transition-colors">
              <form action={logout} className="flex w-full items-center">
                <LogOut className="mr-2 h-4 w-4" />
                <button type="submit" className="w-full text-left text-sm font-medium">
                  Cerrar Sesión
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
