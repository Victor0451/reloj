'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Save } from 'lucide-react'
import type { DaySchedule, ScheduleConfig } from '@/types/attendance.types'
import { cn } from '@/lib/utils'

const DAYS = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
] as const

interface ScheduleBuilderProps {
  initialConfig?: ScheduleConfig
  onSave: (config: ScheduleConfig) => void
  onCancel?: () => void
}

export function ScheduleBuilder({ initialConfig, onSave, onCancel }: ScheduleBuilderProps) {
  const [config, setConfig] = useState<ScheduleConfig>(initialConfig || {})

  function addRange(day: keyof ScheduleConfig) {
    const current = config[day] || []
    setConfig({
      ...config,
      [day]: [...current, { start: '09:00', end: '18:00' }],
    })
  }

  function removeRange(day: keyof ScheduleConfig, index: number) {
    const current = config[day] || []
    setConfig({
      ...config,
      [day]: current.filter((_, i) => i !== index),
    })
  }

  function updateRange(day: keyof ScheduleConfig, index: number, field: 'start' | 'end', value: string) {
    const current = config[day] || []
    const updated = current.map((range, i) =>
      i === index ? { ...range, [field]: value } : range
    )
    setConfig({
      ...config,
      [day]: updated,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex overflow-x-auto gap-3 pb-2">
        {DAYS.map(({ key, label }) => (
          <Card key={key} className="glass-card min-w-[140px] shrink-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              {(config[key] || []).map((range, idx) => (
                <div key={idx} className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg">
                  <label className="text-xs text-muted-foreground">Desde</label>
                  <Input
                    type="time"
                    value={range.start}
                    onChange={(e) => updateRange(key, idx, 'start', e.target.value)}
                    className="h-10 px-2 text-sm font-medium"
                  />
                  <label className="text-xs text-muted-foreground">Hasta</label>
                  <Input
                    type="time"
                    value={range.end}
                    onChange={(e) => updateRange(key, idx, 'end', e.target.value)}
                    className="h-10 px-2 text-sm font-medium"
                  />
                  <button
                    onClick={() => removeRange(key, idx)}
                    className="text-destructive hover:bg-destructive/10 p-2 rounded text-xs mt-1"
                  >
                    <Trash2 className="h-4 w-4 inline mr-1" />
                    Quitar
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addRange(key)}
                className="w-full h-9 text-sm mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button onClick={() => onSave(config)}>
          <Save className="h-4 w-4 mr-2" />
          Guardar
        </Button>
      </div>
    </div>
  )
}