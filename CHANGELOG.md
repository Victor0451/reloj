# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-27

### 🎯 Features

- **Person Bidirectional Sync**: Import persons from device to DB via `syncPersonsFromDevice()`. The system now syncs in both directions: DB→Device (create/update persons) and Device→DB (import new enrollments directly on device).
- **Card Assignment**: Automatic card assignment after person provisioning via `assignCardToDevice()`. Cards are linked to employeeNo on the Hikvision device.
- **Next Available EmployeeNo**: Automatic ID assignment when creating a person without explicit `employee_id`. The system finds the smallest unused positive integer on the device.

### 🐛 Bug Fixes

- **Attendance Events Mapping** (`FIX-001`): Events now display correct labels (Entrada/Salida) instead of `duress_alarm`. The fix uses `attendanceStatus` field from device payload instead of relying solely on `major=5` event type.
- **Event Sync RLS Error**: Fixed Supabase RLS auth error by switching from `supabaseRealtime` (anon key) to `supabaseAdmin` for event sync operations.
- **getPersons() Empty Results**: Fixed by migrating from XML endpoint to JSON POST `/ISAPI/AccessControl/UserInfo/Search?format=json`. The device was returning empty results because the XML endpoint was incompatible.
- **syncSinglePerson Null EmployeeNo**: Fixed null `employee_id` routing. Previously, when `employee_id` was null, the code called `createPerson()` (old XML method). Now correctly calls `createPersonOnDevice()` (JSON ISAPI) and auto-assigns employeeNo.
- **Frontend Filter Select Stale Closure**: Fixed filter selects showing stale state by using controlled inputs with proper value binding.

### 🔄 Improvements

- **Retry Queue with Exponential Backoff**: Failed person syncs now retry with delays of 30s → 60s → 120s before moving to dead-letter. This provides resilience against transient network failures.
- **JSON ISAPI Migration**: Migrated 5 methods from XML to JSON ISAPI: `getPersons()`, `createPersonOnDevice()`, `syncPerson()`, `assignCardToDevice()`, `getNextAvailableEmployeeNo()`.
- **Enhanced Event Data**: Added 4 columns to `access_events` table: `device_serial_no`, `door_no`, `card_reader_no`, `label`. Provides richer context for each event.
- **Enhanced Deduplication**: Event dedup key now includes `cardReaderNo` to prevent duplicates in multi-reader scenarios.

### 📚 Documentation

- **Obsidian Knowledge Base**: Created complete documentation structure with [[Operación - Sincronización de Personas]], [[Fix - Attendance Events Mapping]], [[Fase 8 - Person Provisioning]].
- **ISAPI Reference**: Validated curl commands in `docs/implementacion_hikvision_nextjs_api.md` and `docs/operacion-ds-k1t320mfwx.md`.
- **Remote Access Guide**: Documented in `docs/acceso_remoto_hikvision.md`.

### 🚦 Operations

- **Person Provisioning Workflow**: Complete end-to-end workflow for creating persons from frontend:
  1. Create person in DB (status: `pending_sync`)
  2. Sync to device (auto-assign employeeNo if needed)
  3. Assign card to device
  4. Update DB (status: `active`)
  5. Events flow back via polling loop

### 🔒 Security

- **Dead-Letter Queue**: Persons that fail 3 sync attempts are moved to `sync_dead_letter` status, preventing infinite retry loops and providing audit trail for manual intervention.

---

## [0.1.0] - 2026-04-14

### 🎯 Features

- **Phase 1: Infrastructure**: Base project setup with Next.js 16, Supabase, Tailwind CSS v4
- **Phase 2: Agent Bridge**: Node.js bridge service connecting Hikvision ISAPI to Supabase, with heartbeat monitoring
- **Phase 3: Person Management**: CRUD operations for persons, device enrollment, card assignment
- **Phase 4: Events and Dashboard**: Real-time events display, CSV export, attendance table with labels
- **Door Control**: Remote door control via agent dispatcher
- **Attendance Reports**: Excel export with date range filtering

### 📚 Documentation

- **Judgment Day Reviews**: Completed adversarial reviews for Phase 2 (14-Apr-2026) and Phase 3 (13-Apr-2026)
- **Architecture Documentation**: Obsidian-based knowledge base with system state, operations, and decisions
