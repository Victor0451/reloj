'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { listPersons, createPerson, updatePerson, deletePerson, reactivatePerson } from '@/actions/persons'
import type { PersonRecord, CreatePersonInput, UpdatePersonInput } from '@/types/person.types'
import PersonsTableServer from '@/components/persons/persons-table'
import { PersonDialog } from '@/components/persons/person-dialog'
import { CsvImportDialog } from '@/components/persons/csv-import-dialog'

interface PersonsClientProps {
  initialData: Awaited<ReturnType<typeof listPersons>>
  createPerson: typeof createPerson
  updatePerson: typeof updatePerson
  deletePerson: typeof deletePerson
  reactivatePerson: typeof reactivatePerson
}

export function PersonsClient({
  initialData,
}: PersonsClientProps) {
  const router = useRouter()

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editingPerson, setEditingPerson] = useState<PersonRecord | null>(null)
  const [csvDialogOpen, setCsvDialogOpen] = useState(false)

  // Data state
  const [data, setData] = useState(initialData)
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  async function refreshData(page: number = data.page) {
    setLoading(true)
    const result = await listPersons({
      page,
      search: searchInput || undefined,
      statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
    })
    setData(result)
    setLoading(false)
  }

  async function handleCreate(formData: { name: string; employee_id: string; department: string; card_number: string }) {
    const input: CreatePersonInput = {
      name: formData.name,
      employee_id: formData.employee_id || undefined,
      department: formData.department || undefined,
      card_number: formData.card_number || undefined,
    }

    const result = await createPerson(input)

    if (result.success) {
      toast.success('Persona creada correctamente')
      setDialogOpen(false)
      await refreshData(1)
    } else {
      toast.error(result.error ?? 'Error al crear persona')
    }
  }

  async function handleEdit(formData: { name: string; employee_id: string; department: string; card_number: string }) {
    if (!editingPerson) return

    const input: UpdatePersonInput = {
      name: formData.name,
      employee_id: formData.employee_id || undefined,
      department: formData.department || undefined,
      card_number: formData.card_number || undefined,
    }

    const result = await updatePerson(editingPerson.id, input)

    if (result.success) {
      toast.success('Persona actualizada correctamente')
      setDialogOpen(false)
      setEditingPerson(null)
      await refreshData()
    } else {
      toast.error(result.error ?? 'Error al actualizar persona')
    }
  }

  async function handleDeactivate(id: string) {
    const result = await deletePerson(id)

    if (result.success) {
      toast.success('Persona desactivada')
      await refreshData()
    } else {
      toast.error(result.error ?? 'Error al desactivar persona')
    }
  }

  async function handleReactivate(id: string) {
    const result = await reactivatePerson(id)

    if (result.success) {
      toast.success('Persona reactivada')
      await refreshData()
    } else {
      toast.error(result.error ?? 'Error al reactivar persona')
    }
  }

  function handleNew() {
    setDialogMode('create')
    setEditingPerson(null)
    setDialogOpen(true)
  }

  function handleEditPerson(person: PersonRecord) {
    setDialogMode('edit')
    setEditingPerson(person)
    setDialogOpen(true)
  }

  return (
    <>
      <PersonsTableServer
        initialData={data}
        onEdit={handleEditPerson}
        onDeactivate={handleDeactivate}
        onReactivate={handleReactivate}
        onNew={handleNew}
        onImport={() => setCsvDialogOpen(true)}
      />

      <PersonDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingPerson(null)
        }}
        mode={dialogMode}
        initialData={
          editingPerson
            ? {
                name: editingPerson.name,
                employee_id: editingPerson.employee_id ?? '',
                department: editingPerson.department ?? '',
                card_number: editingPerson.card_number ?? '',
              }
            : undefined
        }
        onSubmit={dialogMode === 'create' ? handleCreate : handleEdit}
      />

      <CsvImportDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        onSuccess={() => refreshData(1)}
      />
    </>
  )
}
