import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reportes de Asistencia</h1>
        <p className="text-muted-foreground">Generar y exportar reportes de asistencia</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reportes</CardTitle>
          <CardDescription>Esta funcionalidad estará disponible próximamente</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">🚧 En desarrollo</p>
        </CardContent>
      </Card>
    </div>
  )
}
