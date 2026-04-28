'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { listPersons, createPerson, updatePerson, deletePerson, reactivatePerson, resetPersonSync, discardPerson } from '@/actions/persons'
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
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (supabaseRef.current == null) {
    supabaseRef.current = createClient()
  }

  const refreshData = useCallback(async (page?: number) => {
    const currentPage = page ?? data.page
    try {
      const result = await listPersons({
        page: currentPage,
      })
      setData(result)
    } catch (err) {
      console.error('Failed to refresh data:', err)
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

  // Realtime subscription - falls back gracefully if Supabase Realtime is down
  // Data refreshes happen via: (1) Realtime events → scheduleRefresh(), (2) Post-action refresh in handlers

  // Attempt Realtime subscription (will fail gracefully if Supabase Realtime is down)
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

  async function handleRetry(id: string) {
    const result = await resetPersonSync(id)

    if (result.success) {
      toast.success('Persona reintentada - se syncará en breve')
      await refreshData()
    } else {
      toast.error(result.error ?? 'Error al reintentar persona')
    }
  }

  async function handleDiscard(id: string) {
    const result = await discardPerson(id)

    if (result.success) {
      toast.success('Persona descartada')
      await refreshData()
    } else {
      toast.error(result.error ?? 'Error al descartar persona')
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
        <span className={`h-2 w-2 rounded-full ${isRealtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        {isRealtimeConnected ? 'Realtime' : 'Sin conexión en vivo'}
      </div>
      <PersonsTableServer
        initialData={data}
        onEdit={handleEditPerson}
        onDeactivate={handleDeactivate}
        onReactivate={handleReactivate}
        onNew={handleNew}
        onImport={() => setCsvDialogOpen(true)}
        onRetry={handleRetry}
        onDiscard={handleDiscard}
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
        syncError={
          editingPerson?.sync_attempts
            ? {
                sync_attempts: editingPerson.sync_attempts,
                sync_error: editingPerson.sync_error ?? null,
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
