# Exploration: schedule-management-system

## Topic
Schedule Management System for Hikvision DS-K1T320MXW Time Attendance Device

---

## Current State

The Hikvision DS-K1T320MXW device has time schedule capabilities configured **directly on the device** (physical access), not via web interface. The current agent bridge (`agent/src/adapters/hikvision.adapter.ts`) only syncs:
- **Persons** (outbound: DB → device)
- **Events** (inbound: device → DB)

The user creation on device uses hardcoded `planTemplateNo: "1"` (line 904-909, 1023-1028), meaning the device must already have template "1" configured.

---

## Affected Areas

| File | Why Affected |
|------|--------------|
| `agent/src/adapters/hikvision.adapter.ts` | Needs new methods for TimeSchedule/TimeGroup/AccessRule CRUD |
| `agent/src/core/interfaces.ts` | `IDeviceAdapter` needs new schedule-related method signatures |
| `supabase/schema.sql` | Missing tables: `time_templates`, `door_time_groups`, `access_rules` |
| `src/actions/persons.ts` | No `updatePersonSchedule` action exists yet |
| `src/app/` | New UI routes needed for schedule management |

---

## 1. Available ISAPI Endpoints for Schedule Management

Based on Hikvision ISAPI Access Control specification:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ISAPI/AccessControl/TimeSchedule/template` | GET/POST | List/create time schedule templates |
| `/ISAPI/AccessControl/TimeSchedule/template/{templateNo}` | GET/PUT/DELETE | Manage specific template |
| `/ISAPI/AccessControl/TimeSchedule/template/capabilities` | GET | Get supported template types |
| `/ISAPI/AccessControl/TimeGroup` | GET/POST | List/create door time groups |
| `/ISAPI/AccessControl/TimeGroup/{groupNo}` | GET/PUT/DELETE | Manage specific time group |
| `/ISAPI/AccessControl/AcsDoorTimeGroup` | GET/POST | Door-to-time-group assignments |
| `/ISAPI/AccessControl/RightPlan` | GET/POST | Access rights plan (template+door mapping) |

**Critical Gap**: None of these endpoints are implemented in the current `HikvisionAdapter` class.

---

## 2. Proposed DB Schema

```sql
-- Time Schedule Templates (defines WHEN access is allowed)
CREATE TABLE time_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g., "Horario Regular", "Turno Mañana"
  template_no INTEGER NOT NULL,          -- Device template number (1-255)
  schedule_type TEXT NOT NULL,           -- 'weekly', 'cyclic', 'holiday'
  monday_start TIME,
  monday_end TIME,
  tuesday_start TIME,
  tuesday_end TIME,
  wednesday_start TIME,
  wednesday_end TIME,
  thursday_start TIME,
  thursday_end TIME,
  friday_start TIME,
  friday_end TIME,
  saturday_start TIME,
  saturday_end TIME,
  sunday_start TIME,
  sunday_end TIME,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_no)
);

-- Door Time Groups (assigns templates to doors)
CREATE TABLE door_time_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g., "Puerta Principal", "Entrada Lateral"
  group_no INTEGER NOT NULL,             -- Device group number
  template_id UUID REFERENCES time_templates(id),
  door_no INTEGER NOT NULL,              -- Device door number (1-4 typically)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_no, door_no)
);

-- Access Rules (maps employee groups to time groups)
CREATE TABLE access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g., "Empleados Admin", "Contratistas"
  rule_no INTEGER NOT NULL,              -- Device rule number
  person_group TEXT NOT NULL,            -- 'all', or specific department/role
  door_time_group_id UUID REFERENCES door_time_groups(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rule_no)
);

-- Person Schedule Override (per-person exception)
CREATE TABLE person_schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
  time_template_id UUID REFERENCES time_templates(id),
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note**: The existing `persons` table may also need `schedule_start TIME`, `schedule_end TIME`, `tolerance_minutes INTEGER` columns as per the Phase 2 spec in `openspec/changes/event-driven-person-sync/`.

---

## 3. Agent Capabilities for Pushing Configs to Device

### Current State
- **Sync direction**: DB → Device (persons only), Device → DB (events only)
- **No push for schedules**: Time templates are configured directly on device
- **Hardcoded template reference**: `planTemplateNo: "1"` assumed to exist

### Required Adapter Methods

```typescript
interface IDeviceAdapter {
  // ... existing methods ...

  // Time Template Management
  getTimeTemplates(): Promise<TimeTemplate[]>;
  createTimeTemplate(template: TimeTemplate): Promise<SyncResult>;
  updateTimeTemplate(templateNo: number, template: TimeTemplate): Promise<SyncResult>;
  deleteTimeTemplate(templateNo: number): Promise<void>;

  // Time Group Management
  getTimeGroups(): Promise<DoorTimeGroup[]>;
  createTimeGroup(group: DoorTimeGroup): Promise<SyncResult>;
  updateTimeGroup(groupNo: number, group: DoorTimeGroup): Promise<SyncResult>;
  deleteTimeGroup(groupNo: number): Promise<void>;

  // Door-to-Group Assignment
  getDoorTimeGroups(): Promise<DoorTimeGroupAssignment[]>;
  assignDoorToTimeGroup(doorNo: number, groupNo: number): Promise<SyncResult>;

  // Access Rule Management
  getAccessRules(): Promise<AccessRule[]>;
  createAccessRule(rule: AccessRule): Promise<SyncResult>;
  updateAccessRule(ruleNo: number, rule: AccessRule): Promise<SyncResult>;
  deleteAccessRule(ruleNo: number): Promise<void>;
}
```

### Sync Strategy Implications
- **Bidirectional sync required**: Schedules push from DB to device
- **Conflict resolution needed**: If device has direct changes, what wins?
- **Validation before push**: Template numbers must be allocated, not collide

---

## 4. UI Components Required

### Schedule Builder (Visual Editor)
- Weekly calendar grid (Mon-Sun rows, hour columns)
- Drag-to-paint time ranges on days
- Support multiple templates with color coding
- Preview: which employees/doors use this template

### Door Assignment UI
- List of doors with current time group
- Dropdown to reassign templates
- Visual indicator of schedule coverage

### Rule Mapping Interface
- Department/role selector
- Door + time group assignment
- Per-person override panel

### Overtime Rules (Out of MVP Scope)
- Complex business logic (after X hours, weekend multipliers)
- Better handled app-side in attendance calculation, not device-side

---

## 5. Recommended MVP Scope

### MVP (Phase 1) — Read-only Visibility
**Goal**: See what schedules exist on the device

1. Add `getTimeTemplates()` to adapter (GET endpoint)
2. Add `getTimeGroups()` to adapter
3. UI: Display device schedule config in admin panel
4. No push capability — schedules still configured directly on device

**Why**: Validate which ISAPI endpoints actually work on DS-K1T320MXW firmware before building write capabilities.

### Phase 2 — Template Management
1. Add CRUD for `time_templates` in DB
2. Add `createTimeTemplate()` / `updateTimeTemplate()` adapter methods
3. UI: Schedule builder to create/edit templates
4. Push templates to device

### Phase 3 — Door Assignment + Rules
1. Door-to-template assignment
2. Access rule mapping
3. Person schedule overrides

---

## Risks

| Risk | Mitigation |
|------|------------|
| Device firmware doesn't support TimeSchedule endpoints | Validate with `?format=json` capability check first |
| Template number collision (1-255 limit) | Implement allocation strategy in DB |
| Sync conflicts (device direct config vs DB) | Define conflict resolution policy (device wins? DB wins? newer wins?) |
| Overtime complexity | Keep overtime calculation app-side, device just stores schedule |
| Timezone handling | Device uses local time; schedules should store timezone explicitly |

---

## Ready for Proposal

**Yes** — with the following scope clarification needed from user:

1. **Device Direct Config vs Web Push**: Are schedules currently configured directly on the device? Should the web interface push schedules to device, or is read-only visibility acceptable initially?

2. **Overtime Rules**: Should overtime be computed by the device (using device-side time templates) or by the application (using app-side attendance calculations)?

3. **Sync Direction**: If pushing to device, should schedules sync bidirectionally (DB ↔ device) or only outbound (DB → device)?

