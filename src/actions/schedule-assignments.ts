'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type {
  ScheduleAssignment,
  AssignScheduleInput,
  TimeTemplate,
} from '@/types/attendance.types'

export async function assignSchedule(
  input: AssignScheduleInput
): Promise<{ success: boolean; data?: ScheduleAssignment; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  // Deactivate any existing active assignments for this person
  await admin
    .from('schedule_assignments')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('person_id', input.personId)
    .eq('is_active', true)

  const { data, error } = await admin
    .from('schedule_assignments')
    .insert({
      person_id: input.personId,
      time_template_id: input.timeTemplateId,
      valid_from: input.validFrom,
      valid_to: input.validTo || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: mapDbToAssignment(data) }
}

export async function getScheduleAssignments(
  personId?: string
): Promise<ScheduleAssignment[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  let query = admin
    .from('schedule_assignments')
    .select('*, time_template:time_templates(*)')
    .order('created_at', { ascending: false })

  if (personId) {
    query = query.eq('person_id', personId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapDbToAssignment)
}

export async function getPersonScheduleForDate(
  personId: string,
  date: string
): Promise<{ template: TimeTemplate | null; assignment: ScheduleAssignment | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const { data, error } = await admin
    .from('schedule_assignments')
    .select('*, time_template:time_templates(*)')
    .eq('person_id', personId)
    .eq('is_active', true)
    .lte('valid_from', date)
    .or(`valid_to.is.null,valid_to.gte.${date}`)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  if (!data) {
    return { template: null, assignment: null }
  }

  return {
    template: mapDbToTimeTemplate(data.time_template),
    assignment: mapDbToAssignment(data),
  }
}

export async function removeScheduleAssignment(
  id: string
): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const { error } = await admin
    .from('schedule_assignments')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

function mapDbToAssignment(row: Record<string, unknown>): ScheduleAssignment {
  return {
    id: row.id as string,
    personId: row.person_id as string,
    timeTemplateId: row.time_template_id as string,
    validFrom: row.valid_from as string,
    validTo: row.valid_to as string | null,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    timeTemplate: row.time_template
      ? mapDbToTimeTemplate(row.time_template as Record<string, unknown>)
      : undefined,
  }
}

function mapDbToTimeTemplate(row: Record<string, unknown>): TimeTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    scheduleConfig: row.schedule_config as import('@/types/attendance.types').ScheduleConfig,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
