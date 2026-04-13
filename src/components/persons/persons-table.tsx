'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDebouncedCallback } from 'use-debounce'
import { listPersons } from '@/actions/persons'
import type { PersonRecord } from '@/types/person.types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  Plus,
  FileUp,
  MoreVertical,
  Pencil,
  Trash2,
  RotateCcw,
  Users,
} from 'lucide-react'

interface PersonsTableProps {
  initialData: Awaited<ReturnType<typeof listPersons>>
  onEdit: (person: PersonRecord) => void
  onDeactivate: (id: string) => void
  onReactivate: (id: string) => void
  onNew: () => void
  onImport: () => void
}

const statusLabels: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  pending_sync: 'Pendiente',
}

const statusVariant: Record<string, 'success' | 'destructive' | 'warning'> = {
  active: 'success',
  inactive: 'destructive',
  pending_sync: 'warning',
}

export default function PersonsTableServer({
  initialData,
  onEdit,
  onDeactivate,
  onReactivate,
  onNew,
  onImport,
}: PersonsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [data, setData] = useState(initialData)
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all')
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(
    async (page: number, search: string, status: string) => {
      setLoading(true)
      const params = new URLSearchParams()
      if (page > 1) params.set('page', String(page))
      if (search) params.set('search', search)
      if (status && status !== 'all') params.set('status', status)
      router.replace(`?${params.toString()}`, { scroll: false })

      const result = await listPersons({
        page,
        search: search || undefined,
        statusFilter: status !== 'all' ? status : undefined,
      })
      setData(result)
      setLoading(false)
    },
    [router]
  )

  const debouncedSearch = useDebouncedCallback((value: string) => {
    fetchData(1, value, statusFilter)
  }, 300)

  function handleSearch(value: string) {
    setSearchInput(value)
    debouncedSearch(value)
  }

  function handleStatusFilter(value: string) {
    setStatusFilter(value)
    fetchData(1, searchInput, value)
  }

  function handlePageChange(page: number) {
    fetchData(page, searchInput, statusFilter)
  }

  async function handleDeactivate(id: string) {
    onDeactivate(id)
    await fetchData(data.page, searchInput, statusFilter)
  }

  async function handleReactivate(id: string) {
    onReactivate(id)
    await fetchData(data.page, searchInput, statusFilter)
  }

  const hasResults = data.data.length > 0 || loading
  const isEmpty = !hasResults && !searchInput && statusFilter === 'all'

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, ID, departamento..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="pending_sync">Pendientes</option>
          <option value="inactive">Inactivos</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onImport}>
            <FileUp className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button variant="gradient" size="sm" onClick={onNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Persona
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Table>
          <TableHeader>
            <TableRow>
              {['Nombre', 'ID Empleado', 'Departamento', 'Estado', 'Acciones'].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : hasResults ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>ID Empleado</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="font-medium">{person.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {person.employee_id || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {person.department || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[person.status] ?? 'secondary'}>
                      {statusLabels[person.status] ?? person.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(person)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        {person.status !== 'inactive' ? (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeactivate(person.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Desactivar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleReactivate(person.id)}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reactivar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {data.count} persona{data.count !== 1 ? 's' : ''} en total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.page - 1)}
                  disabled={data.page <= 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {data.page} de {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.page + 1)}
                  disabled={data.page >= data.totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Users}
          title={searchInput ? 'Sin resultados' : 'Sin personas registradas'}
          description={
            searchInput
              ? `No se encontraron resultados para "${searchInput}"`
              : 'Comenzá agregando personas al sistema o importando un CSV.'
          }
          action={
            !searchInput
              ? { label: 'Nueva Persona', href: '#' }
              : undefined
          }
        />
      )}
    </div>
  )
}
