import { Suspense } from 'react'
import { listPersons, createPerson, updatePerson, deletePerson, reactivatePerson } from '@/actions/persons'
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Users } from 'lucide-react'
import { PersonsClient } from './persons-client'

export default async function PersonsPage() {
  const initialData = await listPersons({ page: 1 })

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-in-premium page-header">
        <h1 className="text-3xl font-bold tracking-tight">Personas</h1>
        <p className="text-muted-foreground">
          Gestión de empleados registrados en el reloj biométrico
        </p>
      </div>

      {/* Main Content */}
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
            <Suspense fallback={<PersonsTableSkeleton />}>
              <PersonsClient
                initialData={initialData}
                createPerson={createPerson}
                updatePerson={updatePerson}
                deletePerson={deletePerson}
                reactivatePerson={reactivatePerson}
              />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PersonsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 max-w-sm" />
        <Skeleton className="h-9 w-44" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
