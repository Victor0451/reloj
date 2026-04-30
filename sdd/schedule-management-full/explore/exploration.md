# Exploration: schedule-management-full

## Topic
Full Schedule Management System with ISAPI Validation for Hikvision DS-K1T320MFWX

---

## Critical Finding

**The device DS-K1T320MFWX does NOT support TimeSchedule/TimeGroup ISAPI endpoints.**

Despite the capabilities endpoint reporting support for `CardRightWeekPlanCfg`, `UserRightPlanTemplate`, and `VerifyPlanTemplate`, all actual endpoint attempts return `notSupport`.

---

## 1. Validated ISAPI Endpoints

### Device Tested
- **IP**: 192.168.1.175 (NOT 192.168.100.60 as in docs)
- **Model**: DS-K1T320MFWX
- **Firmware**: V3.5.0 (build 221110)
- **MAC**: BC:9B:5E:3A:22:81

### Endpoints That WORK

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/ISAPI/System/deviceInfo` | GET | Device info | ✅ 200 - Works |
| `/ISAPI/System/time` | GET/PUT | Device time | ✅ Works |
| `/ISAPI/AccessControl/AcsEvent?format=json` | POST | Get events | ✅ 200 - Works |
| `/ISAPI/AccessControl/UserInfo/Search?format=json` | POST | Search users | ✅ 200 - Works |
| `/ISAPI/AccessControl/UserInfo/Record?format=json` | POST | Create user | ✅ 200 - Works |
| `/ISAPI/AccessControl/UserInfo/Modify?format=json` | PUT | Update user | ✅ 200 - Works |
| `/ISAPI/AccessControl/CardInfo/Record?format=json` | POST | Assign card | ✅ Works |
| `/ISAPI/AccessControl/RemoteControl/door/1` | PUT | Door control | ✅ Works (requires `cmd` param) |
| `/ISAPI/AccessControl/capabilities` | GET | ACS capabilities | ✅ 200 - Works |

### Endpoints That FAIL (notSupport)

| Endpoint | Error |
|----------|-------|
| `/ISAPI/AccessControl/TimeSchedule/template` | notSupport |
| `/ISAPI/AccessControl/TimeSchedule/template/capabilities` | notSupport |
| `/ISAPI/AccessControl/TimeGroup` | notSupport |
| `/ISAPI/AccessControl/Door/status/1` | notSupport |
| `/ISAPI/AccessControl/Door/capabilities` | notSupport |
| `/ISAPI/AccessControl/CardRightWeekPlanCfg` | notSupport |
| `/ISAPI/AccessControl/UserRightPlanTemplate` | notSupport |
| `/ISAPI/AccessControl/VerifyPlanTemplate` | notSupport |
| `/ISAPI/AccessControl/PlanTemplate` | notSupport |
| `/ISAPI/AccessControl/doorRight` | notSupport |
| `/ISAPI/AccessControl/CardInfo?format=json` | notSupport |

---

## 2. How planTemplateNo Works on This Device

### Current User RightPlan Structure

All users on this device use the same template:

```json
{
  "RightPlan": [
    {
      "doorNo": 1,
      "planTemplateNo": "1"
    }
  ]
}
```

### Key Observations

1. **All 25 users on device use `planTemplateNo: "1"`** - There's only ONE template in use
2. **Template "1" appears to be a built-in "always allowed" schedule** - Users with this template can access the door 24/7
3. **The device does NOT expose any API to configure what template "1" means**
4. **Template numbers are NOT the same as TimeSchedule IDs** - The device uses planTemplateNo as a reference to internally-defined schedules

### Device Capabilities Show Support But Don't Deliver

The `/ISAPI/AccessControl/capabilities` endpoint shows:
```
isSupportCardRightWeekPlanCfg>true</isSupportCardRightWeekPlanCfg>
isSupportUserRightPlanTemplate>true</isSupportUserRightPlanTemplate>
isSupportVerifyPlanTemplate>true</isSupportVerifyPlanTemplate>
```

But actual endpoints return `notSupport`. This is a **firmware limitation** of the DS-K1T320MFWX.

---

## 3. Current Adapter Analysis (hikvision.adapter.ts)

### Hardcoded planTemplateNo

**Lines 904-909 and 1023-1028:**
```typescript
RightPlan: [
  {
    doorNo: 1,
    planTemplateNo: "1",  // HARDCODED!
  },
],
```

### Missing Schedule Methods

The adapter has NO methods for:
- `getTimeTemplates()` - not implemented
- `createTimeTemplate()` - not implemented  
- `getTimeGroups()` - not implemented
- `createTimeGroup()` - not implemented
- `assignDoorToTimeGroup()` - not implemented

### What IS in the Adapter

| Method | Status |
|--------|--------|
| `getDeviceInfo()` | ✅ Working |
| `getEvents()` | ✅ Working |
| `getPersons()` | ✅ Working |
| `createPersonOnDevice()` | ✅ Working (uses hardcoded planTemplateNo: "1") |
| `updatePersonOnDevice()` | ✅ Working (uses hardcoded planTemplateNo: "1") |
| `syncPerson()` | ✅ Working |
| `deletePerson()` | ✅ Working |
| `getDoorStatus()` | ❌ Returns notSupport |
| `controlDoor()` | ✅ Working (with `cmd` param) |
| `assignCardToDevice()` | ✅ Working |
| `healthCheck()` | ✅ Working |

---

## 4. DB Schema (Current vs Required)

### Current Schema (supabase/schema.sql)

Tables exist:
- `persons` - has `employee_id`, `name`, `card_number`, `device_employee_no`
- `access_events` - stores events with `event_time`, `event_type`
- `devices` - has `serial_number`, `ip_address`, `model`
- `audit_logs` - generic audit trail

### Missing Tables for Schedule Management

```sql
-- Time Templates (what we WISH we could configure)
CREATE TABLE time_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g., "Horario Regular", "Turno Mañana"
  template_no INTEGER NOT NULL,          -- Device template number (1-255) 
  schedule_type TEXT NOT NULL,           -- 'weekly', 'holiday' (device only supports these)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_no)
);

-- Door Time Groups (device assignment)
CREATE TABLE door_time_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g., "Puerta Principal"
  group_no INTEGER NOT NULL,             -- Device group number
  template_id UUID REFERENCES time_templates(id),
  door_no INTEGER NOT NULL DEFAULT 1,   -- Always door 1 on this device
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_no, door_no)
);

-- Access Rules (person to schedule mapping)
CREATE TABLE access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g., "Empleados Admin"
  rule_no INTEGER NOT NULL,              -- Device rule number
  time_template_id UUID REFERENCES time_templates(id),
  person_filter JSONB,                   -- Filter criteria: departments, roles, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rule_no)
);

-- Person Schedule Overrides (per-person exception)
CREATE TABLE person_schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
  time_template_id UUID REFERENCES time_templates(id),
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**NOTE**: These tables CAN be created in DB, but the device cannot be configured via ISAPI. The schedules would be stored but NOT pushed to device.

---

## 5. User Flow Analysis

### What Users Want
1. Create time templates (e.g., "Lun-Vie 9:00-18:00")
2. Assign templates to doors
3. Assign employees to schedules
4. Sync to device

### What Device Actually Supports

**Device Reality:**
- Only supports ONE plan template (template "1") - always access
- No API to configure time schedules
- All users created via ISAPI get `planTemplateNo: "1"`

**Actual User Flow (Device Limitation):**
1. User creates time template in web UI → Stored in DB only
2. User assigns template to door → Stored in DB only  
3. User assigns employee to schedule → Stored in DB only
4. Agent syncs → CANNOT push schedules to device (endpoint not supported)
5. **Schedules are informational only** - device doesn't know about them

### Alternative: Work Around Device Limitation

Since device doesn't support schedule configuration via ISAPI:

1. **Store schedules in DB** for reference and attendance calculation
2. **Device stays at template "1" (24/7 access)** 
3. **Calculate attendance based on DB schedules**, not device enforcement
4. **Use events to track actual access times**, then cross-reference with schedules

---

## 6. MVP Scope Recommendation

### Reality Check

**Cannot deliver**: Full schedule management with device enforcement
**Can deliver**: Schedule visibility and attendance calculation based on events

### Recommended MVP: Schedule Visibility + Attendance Calculation

**What we CAN build:**

1. **DB Tables for Schedules** (informational only)
   - Store templates, groups, rules in DB
   - No device sync capability

2. **Schedule Builder UI** (read-only display)
   - Visual representation of planned schedules
   - Not pushed to device

3. **Attendance Calculation Engine** (app-side)
   - Use event logs to determine actual check-in/check-out
   - Cross-reference with planned schedules
   - Calculate: worked hours, tardiness, overtime

4. **Reports**
   - Hours worked per employee per day
   - Attendance summary vs planned schedule
   - Overtime detection (app-side)

### NOT in MVP (Device Limitations)

- Creating schedules on device
- Assigning templates to doors via ISAPI
- Pushing schedule changes to device
- Template number management (device hardcodes to "1")

---

## 7. Agent Changes Required

### If We Proceed with Schedule DB Storage Only

Minimal adapter changes - just document the limitation:

```typescript
// Add to HikvisionAdapter
async getScheduleCapabilities(): Promise<{supported: boolean; reason: string}> {
  return {
    supported: false,
    reason: 'DS-K1T320MFWX does not support TimeSchedule ISAPI endpoints'
  };
}
```

### If We Want to Support Other Devices (Future)

The adapter interface should be extended:

```typescript
interface IDeviceAdapter {
  // ... existing methods ...

  // Schedule Management
  getScheduleCapabilities(): Promise<ScheduleCapabilities>;
  getTimeTemplates(): Promise<TimeTemplate[]>;
  createTimeTemplate(template: TimeTemplate): Promise<SyncResult>;
  // ... etc
}

interface ScheduleCapabilities {
  supported: boolean;
  maxTemplates: number;
  supportsWeeklySchedule: boolean;
  supportsHolidaySchedule: boolean;
  reason?: string;
}
```

---

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Device doesn't support schedule endpoints | HIGH | Acknowledge limitation, store schedules in DB only, calculate attendance app-side |
| planTemplateNo is hardcoded to "1" | HIGH | Use template "1" as "always access", enforce schedules in attendance calculation |
| Only one door supported | MEDIUM | Document door 1 only, no multi-door support |
| Firmware may differ between devices | MEDIUM | Query capabilities endpoint before attempting schedule operations |
| Schedule stored in DB not on device | HIGH | Attendance calculated from events, not device enforcement |

---

## 9. Testing Summary

### Device Connectivity
```
ping 192.168.1.175 ✅ WORKS
curl deviceInfo ✅ WORKS  
```

### Schedule Endpoints
```
GET /ISAPI/AccessControl/TimeSchedule/template ❌ notSupport
GET /ISAPI/AccessControl/TimeGroup ❌ notSupport
GET /ISAPI/AccessControl/CardRightWeekPlanCfg ❌ notSupport
GET /ISAPI/AccessControl/UserRightPlanTemplate ❌ notSupport
```

### Working User Operations
```
POST /ISAPI/AccessControl/UserInfo/Search?format=json ✅ Returns 25 users
POST /ISAPI/AccessControl/UserInfo/Record?format=json ✅ Created test user 9999
POST /ISAPI/AccessControl/CardInfo/Record?format=json ✅ Works
```

### Working Door Operations
```
PUT /ISAPI/AccessControl/RemoteControl/door/1 (with cmd=open) ✅ Works
```

---

## 10. Conclusion

**The DS-K1T320MFWX does NOT support TimeSchedule or TimeGroup ISAPI configuration.**

All users on the device use `planTemplateNo: "1"` which appears to be a built-in "always allow" schedule with no configuration API.

**Realistic path forward:**
1. Store schedules in DB for documentation and attendance calculation
2. Keep device at default template "1" (24/7 access)
3. Calculate attendance based on event logs vs planned schedules
4. Build attendance reports that show planned vs actual

**Full schedule management via ISAPI would require a different Hikvision device model** that supports TimeSchedule endpoints.

---

## Ready for Proposal

**No** - This feature cannot be delivered as specified.

**What user should decide:**

1. **Accept DB-only schedules** (no device sync) and build attendance calculation instead?
2. **Defer until different device** is available that supports TimeSchedule ISAPI?
3. **Accept device limitation** and work around with app-side attendance calculation?

The exploration reveals the device constraint, not a code limitation. Code can be written to store and display schedules, but the device cannot receive them.