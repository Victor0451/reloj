'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { listPersons, createPerson, updatePerson, deletePerson, reactivatePerson } from '@/actions/persons'
import type { PersonRecord, CreatePersonInput, UpdatePersonInput } from '@/types/person.types'
import PersonsTableServer from '@/components/persons/persons-table'
import { PersonDialog } from '@/components/persons/person-dialog'
import { CsvImportDialog } from '@/components/persons/csv-import-dialog'
import { createClient } from '@/lib/supabase/client'

interface PersonsClientProps {
  initialData: Awaited<ReturnType<typeof listPersons>>
}

export function PersonsClient({
  initialData,
}: PersonsClientProps) {
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editingPerson, setEditingPerson] = useState<PersonRecord | null>(null)
  const [csvDialogOpen, setCsvDialogOpen] = useState(false)

  // Data state
  const [data, setData] = useState(initialData)
  const [tableKey, setTableKey] = useState(0)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (supabaseRef.current == null) {
    supabaseRef.current = createClient()
  }

  const refreshData = useCallback(async (page: number = data.page) => {
    try {
      const result = await listPersons({
        page,
      })
      setData(result)
      setTableKey((k) => k + 1) // Force re-render de la tabla
    } catch (err) {
      console.error('Failed to refresh data:', err)
      toast.error('Error al cargar las personas')
    }
  }, [data.page])

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    refreshTimerRef.current = setTimeout(() => {
      void refreshData(data.page)
    }, 250)
  }, [data.page, refreshData])

  useEffect(() => {
    const supabase = supabaseRef.current
    if (!supabase) return

    const channel = supabase
      .channel('persons-realtime-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'persons',
        },
        () => {
          scheduleRefresh()
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
      }
    }
  }, [scheduleRefresh])

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
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${isRealtimeConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
        {isRealtimeConnected ? 'Personas en vivo' : 'Conectando Realtime...'}
      </div>
      <PersonsTableServer
        key={tableKey}
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
