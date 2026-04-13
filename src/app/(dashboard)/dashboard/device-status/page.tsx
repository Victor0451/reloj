import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function DeviceStatusPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Estado del Dispositivo</h1>
        <p className="text-muted-foreground">Ver información y estado del reloj biométrico</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Estado del Dispositivo</CardTitle>
          <CardDescription>Esta funcionalidad estará disponible próximamente</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">🚧 En desarrollo</p>
        </CardContent>
      </Card>
    </div>
  )
}
