'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  ActionResult,
  CreatePersonInput,
  UpdatePersonInput,
  ListPersonsOptions,
  PaginatedResult,
  BatchResult,
  CsvRow,
  PersonRecord,
} from '@/types/person.types'

async function checkRole(allowedRoles: string[]): Promise<ActionResult> {
  // Get user from cookie-based client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'No autenticado' }

  // Use admin client (bypasses RLS) for profile lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as any

  if (profileError) {
    return { success: false, error: `Error de perfil: ${profileError.message}` }
  }

  if (!profile || !allowedRoles.includes(profile.role)) {
    return { success: false, error: 'No tienes permisos para realizar esta acción' }
  }

  return { success: true }
}

export async function createPerson(
  input: CreatePersonInput
): Promise<ActionResult<PersonRecord>> {
  const supabase = await createClient()

  const roleCheck = await checkRole(['admin', 'hr_operator'])
  if (!roleCheck.success) return roleCheck as ActionResult<PersonRecord>

  if (!input.name || input.name.trim().length === 0) {
    return { success: false, error: 'El nombre es requerido' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const { data, error } = await admin
    .from('persons')
    .insert({
      name: input.name.trim(),
      employee_id: input.employee_id || null,
      department: input.department || null,
      card_number: input.card_number || null,
      face_photo_url: input.face_photo_url || null,
      status: 'pending_sync',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Ya existe una persona con ese número de empleado' }
    }
    return { success: false, error: error.message }
  }

  return { success: true, data: (data as PersonRecord[])?.[0] ?? null }
}

export async function updatePerson(
  id: string,
  input: UpdatePersonInput
): Promise<ActionResult<PersonRecord>> {
  const supabase = await createClient()

  const roleCheck = await checkRole(['admin', 'hr_operator'])
  if (!roleCheck.success) return roleCheck as ActionResult<PersonRecord>

  if (!id) {
    return { success: false, error: 'ID de persona requerido' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await admin
    .from('persons')
    .select('*')
    .eq('id', id)
    .single() as any

  if (fetchError || !existing) {
    return { success: false, error: 'Persona no encontrada' }
  }

  const existingPerson = existing as PersonRecord
  const nameChanged = input.name && input.name !== existingPerson.name
  const employeeChanged = input.employee_id !== undefined && input.employee_id !== existingPerson.employee_id
  const needsSync = nameChanged || employeeChanged

  const updateData: Record<string, unknown> = {}
  if (input.name !== undefined) updateData.name = input.name.trim()
  if (input.employee_id !== undefined) updateData.employee_id = input.employee_id || null
  if (input.department !== undefined) updateData.department = input.department || null
  if (input.card_number !== undefined) updateData.card_number = input.card_number || null
  if (input.face_photo_url !== undefined) updateData.face_photo_url = input.face_photo_url
  if (needsSync) updateData.status = 'pending_sync'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await admin
    .from('persons')
    .update(updateData)
    .eq('id', id)
    .select() as any

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Ya existe una persona con ese número de empleado' }
    }
    return { success: false, error: error.message }
  }

  return { success: true, data: (data as PersonRecord[])?.[0] ?? null }
}

export async function deletePerson(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const roleCheck = await checkRole(['admin', 'hr_operator'])
  if (!roleCheck.success) return roleCheck

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await admin
    .from('persons')
    .select('status')
    .eq('id', id)
    .single() as any

  if (fetchError || !existing) {
    return { success: false, error: 'Persona no encontrada' }
  }

  if ((existing as PersonRecord).status === 'inactive') {
    return { success: false, error: 'La persona ya está inactiva' }
  }

  const { error } = await admin
    .from('persons')
    .update({ status: 'inactive' })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function reactivatePerson(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const roleCheck = await checkRole(['admin', 'hr_operator'])
  if (!roleCheck.success) return roleCheck

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const { error } = await admin
    .from('persons')
    .update({ status: 'pending_sync' })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function listPersons(
  options: ListPersonsOptions = {}
): Promise<PaginatedResult<PersonRecord>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const page = options.page ?? 1
  const pageSize = options.pageSize ?? 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = admin.from('persons').select('*', { count: 'exact' })

  if (options.search) {
    const search = `%${options.search}%`
    query = query.or(
      `name.ilike.${search},employee_id.ilike.${search},department.ilike.${search}`
    )
  }

  if (options.statusFilter && options.statusFilter !== 'all') {
    query = query.eq('status', options.statusFilter)
  }

  const sortColumn = options.sortColumn || 'created_at'
  const sortDirection = options.sortDirection || 'desc'
  query = query.order(sortColumn, { ascending: sortDirection === 'asc' })

  query = query.range(from, to)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await query as any
  const { data, count, error } = result

  if (error) {
    return { data: [], count: 0, page, pageSize, totalPages: 0 }
  }

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  return {
    data: (data ?? []) as PersonRecord[],
    count: count ?? 0,
    page,
    pageSize,
    totalPages,
  }
}

export async function batchCreatePersons(
  rows: CsvRow[]
): Promise<ActionResult<BatchResult>> {
  const supabase = await createClient()

  const roleCheck = await checkRole(['admin', 'hr_operator'])
  if (!roleCheck.success) return roleCheck as ActionResult<BatchResult>

  if (rows.length === 0) {
    return { success: true, data: { created: 0, skipped: 0, errors: [] } }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const result: BatchResult = { created: 0, skipped: 0, errors: [] }
  const validRows: CreatePersonInput[] = []
  const seenEmployeeIds = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    if (!row.name || row.name.trim().length === 0) {
      result.errors.push({ row: i + 1, error: 'Nombre requerido' })
      result.skipped++
      continue
    }

    if (row.employee_id) {
      if (seenEmployeeIds.has(row.employee_id)) {
        result.errors.push({ row: i + 1, error: 'employee_id duplicado en el CSV' })
        result.skipped++
        continue
      }
      seenEmployeeIds.add(row.employee_id)
    }

    validRows.push({
      name: row.name.trim(),
      employee_id: row.employee_id || undefined,
      department: row.department || undefined,
      card_number: row.card_number || undefined,
    })
  }

  const batchSize = 50
  for (let i = 0; i < validRows.length; i += batchSize) {
    const chunk = validRows.slice(i, i + batchSize)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await admin.from('persons').insert(
      chunk.map((row) => ({
        ...row,
        status: 'pending_sync',
      }))
    ) as any

    if (error) {
      result.errors.push({ row: i + 1, error: error.message })
      result.skipped += chunk.length
    } else {
      result.created += chunk.length
    }
  }

  return { success: true, data: result }
}

export async function getPhotoSignedUrl(
  path: string
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from('face-photos')
    .createSignedUrl(path, 3600)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: { url: data.signedUrl } }
}
