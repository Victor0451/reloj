"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Home, Bell, Bookmark, Lock, User, MoreHorizontal } from "lucide-react"

const bottomNavVariants = cva(
  "fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t py-2 pb-safe",
  {
    variants: {
      variant: {
        default: "bg-card border-border",
        glass: "glass border-white/10 bg-white/5",
      },
      size: {
        default: "h-14",
        sm: "h-12",
        lg: "h-16",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const navItemVariants = cva(
  "flex flex-col items-center justify-center gap-0.5 transition-colors duration-200",
  {
    variants: {
      variant: {
        default: "text-muted-foreground hover:text-foreground",
        active: "text-primary",
      },
      size: {
        default: "text-xs",
        sm: "text-[10px]",
        lg: "text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BottomNavItemProps extends React.ComponentProps<"button"> {
  icon?: React.ReactNode
  label?: string
  isActive?: boolean
  badge?: number
  size?: "default" | "sm" | "lg"
}

function BottomNavItem({
  className,
  icon,
  label,
  isActive = false,
  badge,
  size = "default",
  ...props
}: BottomNavItemProps) {
  return (
    <button
      data-slot="bottom-nav-item"
      data-active={isActive}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-all duration-200",
        // Active indicator: border-left 2px solid primary (UI Kit spec)
        isActive && "border-l-2 border-primary",
        // Inactive: color #9CA3AF, Active: color #7C3AED
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
        // Size
        size === "sm" && "px-2 py-1",
        size === "lg" && "px-4 py-2",
        className
      )}
      {...props}
    >
      {/* Icon wrapper - 20-22px size (UI Kit spec) */}
      <span className="relative">
        {icon && (
          <span className="size-5 shrink-0 [&>svg]:size-5">
            {icon}
          </span>
        )}
        {/* Badge indicator */}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      
      {/* Label */}
      {label && (
        <span className={cn(
          "truncate",
          size === "sm" && "text-[10px]",
          size === "lg" && "text-sm"
        )}>
          {label}
        </span>
      )}
    </button>
  )
}

export interface BottomNavProps
  extends React.ComponentProps<"nav">,
    VariantProps<typeof bottomNavVariants> {
  items?: {
    icon?: React.ReactNode
    label: string
    isActive?: boolean
    badge?: number
    onClick?: () => void
  }[]
}

function BottomNav({
  className,
  variant = "default",
  size = "default",
  items = defaultItems,
  ...props
}: BottomNavProps) {
  return (
    <nav
      data-slot="bottom-nav"
      className={cn(bottomNavVariants({ variant, size }), className)}
      {...props}
    >
      {items.map((item, index) => (
        <BottomNavItem
          key={index}
          icon={item.icon}
          label={item.label}
          isActive={item.isActive}
          badge={item.badge}
          onClick={item.onClick}
        />
      ))}
    </nav>
  )
}

// Default items - UI Kit spec
const defaultItems = [
  { icon: <Home />, label: "Home", isActive: false },
  { icon: <Bell />, label: "Notifications", isActive: false },
  { icon: <Bookmark />, label: "Saved", isActive: false },
  { icon: <Lock />, label: "Security", isActive: false },
  { icon: <User />, label: "Profile", isActive: false },
]

export { BottomNav, bottomNavVariants, BottomNavItem, navItemVariants }
