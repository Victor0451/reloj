import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function DoorControlPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Control de Puerta</h1>
        <p className="text-muted-foreground">Abrir o cerrar la puerta de forma remota</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Control de Puerta</CardTitle>
          <CardDescription>Esta funcionalidad estará disponible próximamente</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">🚧 En desarrollo</p>
        </CardContent>
      </Card>
    </div>
  )
}
