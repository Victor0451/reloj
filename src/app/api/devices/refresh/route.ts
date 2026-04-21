import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('id')
  
  if (!deviceId) {
    return NextResponse.json({ error: 'No device ID' }, { status: 400 })
  }
  
  const { data: device, error } = await (supabase as any)
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(device)
}