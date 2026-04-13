import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Users } from 'lucide-react'

export default function PersonsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-in-premium page-header">
        <h1 className="text-3xl font-bold tracking-tight">Personas</h1>
        <p className="text-muted-foreground">
          Gestión de empleados registrados en el reloj biométrico
        </p>
      </div>

      <div className="animate-in-premium-delay-1">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold">Empleados</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Alta, baja y modificación de personas con foto facial y huella
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5">
                <Users className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="mb-1 text-base font-medium text-foreground">Sin personas registradas</h3>
              <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
                Cuando el agente bridge esté activo, podrás gestionar personas con foto facial y huella desde aquí.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
