import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Monitor } from 'lucide-react'

export default function DeviceStatusPage() {
  return (
    <div className="space-y-8">
      <div className="animate-in-premium page-header">
        <h1 className="text-3xl font-bold tracking-tight">Estado del Dispositivo</h1>
        <p className="text-muted-foreground">
          Información del reloj, capacidades y estado de conexión
        </p>
      </div>

      <div className="animate-in-premium-delay-1">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold">Información del Dispositivo</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Estado del reloj Hikvision DS-K1T320MFWX
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5">
                <Monitor className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="mb-1 text-base font-medium text-foreground">Próximamente</h3>
              <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
                Cuando el agente bridge esté configurado, verás aquí el estado en tiempo real del dispositivo, firmware, capacidades y heartbeat.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
