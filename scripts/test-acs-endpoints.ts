import https from 'node:https'
import crypto from 'node:crypto'
import { URL } from 'node:url'

const host = process.env.DEVICE_IP || '192.168.1.175'
const username = process.env.DEVICE_USERNAME || 'admin'
const password = process.env.DEVICE_PASSWORD

if (!password) {
  console.error('❌ DEVICE_PASSWORD environment variable is required')
  console.error('   Usage: DEVICE_PASSWORD=mipass npx tsx scripts/test-acs-endpoints.ts')
  process.exit(1)
}

function digestRequest(url: string, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const path = parsedUrl.pathname + parsedUrl.search
    
    const nonce = Buffer.from(Date.now().toString() + Math.random()).toString('base64')
    const realm = 'Digest'
    const qop = 'auth'
    
    const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex')
    const ha2 = crypto.createHash('md5').update(`${method}:${path}`).digest('hex')
    const response = crypto.createHash('md5').update(`${ha1}:${nonce}:00000001:${nonce}:${qop}:${ha2}`).digest('hex')
    
    const authHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${path}", cnonce="${nonce}", nc=00000001, qop="${qop}", response="${response}"`

    const options = {
      hostname: host,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Authorization': authHeader
      }
    }

    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }))
    })

    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')) })
    
    if (body) req.write(body)
    req.end()
  })
}

async function testEndpoints() {
  console.log('=== Testing Hikvision ACS Endpoints ===\n')
  
  // Test 1: DeviceInfo
  console.log('1. /ISAPI/System/deviceInfo/1')
  const r1 = await digestRequest(`https://${host}/ISAPI/System/deviceInfo/1`)
  console.log('   Status:', r1.status)
  if (r1.status === 200) {
    const serial = r1.body.match(/<serialNumber>([^<]+)<\/serialNumber>/)
    const model = r1.body.match(/<model>([^<]+)<\/model>/)
    console.log('   Serial:', serial?.[1])
    console.log('   Model:', model?.[1])
  }
  console.log('')
  
  // Test 2: Event notification
  console.log('2. /ISAPI/Event/notification/notify-idxData')
  const r2 = await digestRequest(`https://${host}/ISAPI/Event/notification/notify-idxData`, 'GET')
  console.log('   Status:', r2.status)
  if (r2.status === 200) console.log('   Response:', r2.body.substring(0, 200))
  console.log('')
  
  // Test 3: AcsEvent
  const eventBody = `<?xml version="1.0" encoding="utf-8"?>
<searchEvents>
  <searchID>test001</searchID>
  <searchResultPosition>0</searchResultPosition>
  <maxResults>10</maxResults>
  <timeSearchType>point</timeSearchType>
  <startTime>2026-04-15T00:00:00</startTime>
  <endTime>2026-04-17T00:00:00</endTime>
</searchEvents>`
  
  console.log('3. /ISAPI/AccessControl/AcsEvent (POST)')
  const r3 = await digestRequest(`https://${host}/ISAPI/AccessControl/AcsEvent`, 'POST', eventBody)
  console.log('   Status:', r3.status)
  console.log('   Body:', r3.body.substring(0, 400))
}

testEndpoints().catch(console.error)