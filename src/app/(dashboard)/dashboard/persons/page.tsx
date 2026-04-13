import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PersonsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestión de Personas</h1>
        <p className="text-muted-foreground">Administrar empleados registrados en el reloj biométrico</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Personas</CardTitle>
          <CardDescription>Esta funcionalidad estará disponible próximamente</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">🚧 En desarrollo</p>
        </CardContent>
      </Card>
    </div>
  )
}
