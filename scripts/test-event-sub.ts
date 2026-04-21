import https from 'node:https'
import crypto from 'node:crypto'
import { URL } from 'node:url'

async function digestRequest(url: string, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const host = '192.168.1.175'
    const username = 'admin'
    const password = 'evol@2601'
    
    const parsedUrl = new URL(url)
    const path = parsedUrl.pathname + (parsedUrl.search || '')
    
    // Simpler digest auth
    const nonce = Buffer.from(Date.now().toString()).toString('base64').substring(0, 16)
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
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    }

    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })

    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')) })
    
    if (body) req.write(body)
    req.end()
  })
}

async function testEvents() {
  console.log('=== Testing with JSON body format ===\n')
  
  // Try different JSON formats
  const formats = [
    {
      name: 'AcsEvent with searchID UUID',
      body: JSON.stringify({
        AcsEventCond: {
          searchID: '12345678-1234-1234-1234-123456789012',
          searchResultPosition: 0,
          maxResults: 10,
          startTime: '2026-04-01T00:00:00+00:00',
          endTime: '2026-04-17T00:00:00+00:00'
        }
      })
    },
    {
      name: 'Simple AcsEvent',
      body: JSON.stringify({
        AcsEventCond: {
          searchResultPosition: 0,
          maxResults: 10
        }
      })
    },
    {
      name: 'With major filter',
      body: JSON.stringify({
        AcsEventCond: {
          searchID: '1',
          searchResultPosition: 0,
          maxResults: 10,
          major: 5  // Access control
        }
      })
    }
  ]
  
  for (const fmt of formats) {
    console.log(`Testing: ${fmt.name}`)
    try {
      const r = await digestRequest(
        'https://192.168.1.175/ISAPI/AccessControl/AcsEvent?format=json',
        'POST',
        fmt.body
      )
      console.log(`  Status: ${r.status}`)
      console.log(`  Body: ${r.body.substring(0, 200)}`)
    } catch (e) {
      console.log(`  Error: ${e.message}`)
    }
    console.log('')
  }
}

testEvents().catch(console.error)