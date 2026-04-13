'use client'

import { useState } from 'react'
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
  const [formData, setFormData] = useState<PersonFormData>(
    initialData ?? { name: '', employee_id: '', department: '', card_number: '' }
  )
  const [errors, setErrors] = useState<Partial<Record<keyof PersonFormData, string>>>({})
  const [loading, setLoading] = useState(false)

  function handleChange(field: keyof PersonFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
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
            <Label htmlFor="person-name">Nombre *</Label>
            <Input
              id="person-name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Juan Pérez"
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Employee ID */}
          <div className="space-y-2">
            <Label htmlFor="person-employee-id">ID Empleado</Label>
            <Input
              id="person-employee-id"
              value={formData.employee_id}
              onChange={(e) => handleChange('employee_id', e.target.value)}
              placeholder="EMP-001"
            />
            {errors.employee_id && (
              <p className="text-sm text-destructive">{errors.employee_id}</p>
            )}
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label htmlFor="person-department">Departamento</Label>
            <Input
              id="person-department"
              value={formData.department}
              onChange={(e) => handleChange('department', e.target.value)}
              placeholder="Recursos Humanos"
            />
          </div>

          {/* Card Number */}
          <div className="space-y-2">
            <Label htmlFor="person-card-number">Número de Tarjeta RFID</Label>
            <Input
              id="person-card-number"
              value={formData.card_number}
              onChange={(e) => handleChange('card_number', e.target.value)}
              placeholder="12345678"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="gradient"
            onClick={handleSubmit}
            disabled={loading}
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
