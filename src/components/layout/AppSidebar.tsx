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
import { User, Settings, LogOut, LayoutDashboard, Users, Clock, FileText, DoorOpen, Monitor, Shield, Fingerprint } from 'lucide-react'

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
  { title: 'Estado del Dispositivo', href: '/dashboard/device-status', icon: Monitor },
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
    <Sidebar>
      <SidebarHeader className="border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
            <Fingerprint className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-bold leading-tight tracking-tight">Hikvision</h2>
            <p className="text-[10px] text-muted-foreground leading-tight">Gestión Biométrica</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="peer/menu-button group/menu-button flex w-full items-center gap-3 overflow-hidden rounded-md p-2 text-left text-sm text-sidebar-foreground ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground data-[size=default]:h-12"
          >
            <Avatar className="h-8 w-8 shrink-0 ring-2 ring-sidebar-border/50">
              <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary/60 text-[11px] font-semibold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">{displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground leading-tight">{user.email}</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
            <DropdownMenuItem className="cursor-default" disabled>
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link href="/dashboard/settings" className="flex w-full items-center gap-2">
                <User className="h-4 w-4" />
                <span>Mi Perfil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link href="/dashboard/settings" className="flex w-full items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Configuración</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <form action={logout} className="flex w-full items-center">
                <LogOut className="mr-2 h-4 w-4" />
                <button type="submit" className="w-full text-left">
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
