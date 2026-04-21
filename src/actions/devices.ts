'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  CreateDeviceInput,
  DeviceActionResult,
  DeviceListItem,
  DeviceRecord,
  UpdateDeviceConnectionInput,
} from '@/types/device.types'
import { performDeviceConnectionCheck } from '@/lib/device-connectivity'

function normalizeText(value: string | undefined | null): string {
  return value?.trim() || ''
}

function mapDeviceRecordToListItem(row: Record<string, unknown>): DeviceListItem {
  return {
    id: String(row.id),
    name: String(row.name),
    serial_number: String(row.serial_number),
    brand: String(row.brand || 'hikvision'),
    model: (row.model as string | null) ?? null,
    ip_address: (row.ip_address as string | null) ?? null,
    firmware_version: (row.firmware_version as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    status: (row.status as DeviceListItem['status']) || 'unknown',
    sync_status: (row.sync_status as DeviceListItem['sync_status']) || 'disconnected',
    sync_error: (row.sync_error as string | null) ?? null,
    last_seen_at: (row.last_seen_at as string | null) ?? null,
    sync_last_at: (row.sync_last_at as string | null) ?? null,
    sync_events_count: (row.sync_events_count as number | undefined) ?? 0,
    last_event_synced_at: (row.last_event_synced_at as string | null) ?? null,
    updated_at: (row.updated_at as string | undefined) ?? new Date().toISOString(),
  }
}

async function getDeviceRecordById(deviceId: string): Promise<DeviceRecord | null> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .single()

  if (error || !data) {
    return null
  }

  return data as DeviceRecord
}

function validateCreateInput(input: CreateDeviceInput): string | null {
  if (!normalizeText(input.name)) return 'El nombre del dispositivo es obligatorio.'
  if (!normalizeText(input.serial_number)) return 'El número de serie es obligatorio.'
  if (!normalizeText(input.ip_address)) return 'La IP del dispositivo es obligatoria.'
  if (!normalizeText(input.username)) return 'El usuario del dispositivo es obligatorio.'
  if (!normalizeText(input.password)) return 'La contraseña del dispositivo es obligatoria.'
  return null
}

async function buildConnectionResult(input: CreateDeviceInput) {
  return performDeviceConnectionCheck({
    ip_address: normalizeText(input.ip_address),
    username: normalizeText(input.username),
    password: normalizeText(input.password),
    brand: input.brand || 'hikvision',
  })
}

/**
 * Registra un nuevo reloj en el sistema usando un DTO seguro para el cliente.
 */
export async function createDevice(
  input: CreateDeviceInput
): Promise<DeviceActionResult<DeviceListItem>> {
  const validationError = validateCreateInput(input)
  if (validationError) {
    return { success: false, error: validationError }
  }

  const supabase = await createClient()
  const normalizedInput = {
    ...input,
    name: normalizeText(input.name),
    serial_number: normalizeText(input.serial_number),
    ip_address: normalizeText(input.ip_address),
    location: normalizeText(input.location) || undefined,
    username: normalizeText(input.username),
    password: normalizeText(input.password),
    brand: input.brand || 'hikvision',
  }

  const connection = await buildConnectionResult(normalizedInput)

  if (normalizedInput.testConnection) {
    return {
      success: true,
      connectionSuccess: connection.reachable,
      connection,
    }
  }

  const nowIso = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('devices')
    .insert({
      name: normalizedInput.name,
      serial_number: normalizedInput.serial_number,
      ip_address: normalizedInput.ip_address,
      location: normalizedInput.location || null,
      brand: normalizedInput.brand,
      status: connection.status,
      device_username: normalizedInput.username,
      device_password_encrypted: normalizedInput.password,
      sync_status: connection.reachable ? 'synced' : 'disconnected',
      sync_error: connection.error ?? null,
      last_seen_at: connection.reachable ? nowIso : null,
      updated_at: nowIso,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error creating device:', error)
    return { success: false, error: error.message, connection }
  }

  revalidatePath('/dashboard/devices')
  revalidatePath('/dashboard/connectivity')

  return {
    success: true,
    data: mapDeviceRecordToListItem(data),
    connectionSuccess: connection.reachable,
    connection,
  }
}

export async function updateDeviceConnection(
  deviceId: string,
  input: UpdateDeviceConnectionInput
): Promise<DeviceActionResult<DeviceListItem>> {
  const current = await getDeviceRecordById(deviceId)

  if (!current) {
    return { success: false, error: 'No se encontró el dispositivo.' }
  }

  const nextConnection = {
    ip_address: normalizeText(input.ip_address) || current.ip_address || '',
    username: normalizeText(input.username) || current.device_username || '',
    password: normalizeText(input.password) || current.device_password_encrypted || '',
    brand: input.brand || current.brand || 'hikvision',
  }

  if (!nextConnection.ip_address || !nextConnection.username || !nextConnection.password) {
    return { success: false, error: 'La configuración de conexión del dispositivo está incompleta.' }
  }

  const connection = await performDeviceConnectionCheck(nextConnection)
  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('devices')
    .update({
      name: normalizeText(input.name) || current.name,
      serial_number: normalizeText(input.serial_number) || current.serial_number,
      location: normalizeText(input.location) || current.location,
      ip_address: nextConnection.ip_address,
      brand: nextConnection.brand,
      device_username: nextConnection.username,
      device_password_encrypted: nextConnection.password,
      status: connection.status,
      sync_status: connection.reachable ? 'synced' : 'disconnected',
      sync_error: connection.error ?? null,
      last_seen_at: connection.reachable ? nowIso : current.last_seen_at,
      updated_at: nowIso,
    })
    .eq('id', deviceId)
    .select('*')
    .single()

  if (error) {
    return { success: false, error: error.message, connection }
  }

  revalidatePath('/dashboard/devices')
  revalidatePath('/dashboard/connectivity')

  return {
    success: true,
    data: mapDeviceRecordToListItem(data),
    connectionSuccess: connection.reachable,
    connection,
  }
}

export async function deleteDevice(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting device:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/devices')
  return { success: true }
}

export async function updateDeviceStatus(
  deviceId: string,
  updates: Partial<{
    status: 'online' | 'offline' | 'unknown'
    sync_status: 'disconnected' | 'connecting' | 'syncing' | 'synced' | 'error'
    sync_error: string | null
    last_seen_at: string
    sync_last_at: string
  }>
) {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('devices')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deviceId)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating device status:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data: mapDeviceRecordToListItem(data) }
}

/**
 * Client-safe read model for device dashboards.
 */
export async function getDevices(): Promise<DeviceListItem[]> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('devices')
    .select(
      'id, name, serial_number, brand, model, ip_address, firmware_version, status, last_seen_at, location, sync_status, sync_error, sync_last_at, sync_events_count, last_event_synced_at, updated_at'
    )
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching devices:', error)
    return []
  }

  return ((data || []) as Record<string, unknown>[]).map(mapDeviceRecordToListItem)
}
