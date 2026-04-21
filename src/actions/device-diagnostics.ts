'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { HikvisionAdapter } from '../../agent/src/adapters/hikvision.adapter'
import { randomUUID } from 'crypto'
import { isapiRequest } from '../../agent/src/isapi/client'
import type { Config } from '../../agent/src/config'

export type DevicePersonEntry = {
  id: string
  employeeNo: string | null
  name: string
  cardNumber: string | null
}

export type DeviceDiagnosticsResult = {
  success: boolean
  deviceId: string
  deviceName: string
  ipAddress: string | null
  deviceInfo?: {
    serialNumber: string
    model: string
    firmwareVersion: string
    deviceName: string
    manufacturer: string
  }
  persons: DevicePersonEntry[]
  users: DevicePersonEntry[]
  counts: {
    persons: number
    users: number
  }
  searchProbe?: {
    endpoint: string
    status: number | null
    matchCount: number
    matchedPeople: DevicePersonEntry[]
    notes?: string
  }
  warnings: string[]
  error?: string
}

type DeviceDiagnosticsRecord = {
  id: string
  name: string
  ip_address: string | null
  device_username: string | null
  device_password_encrypted: string | null
}

type SearchVariant = {
  label: string
  payload: Record<string, unknown>
}

async function getDeviceById(deviceId: string): Promise<DeviceDiagnosticsRecord | null> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('devices')
    .select('id, name, ip_address, device_username, device_password_encrypted')
    .eq('id', deviceId)
    .single()

  if (error || !data) {
    return null
  }

  return data as DeviceDiagnosticsRecord
}

function mapEntry(input: { id?: string; employeeNo?: string | null; name?: string | null; cardNumber?: string | null }): DevicePersonEntry {
  return {
    id: input.id || input.employeeNo || randomUUID(),
    employeeNo: input.employeeNo ?? null,
    name: input.name || 'Unknown',
    cardNumber: input.cardNumber ?? null,
  }
}

function collectPeopleFromNode(node: unknown, output: DevicePersonEntry[] = []): DevicePersonEntry[] {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectPeopleFromNode(item, output)
    }
    return output
  }

  if (!node || typeof node !== 'object') {
    return output
  }

  const record = node as Record<string, unknown>
  const hasPersonShape =
    typeof record.employeeNo !== 'undefined' ||
    typeof record.name !== 'undefined' ||
    typeof record.cardNo !== 'undefined' ||
    typeof record.cardNumber !== 'undefined'

  if (hasPersonShape) {
    output.push(
      mapEntry({
        id: typeof record.employeeNo === 'string' ? record.employeeNo : undefined,
        employeeNo: typeof record.employeeNo === 'string' ? record.employeeNo : null,
        name: typeof record.name === 'string' ? record.name : undefined,
        cardNumber:
          typeof record.cardNo === 'string'
            ? record.cardNo
            : typeof record.cardNumber === 'string'
              ? record.cardNumber
              : null,
      })
    )
  }

  for (const value of Object.values(record)) {
    collectPeopleFromNode(value, output)
  }

  return output
}

function parseSearchUsers(payload: unknown): DevicePersonEntry[] {
  if (!payload || typeof payload !== 'object') return []

  const root = payload as Record<string, unknown>
  const searchNode =
    (root.UserInfoSearch as Record<string, unknown> | undefined) ??
    (root.UserInfo as Record<string, unknown> | undefined) ??
    root

  const userNodes =
    (searchNode.UserInfo as unknown[] | Record<string, unknown> | undefined) ??
    (searchNode.UserInfoList as unknown[] | Record<string, unknown> | undefined) ??
    []

  const items = Array.isArray(userNodes) ? userNodes : [userNodes]

  const result: DevicePersonEntry[] = []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const employeeNo = typeof record.employeeNo === 'string' ? record.employeeNo : null
    const name = typeof record.name === 'string' ? record.name : undefined
    const cardNumber =
      typeof record.cardNo === 'string'
        ? record.cardNo
        : typeof record.cardNumber === 'string'
          ? record.cardNumber
          : null

    if (employeeNo || name || cardNumber) {
      result.push(
        mapEntry({
          id: employeeNo || undefined,
          employeeNo,
          name,
          cardNumber,
        })
      )
    }
  }

  if (result.length > 0) return result
  return collectPeopleFromNode(payload)
}

async function probeUserInfoSearch(device: DeviceDiagnosticsRecord): Promise<DeviceDiagnosticsResult['searchProbe']> {
  const config: Config = {
    deviceIp: device.ip_address || '',
    deviceUsername: device.device_username || '',
    devicePassword: device.device_password_encrypted || '',
    devicePort: 443,
    supabaseUrl: '',
    supabaseServiceRoleKey: '',
    supabaseAnonKey: '',
    pollIntervalMs: 30000,
    heartbeatIntervalMs: 60000,
    doorPollIntervalMs: 10000,
    commandPollIntervalMs: 2000,
    logLevel: 'info',
  }

  const variants: SearchVariant[] = [
    {
      label: 'base',
      payload: {
        UserInfoSearchCond: {
          searchID: 'diagnostic-base',
          searchResultPosition: 0,
          maxResults: 200,
        },
      },
    },
    {
      label: 'fuzzy-admin',
      payload: {
        UserInfoSearchCond: {
          searchID: 'diagnostic-fuzzy-admin',
          searchResultPosition: 0,
          maxResults: 200,
          fuzzySearch: 'admin',
        },
      },
    },
    {
      label: 'employee-admin',
      payload: {
        UserInfoSearchCond: {
          searchID: 'diagnostic-employee-admin',
          searchResultPosition: 0,
          maxResults: 200,
          EmployeeNoList: [{ employeeNo: 'admin' }],
        },
      },
    },
  ]

  for (const variant of variants) {
    try {
      const response = await isapiRequest<string>(
        config,
        '/ISAPI/AccessControl/UserInfo/Search?format=json',
        'POST',
        JSON.stringify(variant.payload),
        'application/json'
      )

      const parsed = JSON.parse(response.rawXml || '{}') as Record<string, unknown>
      const matches = parseSearchUsers(parsed)

      if (matches.length > 0) {
        return {
          endpoint: `/ISAPI/AccessControl/UserInfo/Search (${variant.label})`,
          status: response.statusCode,
          matchCount: matches.length,
          matchedPeople: matches,
          notes: undefined,
        }
      }

      return {
        endpoint: `/ISAPI/AccessControl/UserInfo/Search (${variant.label})`,
        status: response.statusCode,
        matchCount: 0,
        matchedPeople: [],
        notes:
          'El endpoint respondió, pero no devolvió coincidencias visibles; el siguiente paso es probar la variante de búsqueda que mejor soporte este firmware o migrar la lectura al flujo remoto del agent.',
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      if (message.toLowerCase().includes('socket hang up')) {
        continue
      }

      return {
        endpoint: `/ISAPI/AccessControl/UserInfo/Search (${variant.label})`,
        status: error instanceof Error && 'statusCode' in error ? Number((error as { statusCode?: number }).statusCode ?? null) : null,
        matchCount: 0,
        matchedPeople: [],
        notes: message,
      }
    }
  }

  return {
    endpoint: '/ISAPI/AccessControl/UserInfo/Search',
    status: null,
    matchCount: 0,
    matchedPeople: [],
    notes: 'Todas las variantes de búsqueda devolvieron socket hang up',
  }
}

async function probeUserInfoCount(device: DeviceDiagnosticsRecord): Promise<number | null> {
  const config: Config = {
    deviceIp: device.ip_address || '',
    deviceUsername: device.device_username || '',
    devicePassword: device.device_password_encrypted || '',
    devicePort: 443,
    supabaseUrl: '',
    supabaseServiceRoleKey: '',
    supabaseAnonKey: '',
    pollIntervalMs: 30000,
    heartbeatIntervalMs: 60000,
    doorPollIntervalMs: 10000,
    commandPollIntervalMs: 2000,
    logLevel: 'info',
  }

  try {
    const response = await isapiRequest<string>(
      config,
      '/ISAPI/AccessControl/UserInfo/Count?format=json',
      'GET',
      undefined,
      'application/json'
    )

    const parsed = JSON.parse(response.rawXml || '{}') as Record<string, unknown>
    const countNode = parsed.UserInfoCount as Record<string, unknown> | undefined
    const userNumber = countNode?.userNumber
    return typeof userNumber === 'number' ? userNumber : Number(userNumber ?? NaN) || null
  } catch {
    return null
  }
}

export async function diagnoseDevicePersons(deviceId: string): Promise<DeviceDiagnosticsResult> {
  const device = await getDeviceById(deviceId)

  if (!device) {
    return {
      success: false,
      deviceId,
      deviceName: 'Desconocido',
      ipAddress: null,
      persons: [],
      users: [],
      counts: { persons: 0, users: 0 },
      warnings: [],
      error: 'No se encontró el dispositivo',
    }
  }

  if (!device.ip_address || !device.device_username || !device.device_password_encrypted) {
    return {
      success: false,
      deviceId: device.id,
      deviceName: device.name,
      ipAddress: device.ip_address,
      persons: [],
      users: [],
      counts: { persons: 0, users: 0 },
      warnings: [],
      error: 'El dispositivo no tiene credenciales completas para diagnóstico',
    }
  }

  const adapter = new HikvisionAdapter({
    ip: device.ip_address,
    username: device.device_username,
    password: device.device_password_encrypted,
    port: 443,
  })

  const warnings: string[] = []

  try {
    const [deviceInfo, personsRaw, usersRaw] = await Promise.all([
      adapter.getDeviceInfo().catch((error: unknown) => {
        warnings.push(`No se pudo leer deviceInfo: ${error instanceof Error ? error.message : 'error desconocido'}`)
        return null
      }),
      adapter.getPersons().catch((error: unknown) => {
        warnings.push(`No se pudo leer getPersons(): ${error instanceof Error ? error.message : 'error desconocido'}`)
        return []
      }),
      adapter.getUsers().catch((error: unknown) => {
        warnings.push(`No se pudo leer getUsers(): ${error instanceof Error ? error.message : 'error desconocido'}`)
        return []
      }),
    ])

    const [searchProbe, userCount] = await Promise.all([
      probeUserInfoSearch(device),
      probeUserInfoCount(device),
    ])

    const persons = personsRaw.map((person) => mapEntry({
      id: person.id,
      employeeNo: person.employeeNo || person.employeeId || null,
      name: person.name,
      cardNumber: person.cardNumber || null,
    }))

    const users = usersRaw.map((user) => mapEntry({
      id: user.id,
      employeeNo: user.employeeNo || user.employeeId || null,
      name: user.name,
      cardNumber: user.cardNumber || null,
    }))

    if (persons.length === 0 && users.length === 0) {
      warnings.push('El reloj respondió, pero no devolvió personas ni users en los endpoints probados')
    }

    return {
      success: true,
      deviceId: device.id,
      deviceName: device.name,
      ipAddress: device.ip_address,
      deviceInfo: deviceInfo
        ? {
            serialNumber: deviceInfo.serialNumber,
            model: deviceInfo.model,
            firmwareVersion: deviceInfo.firmwareVersion,
            deviceName: deviceInfo.deviceName,
            manufacturer: deviceInfo.manufacturer,
          }
        : undefined,
      persons,
      users,
      counts: {
        persons: persons.length,
        users: users.length,
      },
      searchProbe,
      warnings: userCount !== null && userCount > 0 && persons.length === 0 && users.length === 0
        ? [...warnings, `UserInfo/Count reporta ${userCount} usuario(s), pero los listados no devolvieron entradas`] 
        : warnings,
    }
  } finally {
    await adapter.disconnect()
  }
}
