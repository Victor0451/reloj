'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { TimeTemplate, CreateTimeTemplateInput, UpdateTimeTemplateInput } from '@/types/attendance.types'

export async function createTimeTemplate(
  input: CreateTimeTemplateInput
): Promise<{ success: boolean; data?: TimeTemplate; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const { data, error } = await admin
    .from('time_templates')
    .insert({
      name: input.name,
      schedule_config: input.scheduleConfig as any,
      is_active: true,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  return { success: true, data: mapDbToTimeTemplate(data) }
}

export async function getTimeTemplates(): Promise<TimeTemplate[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const { data, error } = await admin
    .from('time_templates')
    .select('*')
    .order('name')

  if (error) throw error
  return (data || []).map(mapDbToTimeTemplate)
}

export async function updateTimeTemplate(
  id: string,
  updates: UpdateTimeTemplateInput
): Promise<{ success: boolean; data?: TimeTemplate; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const updateData: Record<string, unknown> = {}
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.scheduleConfig !== undefined) updateData.schedule_config = updates.scheduleConfig
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive
  updateData.updated_at = new Date().toISOString()

  const { data, error } = await admin
    .from('time_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: mapDbToTimeTemplate(data) }
}

export async function deleteTimeTemplate(id: string): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  // Check if template has active assignments
  const { data: assignments } = await admin
    .from('schedule_assignments')
    .select('id')
    .eq('time_template_id', id)
    .eq('is_active', true)
    .limit(1)

  if (assignments && assignments.length > 0) {
    return { success: false, error: 'Cannot delete template with active assignments' }
  }

  const { error } = await admin
    .from('time_templates')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true }
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
