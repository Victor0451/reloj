"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg" | "xl"
  variant?: "default" | "active" | "online"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex shrink-0 select-none",
        // Size variants - UI Kit specs
        "size-8", // default: 32-40px
        "data-[size=sm]:size-6", // small: 32px
        "data-[size=lg]:size-16", // large: 64px
        "data-[size=xl]:size-20", // xl: 80px
        
        // Border variants - UI Kit specs
        "rounded-full",
        "data-[variant=default]:border-2 data-[variant=default]:border-border",
        "data-[variant=active]:border-2 data-[variant=active]:border-primary-light",
        "data-[variant=online]:border-2 data-[variant=online]:border-primary-light",
        
        // After pseudo-element for ring effect
        "after:absolute after:inset-0 after:rounded-full after:mix-blend-darken",
        "dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-muted-foreground",
        "group-data-[size=sm]/avatar:text-xs",
        "group-data-[size=lg]/avatar:text-lg",
        "group-data-[size=xl]/avatar:text-xl",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, variant = "default", ...props }: React.ComponentProps<"span"> & { variant?: "default" | "online" | "add" }) {
  return (
    <span
      data-slot="avatar-badge"
      data-variant={variant}
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 ring-background select-none",
        // Default: primary badge
        "bg-primary text-primary-foreground",
        "data-[variant=default]:bg-primary data-[variant=default]:text-primary-foreground",
        
        // Online: green indicator (UI Kit spec)
        "data-[variant=online]:bg-success data-[variant=online]:text-white data-[variant=online]:size-2.5",
        
        // Add: violet badge with plus (UI Kit spec)
        "data-[variant=add]:bg-primary data-[variant=add]:text-white data-[variant=add]:size-4 data-[variant=add]:text-xs",
        
        // Size adjustments
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        "group-data-[size=xl]/avatar:size-4 group-data-[size=xl]/avatar:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, variant = "default", ...props }: React.ComponentProps<"div"> & { variant?: "default" | "story" }) {
  return (
    <div
      data-slot="avatar-group"
      data-variant={variant}
      className={cn(
        "group/avatar-group flex",
        // Default: overlap with ring
        "data-[variant=default]:-space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        
        // Story: horizontal scroll (UI Kit spec)
        "data-[variant=story]:gap-2 data-[variant=story]:overflow-x-auto data-[variant=story]:pb-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
