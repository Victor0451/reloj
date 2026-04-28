'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Calendar, Download, Search } from 'lucide-react'
import { getAttendanceReport } from '@/actions/attendance'
import { getTimeTemplates } from '@/actions/schedules'
import { listPersons } from '@/actions/persons'
import type { AttendanceFilters, AttendanceDay, TimeTemplate } from '@/types/attendance.types'
import type { PersonRecord } from '@/types/person.types'
import { exportToCsv } from '@/lib/utils'
import { EmployeeSelect } from '@/components/ui/employee-select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR')
}

function formatHours(h: number): string {
  return h.toFixed(1) + 'h'
}

function getStatusBadge(status: string): { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' } {
  switch (status) {
    case 'present': return { label: 'Presente', variant: 'success' }
    case 'late': return { label: 'Tardanza', variant: 'warning' }
    case 'absent': return { label: 'Ausente', variant: 'destructive' }
    case 'holiday': return { label: 'Feriado', variant: 'secondary' }
    case 'incomplete': return { label: 'Incompleto', variant: 'warning' }
    case 'unassigned': return { label: 'Sin asignar', variant: 'secondary' }
    default: return { label: status, variant: 'secondary' }
  }
}

export default function AttendancePage() {
  const [filters, setFilters] = useState<AttendanceFilters>({
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  })
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<Awaited<ReturnType<typeof getAttendanceReport>> | null>(null)
  const [persons, setPersons] = useState<PersonRecord[]>([])
  const [templates, setTemplates] = useState<TimeTemplate[]>([])
  const [selectedPersons, setSelectedPersons] = useState<string[]>([])

  useEffect(() => {
    listPersons({ pageSize: 100 }).then(r => setPersons(r.data))
    getTimeTemplates().then(setTemplates)
  }, [])

  async function handleSearch() {
    setLoading(true)
    try {
      const result = await getAttendanceReport({
        ...filters,
        personIds: selectedPersons.length > 0 ? selectedPersons : undefined,
      })
      setReport(result)
    } catch (error) {
      toast.error('Error fetching report')
    } finally {
      setLoading(false)
    }
  }

  function handleExport() {
    if (!report) return
    
    const headers = ['Fecha', 'Persona', 'Horas Prog.', 'Horas Real', 'Overtime', 'Tardanza', 'Estado']
    const rows = report.days.map(d => {
      const person = persons.find(p => p.id === d.personId)
      return [
        d.date,
        person?.name || d.personId,
        formatHours(d.scheduledHours),
        formatHours(d.actualHours),
        formatHours(d.overtimeHours),
        d.tardinessMinutes + 'min',
        d.status,
      ]
    })
    
    exportToCsv('attendance-report', headers, rows)
    toast.success('Reporte exportado')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Asistencia</h1>
          <p className="text-muted-foreground">
            Reportes de asistencia calculados en base a horarios y eventos
          </p>
        </div>
        {report && (
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Desde</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Hasta</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-40"
              />
            </div>
            <EmployeeSelect
              persons={persons}
              selected={selectedPersons}
              onChange={setSelectedPersons}
              placeholder="Buscar empleados..."
              className="flex-1 min-w-[200px]"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Horas Totales</p>
              <p className="text-2xl font-bold">{formatHours(report.totals.actualHours)}</p>
              <p className="text-xs text-muted-foreground">de {formatHours(report.totals.scheduledHours)} programadas</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Overtime</p>
              <p className="text-2xl font-bold text-warning">{formatHours(report.totals.overtimeHours)}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Tardanzas</p>
              <p className="text-2xl font-bold text-warning">{report.totals.tardinessMinutes}min</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Asistencia</p>
              <p className="text-2xl font-bold text-success">{report.totals.presentDays}</p>
              <p className="text-xs text-muted-foreground">presentes / {report.days.length} días</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {report && (
        <Card className="glass-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Prog.</TableHead>
                <TableHead>Real</TableHead>
                <TableHead>OT</TableHead>
                <TableHead>Tard.</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.days.map((day) => {
                const person = persons.find(p => p.id === day.personId)
                const badge = getStatusBadge(day.status)
                return (
                  <TableRow key={day.id}>
                    <TableCell className="text-xs">{formatDate(day.date)}</TableCell>
                    <TableCell className="font-medium">{person?.name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatHours(day.scheduledHours)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatHours(day.actualHours)}</TableCell>
                    <TableCell className={cn("text-xs", day.overtimeHours > 0 && "text-warning font-medium")}>
                      {formatHours(day.overtimeHours)}
                    </TableCell>
                    <TableCell className={cn("text-xs", day.tardinessMinutes > 0 && "text-destructive font-medium")}>
                      {day.tardinessMinutes > 0 ? `${day.tardinessMinutes}min` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
              {report.days.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay datos para el rango seleccionado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}