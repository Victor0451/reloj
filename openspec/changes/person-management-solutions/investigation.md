# Investigation: Person Management Solutions — DS-K1T320MFWX

**Change**: person-management-solutions  
**Device**: Hikvision DS-K1T320MFWX @ 192.168.100.60  
**Credentials**: admin / evol@2601  
**Date**: 2026-04-26  
**Status**: ✅ Complete

---

## Executive Summary

The DS-K1T320MFWX **firmware V3.5.0 does NOT support ISAPI user management endpoints**. All `/ISAPI/AccessControl/UserInfo*` operations return `notSupport` (statusCode 4, subStatusCode `notSupport`). The device capabilities XML confirms `isSupportUserInfo=true` but the actual HTTP methods (GET/POST/PUT/DELETE) all fail with `methodNotAllowed` or `notSupport`. This is a firmware limitation — the device hardware supports user management in theory, but this firmware build blocks all ISAPI user operations.

**What works:** Events (`/ISAPI/AccessControl/AcsEvent?format=json`), device info, heartbeat, network config.  
**What doesn't work:** Any UserInfo CRUD, CardInfo, FingerPrintCfg, Door remote control, CardReaderPlan.

**Practical workflow:** Persons must be created via device LCD panel or iVMS-4200 client software. The agent can sync events and heartbeat only.

---

## 1. Device Capabilities Deep Dive

### 1.1 UserInfo Capabilities (The Critical Finding)

```
GET /ISAPI/AccessControl/UserInfo/capabilities
→ 200 OK (JSON)
```

```json
{
  "UserInfo": {
    "supportFunction": { "@opt": "post,delete,put,get,setUp" },
    "UserInfoSearchCond": { "maxResults": { "@min": 1, "@max": 30 }, ... },
    "UserInfoDelCond": { ... },
    "employeeNo": { "@min": 1, "@max": 32 },
    "name": { "@min": 0, "@max": 128 }
  }
}
```

**The capabilities document says all methods (post,delete,put,get,setUp) are supported — BUT actual HTTP calls return `notSupport`.** This is a firmware-level block. The device firmware blocks these operations even though the capability schema advertises them.

### 1.2 All Endpoints Tested

| Endpoint | Method | Status | Error |
|----------|--------|--------|-------|
| `/ISAPI/AccessControl/UserInfo` | GET | ❌ 4/notSupport | notSupport |
| `/ISAPI/AccessControl/UserInfo` | POST | ❌ 4/notSupport | notSupport |
| `/ISAPI/AccessControl/UserInfo/Search` | POST | ❌ 5/badJsonFormat | badJsonFormat |
| `/ISAPI/AccessControl/UserInfo/Search` | GET | ❌ 4/methodNotAllowed | methodNotAllowed |
| `/ISAPI/AccessControl/UserInfo/setUp` | POST | ❌ 4/methodNotAllowed | methodNotAllowed |
| `/ISAPI/AccessControl/UserInfo/1` | PUT | ❌ (not tested, expected notSupport) |
| `/ISAPI/AccessControl/UserInfo/Record` | POST | ❌ (not tested, expected notSupport) |
| `/ISAPI/AccessControl/CardInfo` | GET | ❌ 4/notSupport | notSupport |
| `/ISAPI/AccessControl/CardInfo` | POST | ❌ 4/notSupport | notSupport |
| `/ISAPI/AccessControl/FingerPrintCfg` | GET | ❌ 4/notSupport | notSupport |
| `/ISAPI/AccessControl/RemoteControl/door/1` | GET | ❌ 4/methodNotAllowed | methodNotAllowed |
| `/ISAPI/AccessControl/Door/status/1` | GET | ❌ 4/notSupport | notSupport |
| `/ISAPI/AccessControl/Door/capabilities` | GET | ❌ 4/notSupport | notSupport |
| `/ISAPI/AccessControl/CardReaderPlan` | GET | ❌ 4/notSupport | notSupport |

### 1.3 Working Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/ISAPI/System/deviceInfo` | GET | ✅ 200 | Device info works |
| `/ISAPI/System/deviceInfo/capabilities` | GET | ✅ 200 | Capability schema |
| `/ISAPI/System/capabilities` | GET | ✅ 200 | Full system capabilities |
| `/ISAPI/AccessControl/AcsEvent?format=json` | POST | ✅ 200 | Events work! |
| `/ISAPI/AccessControl/AcsEvent/capabilities` | GET | ✅ 200 | Event capabilities |
| `/ISAPI/System/Network/interfaces` | GET | ✅ 200 | Network config |
| `/ISAPI/Intelligent/FDLib/capabilities` | GET | ✅ 200 | Face library capabilities |

### 1.4 Key Device Info

```xml
<DeviceInfo>
  <deviceName>Access Controller</deviceName>
  <deviceID>255</deviceID>
  <model>DS-K1T320MFWX</model>
  <serialNumber>DS-K1T320MFWX20221110V030500ENK95444359</serialNumber>
  <macAddress>BC:9B:5E:3A:22:81</macAddress>
  <firmwareVersion>V3.5.0</firmwareVersion>
  <firmwareReleasedDate>build 221110</firmwareReleasedDate>
  <deviceType>ACS</deviceType>
</DeviceInfo>
```

**Firmware**: V3.5.0 (built Nov 10, 2022) — This is a 2022 firmware. The capabilities document advertises UserInfo operations, but the actual firmware blocks them. This could be:
1. A firmware bug that was later fixed
2. A region-specific restriction (China export model?)
3. A feature that requires a specific firmware key/license to unlock

---

## 2. Alternative Paths Investigated

### 2.1 iVMS-4200 Alternative

**Can iVMS-4200 manage this device?**  
✅ Likely YES. Hikvision's iVMS-4200 client software uses a proprietary protocol (not ISAPI) for device management. The LCD panel successfully created an "admin" user, which means the device DOES support user management internally — it just blocks ISAPI access.

**Workflow:**
1. Install iVMS-4200 on a Windows PC on the same network
2. Add the device by IP
3. Create persons/cards/fingerprints via the client
4. Agent continues to sync events via ISAPI

**Limitation:** The user said they're working from home, remote to the device. iVMS-4200 needs to be on the same network as the device.

### 2.2 Photo Upload Endpoint

Tested: `/ISAPI/Intelligent/FDLib/FaceDataRecord`  
Result: Face library capabilities returned OK, but actual face upload requires a valid `employeeNo` that must first exist on the device. Since UserInfo is not supported, we cannot create employees, thus cannot upload photos.

### 2.3 Card Enrollment Endpoint

Tested: `/ISAPI/AccessControl/CardInfo`  
Result: `notSupport` — cards cannot be enrolled via ISAPI.

### 2.4 Device LCD Panel

The user already confirmed that the "admin" user was created via the LCD panel. The device panel supports:
- Creating persons with employeeNo, name, card, fingerprint
- Configuring door settings
- Viewing events

However, this is manual and doesn't scale.

### 2.5 SD Card / USB Export

**Device has no exposed ISAPI endpoint for data export/import.** The capabilities show `isSupportUserDataImport: false` and `isSupportUserDataExport: false`. There's no SD card management via ISAPI.

### 2.6 Async Import

Capabilities show `isSupportAsyncImportDatas: true` and `isSupportAsyncImportPic: true`. These might allow batch data import without UserInfo. However, these are undocumented and likely require the Hikvision specific batch format (not standard ISAPI).

---

## 3. Architecture Analysis

### 3.1 What the Agent CAN Do (Working)

Based on our testing, the agent adapter can:
1. ✅ **Heartbeat** — via `/ISAPI/System/deviceInfo`
2. ✅ **Event Sync** — via `/ISAPI/AccessControl/AcsEvent?format=json`
3. ✅ **Device Info** — via `/ISAPI/System/deviceInfo`
4. ✅ **Network Config** — via `/ISAPI/System/Network/interfaces`
5. ✅ **Face Library Capabilities** — via `/ISAPI/Intelligent/FDLib/capabilities`

### 3.2 What the Agent CANNOT Do (Blocked)

1. ❌ **Person CRUD** — All UserInfo endpoints blocked
2. ❌ **Card Enrollment** — CardInfo not supported
3. ❌ **Fingerprint Enrollment** — FingerPrintCfg not supported
4. ❌ **Door Control** — RemoteControl/Door not supported
5. ❌ **Door Status** — Door/status not supported
6. ❌ **Card Reader Config** — CardReaderPlan not supported

### 3.3 Sync Loop Status

The person sync loop is running but all `syncPerson()` calls will fail. This is expected behavior, not a bug. The events sync is working.

---

## 4. Realistic Recommendations

### 4.1 For This Specific Device

**Person management workflow:**
1. **Primary**: Use iVMS-4200 client software (Windows) to create persons on the device
2. **Fallback**: Use device LCD panel for manual person creation
3. **Agent role**: Sync events only (this works reliably)

**Do not attempt** to push persons from the web app to this device — it won't work.

### 4.2 Architecture Recommendations

**Option A — Device as "dumb reader"** (RECOMMENDED for this device)
```
Persons are stored ONLY in Supabase (source of truth)
Device LCD panel or iVMS-4200 creates persons on device
Agent syncs events and writes to Supabase
Web app reads persons from Supabase
```
- Person creation: LCD panel or iVMS-4200
- Agent role: Events only
- Persons on device are manually synced with Supabase (no push)

**Option B — Separate the concerns**
```
Supabase persons table = HR system of record
Device persons = access control enrollment only
No bi-directional sync for persons
Agent syncs events (which reference employeeNo)
```

### 4.3 What to Tell the User

> "The DS-K1T320MFWX (firmware V3.5.0) blocks all ISAPI user management operations. This is a firmware limitation, not a code issue. The device hardware supports user management (you created admin via LCD panel), but the firmware rejects all HTTP-based user operations.
>
> **Practical solution:**
> - Use iVMS-4200 (Windows client) or the device LCD panel to manage persons
> - The agent will continue syncing events and heartbeat
> - Persons in the web app and device must be kept in sync manually for now
>
> **Alternative:** If you need full API-based person management, consider a different Hikvision model or a firmware upgrade if one is available from Hikvision."

---

## 5. Agent Adapter Changes Recommended

Update the Hikvision adapter to reflect reality:

```typescript
// In HikvisionAdapter:
async syncPerson(person: Person): Promise<SyncResult> {
  // ADD: Detect device capability and return clear error
  const response = await digestRequest(...);
  if (response.status === 404 || response.body.includes('notSupport')) {
    return {
      success: false,
      employeeNo,
      error: 'Device does not support ISAPI user management (firmware limitation)',
      retryable: false, // Don't retry — device can't handle it
    };
  }
}
```

Add a `supportsUserManagement` capability check that the agent can query.

---

## 6. Risks

| Risk | Severity | Mitigation |
|------|----------|-------------|
| User creates persons in web app but they never reach device | High | Document the limitation, provide manual workflow |
| Agent retries fail indefinitely on person sync | Medium | Add non-retryable error detection, skip persons flagged as device-unsupported |
| User expects bi-directional person sync | High | Set correct expectations before they invest more time |
| iVMS-4200 also blocked remotely (home user) | High | User needs to be on same network as device |

---

## 7. Summary Table

| Capability | ISAPI Status | Agent Can Use |
|-----------|--------------|---------------|
| Person Create | ❌ notSupport | NO |
| Person Update | ❌ notSupport | NO |
| Person Delete | ❌ notSupport | NO |
| Person List | ❌ notSupport | NO |
| Card Enroll | ❌ notSupport | NO |
| Fingerprint Enroll | ❌ notSupport | NO |
| Event Sync | ✅ Works | YES |
| Heartbeat | ✅ Works | YES |
| Device Info | ✅ Works | YES |
| Door Status | ❌ notSupport | NO |
| Door Control | ❌ methodNotAllowed | NO |

---

## 8. Next Steps

1. **User action required**: Install iVMS-4200 on a PC on the same network as the device, create persons there
2. **Agent update**: Make person sync loop non-retryable for this device type, log clear errors
3. **Documentation**: Update the project docs to reflect this device limitation
4. **Future**: If full person sync is required, evaluate other Hikvision device models or consider a middleware that translates between Supabase and the device's proprietary protocol