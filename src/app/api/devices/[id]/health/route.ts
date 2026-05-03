import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { HikvisionAdapter } from '../../../../../../agent/src/adapters/hikvision.adapter'
import { decryptDevicePassword } from '@/lib/crypto/device-credentials'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deviceId } = await params

  if (!deviceId) {
    return NextResponse.json({ error: 'No device ID' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Fetch device credentials (not safe fields - we need them for health check)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: device, error: dbError } = await (supabase as any)
    .from('devices')
    .select('id, ip_address, device_username, device_password_encrypted, brand, allow_self_signed_cert')
    .eq('id', deviceId)
    .single()

  if (dbError || !device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  }

  // Check for incomplete credentials
  if (!device.ip_address || !device.device_username || !device.device_password_encrypted) {
    return NextResponse.json(
      { error: 'Device has incomplete connection configuration' },
      { status: 422 }
    )
  }

  // Create adapter and perform health check
  try {
    const plaintextPassword = decryptDevicePassword(device.device_password_encrypted)
    const adapter = new HikvisionAdapter({
      ip: device.ip_address,
      port: 443,
      username: device.device_username,
      password: plaintextPassword,
      rejectUnauthorized: device.allow_self_signed_cert ? false : true,
    })

    const health = await adapter.healthCheck()

    await adapter.disconnect()

    // Return sanitized response - no credentials exposed
    return NextResponse.json({
      status: health.reachable ? 'online' : 'offline',
      latency: health.latency,
      error: health.error,
      timestamp: health.timestamp.toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        error: err instanceof Error ? err.message : 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}