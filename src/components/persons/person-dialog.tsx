'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface PersonFormData {
  name: string
  employee_id: string
  department: string
  card_number: string
}

interface PersonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initialData?: PersonFormData
  onSubmit: (data: PersonFormData) => Promise<void>
}

export function PersonDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
}: PersonDialogProps) {
  const defaultFormData: PersonFormData = {
  name: '',
  employee_id: '',
  department: '',
  card_number: '',
}

const [formData, setFormData] = useState<PersonFormData>(defaultFormData)
const [errors, setErrors] = useState({} as Record<string, string>)
const [loading, setLoading] = useState(false)

// Update form when initialData changes (for edit mode)
useEffect(() => {
  if (open) {
    setFormData(initialData ?? defaultFormData)
    setErrors({} as Record<string, string>)
  }
}, [open, initialData])

  function handleChange(field: keyof PersonFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      const newErrors = { ...errors }
      delete newErrors[field]
      setErrors(newErrors as Record<string, string>)
    }
  }

  async function handleSubmit() {
    // Validate
    const newErrors: Partial<Record<keyof PersonFormData, string>> = {}
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      await onSubmit(formData)
      setFormData({ name: '', employee_id: '', department: '', card_number: '' })
      setErrors({})
      onOpenChange(false)
    } catch {
      // Error handled by parent
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {mode === 'create' ? 'Nueva Persona' : 'Editar Persona'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Completá los datos para registrar una nueva persona.'
              : 'Modificá los datos de la persona.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="person-name" className="text-sm font-semibold">Nombre *</Label>
            <Input
              id="person-name"
              className="input-outlined"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Juan Pérez"
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs font-medium text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Employee ID */}
            <div className="space-y-2">
              <Label htmlFor="person-employee-id" className="text-sm font-semibold">ID Empleado</Label>
              <Input
                id="person-employee-id"
                className="input-outlined"
                value={formData.employee_id}
                onChange={(e) => handleChange('employee_id', e.target.value)}
                placeholder="EMP-001"
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="person-department" className="text-sm font-semibold">Departamento</Label>
              <Input
                id="person-department"
                className="input-outlined"
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                placeholder="Recursos Humanos"
              />
            </div>
          </div>

          {/* Card Number */}
          <div className="space-y-2">
            <Label htmlFor="person-card-number" className="text-sm font-semibold">Número de Tarjeta RFID</Label>
            <Input
              id="person-card-number"
              className="input-outlined font-mono"
              value={formData.card_number}
              onChange={(e) => handleChange('card_number', e.target.value)}
              placeholder="12345678"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={loading}
            className="btn-secondary"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'create' ? 'Creando...' : 'Guardando...'}
              </>
            ) : mode === 'create' ? (
              'Crear Persona'
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
