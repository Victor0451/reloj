'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, Calendar, User, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getTimeTemplates,
} from '@/actions/schedules'
import type { TimeTemplate } from '@/types/attendance.types'
import {
  getScheduleAssignments,
  assignSchedule,
  removeScheduleAssignment,
} from '@/actions/schedule-assignments'
import type { ScheduleAssignment } from '@/types/attendance.types'
import { listPersons } from '@/actions/persons'
import type { PersonRecord } from '@/types/person.types'

export default function ScheduleAssignmentsPage() {
  const [templates, setTemplates] = useState<TimeTemplate[]>([])
  const [persons, setPersons] = useState<PersonRecord[]>([])
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')

  // Modal state for new assignment
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [templatesData, personsData, assignmentsData] = await Promise.all([
        getTimeTemplates(),
        listPersons({ pageSize: 100 }),
        getScheduleAssignments(),
      ])
      setTemplates(templatesData)
      setPersons(personsData.data)
      setAssignments(assignmentsData)
    } catch (error) {
      toast.error('Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  async function handleAssign() {
    if (!selectedPersonId || !selectedTemplateId || !validFrom) {
      toast.error('Completá todos los campos obligatorios')
      return
    }

    const result = await assignSchedule({
      personId: selectedPersonId,
      timeTemplateId: selectedTemplateId,
      validFrom,
      validTo: validTo || undefined,
    })

    if (result.success) {
      toast.success('Horario asignado')
      setShowForm(false)
      setSelectedPersonId('')
      setSelectedTemplateId('')
      setValidFrom('')
      setValidTo('')
      loadData()
    } else {
      toast.error(result.error || 'Error al asignar')
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('¿Quitar esta asignación?')) return

    const result = await removeScheduleAssignment(id)
    if (result.success) {
      toast.success('Asignación removida')
      loadData()
    } else {
      toast.error(result.error || 'Error')
    }
  }

  function getPersonName(id: string): string {
    return persons.find(p => p.id === id)?.name || id
  }

  function getTemplateName(id: string): string {
    return templates.find(t => t.id === id)?.name || id
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Indefinido'
    return new Date(dateStr).toLocaleDateString('es-AR')
  }

  function isActive(assignment: ScheduleAssignment): boolean {
    const today = new Date().toISOString().split('T')[0]
    if (!assignment.isActive) return false
    if (assignment.validFrom > today) return false
    if (assignment.validTo && assignment.validTo < today) return false
    return true
  }

  if (loading) {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Asignaciones</h1>
          <p className="text-muted-foreground">
            Asigna horarios a empleados para calcular asistencia
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Asignación
        </Button>
      </div>

      {/* Assignment Form */}
      {showForm && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Asignar horario a empleado</CardTitle>
            <CardDescription>
              Seleccioná el empleado y el horario que querés asignarle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Employee */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Empleado
                </label>
                <select
                  className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm"
                  value={selectedPersonId}
                  onChange={(e) => setSelectedPersonId(e.target.value)}
                >
                  <option value="">Seleccionar empleado...</option>
                  {persons.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.employee_id ? `(${p.employee_id})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Schedule Template */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horario
                </label>
                <select
                  className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">Seleccionar horario...</option>
                  {templates.filter(t => t.isActive).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Valid From */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Desde
                </label>
                <Input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>

              {/* Valid To */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Hasta (opcional)
                </label>
                <Input
                  type="date"
                  value={validTo}
                  onChange={(e) => setValidTo(e.target.value)}
                  placeholder="Dejar vacío para indefinido"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAssign}>
                Asignar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignments Table */}
      <Card className="glass-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead>Hasta</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-20">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map(a => {
              const active = isActive(a)
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {getPersonName(a.personId)}
                  </TableCell>
                  <TableCell>
                    {a.timeTemplate ? (
                      <Badge variant="secondary">{a.timeTemplate.name}</Badge>
                    ) : (
                      getTemplateName(a.timeTemplateId)
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(a.validFrom)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(a.validTo)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={active ? 'success' : 'secondary'}>
                      {active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(a.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {assignments.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay asignaciones. Creá una para comenzar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Help text */}
      <div className="text-sm text-muted-foreground">
        <p>
          <strong>Nota:</strong> Los empleados sin asignación se marcarán como "Sin asignar" en los reportes de asistencia.
        </p>
        <p>
          Para que los reportes muestren horas programadas vs reales, es necesario asignar un horario a cada empleado.
        </p>
      </div>
    </div>
  )
}