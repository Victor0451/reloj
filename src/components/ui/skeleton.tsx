import { cn } from "@/lib/utils"

function Skeleton({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "card" | "text" | "avatar" | "button"
}) {
  const variantClasses = {
    default: "h-4 w-full",
    card: "h-32 w-full rounded-xl",
    text: "h-4 w-3/4",
    avatar: "h-10 w-10 rounded-full",
    button: "h-8 w-24 rounded-lg",
  }

  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-lg bg-muted/80",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
