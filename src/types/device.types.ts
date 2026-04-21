export type DeviceStatus = 'online' | 'offline' | 'unknown'
export type SyncStatus = 'disconnected' | 'connecting' | 'syncing' | 'synced' | 'error'
export type DeviceBrand = 'hikvision' | 'zkteco' | 'suprema' | 'dahua' | string

export interface DeviceRuntimeState {
  status: DeviceStatus
  sync_status?: SyncStatus | string
  sync_error: string | null
  last_seen_at: string | null
  sync_last_at: string | null
  sync_events_count?: number
  last_event_synced_at?: string | null
  updated_at?: string
}

/**
 * Safe DTO for Server Component -> Client Component boundaries.
 * MUST NOT include device credentials or other secrets.
 */
export interface DeviceListItem extends DeviceRuntimeState {
  id: string
  name: string
  serial_number: string
  brand: DeviceBrand
  model: string | null
  ip_address: string | null
  firmware_version: string | null
  location: string | null
}

/**
 * Internal server-side device record including secret-bearing fields.
 * Never pass this type to Client Components.
 */
export interface DeviceRecord extends DeviceListItem {
  device_username: string | null
  device_password_encrypted: string | null
}

// Backward-compatible alias while the rest of the UI migrates to the safe DTO name.
export type Device = DeviceListItem

export interface DeviceConnectionInput {
  ip_address: string
  username: string
  password: string
  brand?: DeviceBrand
  port?: number
}

export interface CreateDeviceInput extends DeviceConnectionInput {
  name: string
  serial_number: string
  location?: string
  testConnection?: boolean
}

export interface UpdateDeviceConnectionInput extends Partial<DeviceConnectionInput> {
  name?: string
  serial_number?: string
  location?: string
}

export interface DeviceActionResult<T = undefined> {
  success: boolean
  error?: string
  data?: T
  connectionSuccess?: boolean
  connection?: DeviceConnectionCheckResult
}

export interface DeviceConnectionCheckResult {
  reachable: boolean
  status: DeviceStatus
  latency?: number
  error?: string
  timestamp: string
}
