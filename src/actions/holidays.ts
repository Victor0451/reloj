'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { Holiday, CreateHolidayInput } from '@/types/attendance.types'

export async function createHoliday(
  input: CreateHolidayInput
): Promise<{ success: boolean; data?: Holiday; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const { data, error } = await admin
    .from('holidays')
    .insert({
      date: input.date,
      name: input.name,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Date already has a holiday' }
    }
    return { success: false, error: error.message }
  }

  return { success: true, data: mapDbToHoliday(data) }
}

export async function getHolidays(year: number): Promise<Holiday[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  const { data, error } = await admin
    .from('holidays')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')

  if (error) throw error
  return (data || []).map(mapDbToHoliday)
}

export async function deleteHoliday(
  id: string
): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const { error } = await admin
    .from('holidays')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function isHoliday(date: string): Promise<Holiday | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const { data, error } = await admin
    .from('holidays')
    .select('*')
    .eq('date', date)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  return data ? mapDbToHoliday(data) : null
}

function mapDbToHoliday(row: Record<string, unknown>): Holiday {
  return {
    id: row.id as string,
    date: row.date as string,
    name: row.name as string,
    createdAt: row.created_at as string,
  }
}
