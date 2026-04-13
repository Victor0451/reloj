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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, LayoutDashboard, Users, Clock, FileText, DoorOpen, Monitor, Settings, Shield } from 'lucide-react'

const menuItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Personas',
    href: '/dashboard/persons',
    icon: Users,
  },
  {
    title: 'Eventos',
    href: '/dashboard/events',
    icon: Clock,
  },
  {
    title: 'Reportes',
    href: '/dashboard/reports',
    icon: FileText,
  },
  {
    title: 'Control de Puerta',
    href: '/dashboard/door-control',
    icon: DoorOpen,
  },
  {
    title: 'Estado del Dispositivo',
    href: '/dashboard/device-status',
    icon: Monitor,
  },
  {
    title: 'Auditoría',
    href: '/dashboard/audit',
    icon: Shield,
  },
  {
    title: 'Configuración',
    href: '/dashboard/settings',
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-4 py-2">
          <h2 className="text-lg font-bold">Hikvision System</h2>
          <p className="text-xs text-muted-foreground">Gestión Biométrica</p>
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
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <SidebarMenuButton>
                  <User className="h-4 w-4" />
                  <span>Mi Cuenta</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
                <DropdownMenuItem>
                  <Link href="/dashboard/settings">Configuración</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <form action={logout}>
                    <button type="submit" className="w-full text-left text-destructive">
                      Cerrar Sesión
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
