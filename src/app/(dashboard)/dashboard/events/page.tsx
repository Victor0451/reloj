import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Clock } from 'lucide-react'

export default function EventsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-in-premium page-header">
        <h1 className="text-3xl font-bold tracking-tight">Eventos</h1>
        <p className="text-muted-foreground">
          Listado de eventos de acceso con filtros y exportación
        </p>
      </div>

      <div className="animate-in-premium-delay-1">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold">Eventos de Acceso</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Fichajes, intentos fallidos y aperturas de puerta
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5">
                <Clock className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="mb-1 text-base font-medium text-foreground">Sin eventos registrados</h3>
              <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
                Una vez configurado el agente bridge, los eventos de acceso se sincronizarán cada 30 segundos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
