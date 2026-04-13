"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      icons={{
        success: (
          <CircleCheckIcon className="size-5 text-emerald-500" />
        ),
        info: (
          <InfoIcon className="size-5 text-blue-500" />
        ),
        warning: (
          <TriangleAlertIcon className="size-5 text-amber-500" />
        ),
        error: (
          <OctagonXIcon className="size-5 text-destructive" />
        ),
        loading: (
          <Loader2Icon className="size-5 animate-spin text-primary" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast group-[.toaster]:glass-card group-[.toaster]:!border group-[.toaster]:!border-border/50 group-[.toaster]:rounded-xl group-[.toaster]:shadow-premium group-[.toaster]:backdrop-blur-xl group-[.toaster]:ring-1 group-[.toaster]:ring-foreground/5 dark:group-[.toaster]:ring-white/10",
          title: "text-sm font-medium",
          description: "text-xs text-muted-foreground",
          actionButton: "text-sm font-medium",
          cancelButton: "text-sm font-medium text-muted-foreground",
          closeButton: "border-border/50",
          success: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
          error: "bg-destructive/10 text-destructive dark:bg-destructive/20",
          warning: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
          info: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
          loading: "bg-primary/5 text-primary",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
