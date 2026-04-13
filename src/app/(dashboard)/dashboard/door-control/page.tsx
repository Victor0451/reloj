import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { DoorOpen } from 'lucide-react'

export default function DoorControlPage() {
  return (
    <div className="space-y-8">
      <div className="animate-in-premium page-header">
        <h1 className="text-3xl font-bold tracking-tight">Control de Puerta</h1>
        <p className="text-muted-foreground">
          Abrí o cerrá la puerta de forma remota
        </p>
      </div>

      <div className="animate-in-premium-delay-1">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold">Control Remoto</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Estado de puerta y comandos de apertura/cierre
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5">
                <DoorOpen className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="mb-1 text-base font-medium text-foreground">Próximamente</h3>
              <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
                Cuando el agente bridge esté activo, podrás controlar la puerta de forma remota desde aquí.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
