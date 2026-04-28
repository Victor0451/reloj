'use client'

import { useState, useCallback, useEffect } from 'react'
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
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PersonsTableProps {
  initialData: Awaited<ReturnType<typeof listPersons>>
  onEdit: (person: PersonRecord) => void
  onDeactivate: (id: string) => void
  onReactivate: (id: string) => void
  onNew: () => void
  onImport: () => void
  onRetry?: (id: string) => void
  onDiscard?: (id: string) => void
}

const statusLabels: Record<string, string> = {
  active: 'Sincronizado',
  inactive: 'Inactivo',
  pending_sync: 'Pendiente',
  sync_failed: 'Error',
  sync_dead_letter: 'Fallido',
}

const statusVariant: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  active: 'success',
  inactive: 'destructive',
  pending_sync: 'warning',
  sync_failed: 'destructive',
  sync_dead_letter: 'secondary',
}

const statusIcon: Record<string, React.ReactNode> = {
  active: <CheckCircle className="h-3 w-3" />,
  pending_sync: <Clock className="h-3 w-3" />,
  sync_failed: <AlertCircle className="h-3 w-3" />,
  sync_dead_letter: <XCircle className="h-3 w-3" />,
  inactive: null,
}

export default function PersonsTableServer({
  initialData,
  onEdit,
  onDeactivate,
  onReactivate,
  onNew,
  onImport,
  onRetry,
  onDiscard,
}: PersonsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [data, setData] = useState(initialData)
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all')
  const [loading, setLoading] = useState(false)

  // Sync local data when parent polling updates initialData prop
  useEffect(() => {
    setData(initialData)
  }, [initialData])

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

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 animate-in-premium">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, ID, departamento..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="input-outlined pl-10 h-10"
          />
        </div>

        <div className="flex w-full sm:w-auto items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium outline-none transition-all focus:border-primary focus:ring-3 focus:ring-primary/15"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="pending_sync">Pendientes</option>
            <option value="sync_failed">Error</option>
            <option value="sync_dead_letter">Fallidos</option>
            <option value="inactive">Inactivos</option>
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={onImport} className="btn-secondary h-10 px-4">
              <FileUp className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button onClick={onNew} className="btn-primary h-10 px-4">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Nueva Persona</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <Card className="glass-card overflow-hidden border-border/50 animate-in-premium-delay-1">
        {loading ? (
          <div className="p-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50 bg-muted/5">
                  {['Nombre', 'ID Empleado', 'Departamento', 'Estado', ''].map((h) => (
                    <TableHead key={h} className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border/30">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j} className="py-4">
                        <Skeleton className="h-5 w-full rounded-md" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : hasResults ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50 bg-muted/5">
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">Nombre</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">ID Empleado</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">Departamento</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">Estado</TableHead>
                  <TableHead className="w-12 h-11" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((person) => (
                  <TableRow key={person.id} className="group border-border/30 hover:bg-muted/10 transition-colors">
                    <TableCell className="font-bold text-sm py-4">{person.name}</TableCell>
                    <TableCell className="text-muted-foreground font-medium text-xs">
                      {person.employee_id || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium text-xs">
                      {person.department || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          title={
                            person.sync_error
                              ? `Intento ${person.sync_attempts}/3: ${person.sync_error}`
                              : person.sync_attempts > 0
                                ? `Intento ${person.sync_attempts}/3`
                                : undefined
                          }
                          className={cn(
                            "cursor-help",
                            person.sync_error && "border-l-2 border-l-destructive pl-2"
                          )}
                        >
                          <Badge
                            variant={statusVariant[person.status] ?? 'secondary'}
                            className="rounded-full px-2 py-0.5 font-bold uppercase text-[9px] inline-flex items-center gap-1"
                          >
                            {statusIcon[person.status]}
                            {statusLabels[person.status] ?? person.status}
                          </Badge>
                          {person.sync_attempts > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({person.sync_attempts}/3)
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                          }
                        >
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-card min-w-[160px] p-1 border-border/50">
                          <DropdownMenuItem 
                            onClick={() => onEdit(person)} 
                            className="rounded-lg focus:bg-primary/10 focus:text-primary cursor-pointer gap-2 px-2 py-1.5"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="font-medium text-sm">Editar</span>
                          </DropdownMenuItem>
                          {person.status !== 'inactive' ? (
                            <DropdownMenuItem
                              onClick={() => handleDeactivate(person.id)}
                              className="rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2 px-2 py-1.5"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="font-medium text-sm">Desactivar</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              onClick={() => handleReactivate(person.id)} 
                              className="rounded-lg focus:bg-primary/10 focus:text-primary cursor-pointer gap-2 px-2 py-1.5"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span className="font-medium text-sm">Reactivar</span>
                            </DropdownMenuItem>
                          )}
                          {person.status === 'sync_dead_letter' && (
                            <>
                              {onRetry && (
<DropdownMenuItem
                                  onClick={() => onRetry && onRetry(person.id)}
                                  className="rounded-lg focus:bg-primary/10 focus:text-primary cursor-pointer gap-2 px-2 py-1.5"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  <span className="font-medium text-sm">Reintentar</span>
                                </DropdownMenuItem>
                              )}
                              {onDiscard && (
<DropdownMenuItem
                                  onClick={() => onDiscard && onDiscard(person.id)}
                                  className="rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2 px-2 py-1.5"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="font-medium text-sm">Descartar</span>
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-12">
            <EmptyState
              icon={Users}
              title={searchInput ? 'Sin resultados' : 'Sin personas registradas'}
              description={
                searchInput
                  ? `No se encontraron resultados para "${searchInput}"`
                  : 'Comenzá agregando personas al sistema o importando un CSV.'
              }
            />
          </div>
        )}
      </Card>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 animate-in-premium-delay-2">
          <p className="text-xs font-medium text-muted-foreground">
            Mostrando <span className="text-foreground">{data.data.length}</span> de <span className="text-foreground">{data.count}</span> personas
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.page - 1)}
              disabled={data.page <= 1}
              className="btn-secondary h-8 px-3"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(data.totalPages, 5) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => handlePageChange(i + 1)}
                  className={cn(
                    "h-8 w-8 rounded-lg text-xs font-bold transition-all",
                    data.page === i + 1 
                      ? "bg-primary text-white shadow-md shadow-primary/20" 
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.page + 1)}
              disabled={data.page >= data.totalPages}
              className="btn-secondary h-8 px-3"
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
