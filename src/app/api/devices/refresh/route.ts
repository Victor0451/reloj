import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  // Validate Bearer token auth
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.CRON_AUTH_TOKEN

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use admin client for server-side operations (bypasses RLS)
  const supabase = createAdminClient()

  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('id')

  if (!deviceId) {
    return NextResponse.json({ error: 'No device ID' }, { status: 400 })
  }

  // Only select safe fields — exclude device_password_encrypted and other sensitive data
  const { data: device, error } = await supabase
    .from('devices')
    .select('id, name, serial_number, model, ip_address, firmware_version, status, last_seen_at, location')
    .eq('id', deviceId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  }

  return NextResponse.json(device)
}