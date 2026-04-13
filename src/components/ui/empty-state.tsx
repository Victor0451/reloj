import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"
import Link from "next/link"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    href: string
  }
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 py-16 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5">
        <Icon className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <h3 className="mb-1 text-base font-medium text-foreground">{title}</h3>
      <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && (
        <Button variant="gradient" size="sm" render={<Link href={action.href} />}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
