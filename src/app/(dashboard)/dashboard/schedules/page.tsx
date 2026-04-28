'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react'
import { getTimeTemplates, deleteTimeTemplate, createTimeTemplate, updateTimeTemplate } from '@/actions/schedules'
import { ScheduleBuilder } from '@/components/schedules/schedule-builder'
import type { TimeTemplate, DaySchedule, ScheduleConfig } from '@/types/attendance.types'
import { toast } from 'sonner'

export default function SchedulesPage() {
  const [templates, setTemplates] = useState<TimeTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<TimeTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    try {
      const data = await getTimeTemplates()
      setTemplates(data)
    } catch (error) {
      toast.error('Error loading templates')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este horario?')) return
    
    const result = await deleteTimeTemplate(id)
    if (result.success) {
      toast.success('Horario eliminado')
      loadTemplates()
    } else {
      toast.error(result.error || 'Error')
    }
  }

  async function handleSave(config: ScheduleConfig) {
    if (isCreating && !newName.trim()) {
      toast.error('Ingresá un nombre para el horario')
      return
    }

    if (editingTemplate) {
      const result = await updateTimeTemplate(editingTemplate.id, { scheduleConfig: config })
      if (result.success) {
        toast.success('Horario actualizado')
        setEditingTemplate(null)
        loadTemplates()
      } else {
        toast.error(result.error || 'Error')
      }
    } else {
      const result = await createTimeTemplate({ name: newName.trim(), scheduleConfig: config })
      if (result.success) {
        toast.success('Horario creado')
        setIsCreating(false)
        setNewName('')
        loadTemplates()
      } else {
        toast.error(result.error || 'Error')
      }
    }
  }

  function getDayRangesPreview(config: ScheduleConfig): string {
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    const ranges = dayKeys
      .filter(key => {
        const dayConfig = config[key]
        return dayConfig && dayConfig.length > 0
      })
      .map((key, idx) => {
        const dayConfig = config[key]!
        const times = dayConfig.map((r: DaySchedule) => `${r.start}-${r.end}`).join(', ')
        return `${days[idx]}: ${times}`
      })
    return ranges.join(' | ') || 'Sin configuración'
  }

  if (loading) {
    return <div>Cargando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Horarios</h1>
          <p className="text-muted-foreground">
            Gestiona plantillas de horario para asignar a empleados
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Horario
        </Button>
      </div>

      {isCreating && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Nuevo Horario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Nombre del horario (ej: General 9-18)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <ScheduleBuilder onSave={handleSave} onCancel={() => setIsCreating(false)} />
          </CardContent>
        </Card>
      )}

      {editingTemplate && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Editar Horario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground font-medium">{editingTemplate.name}</p>
            <ScheduleBuilder
              initialConfig={editingTemplate.scheduleConfig}
              onSave={handleSave}
              onCancel={() => setEditingTemplate(null)}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="glass-card">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{template.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {getDayRangesPreview(template.scheduleConfig)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={template.isActive ? 'success' : 'secondary'}>
                  {template.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingTemplate(template)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(template.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {templates.length === 0 && !isCreating && (
          <div className="text-center py-12 text-muted-foreground">
            No hay horarios configurados. Crea uno para comenzar.
          </div>
        )}
      </div>
    </div>
  )
}