import { HikvisionAdapter } from '../agent/src/adapters/hikvision.adapter'

const deviceIp = process.env.DEVICE_IP || '192.168.1.175'
const devicePassword = process.env.DEVICE_PASSWORD

if (!devicePassword) {
  console.error('❌ DEVICE_PASSWORD environment variable is required')
  console.error('   Usage: DEVICE_PASSWORD=mipass npx tsx scripts/test-event-variant.ts')
  process.exit(1)
}

const adapter = new HikvisionAdapter({
  ip: deviceIp,
  port: 443,
  username: process.env.DEVICE_USERNAME || 'admin',
  password: devicePassword,
})

async function test() {
  // Test different event formats
  
  // Try 1: With proper searchID format
  console.log('=== Testing different event formats ===\n')
  
  const test1 = await adapter.getEvents({
    startTime: new Date('2026-04-01T00:00:00'),
    endTime: new Date('2026-04-17T00:00:00'),
    maxResults: 10
  })
  console.log('Events:', test1.length)
  
  // Try to get device info to understand capabilities  
  const info = await adapter.getDeviceInfo()
  console.log('\nDevice:', info.model, '- Firmware:', info.firmwareVersion)
  
  await adapter.disconnect()
  
  console.log('\nDone - device may need manual event retrieval')
}

test().catch(e => console.error('Error:', e.message))