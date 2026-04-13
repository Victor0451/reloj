# Technical Design: Fase 3 — Gestion de Personas (CRUD + Photo + ISAPI Sync)

## Executive Summary

This design implements a complete person management system across two boundaries: the **web application** (Next.js Server Actions + UI components) and the **agent bridge** (ISAPI person methods + sync loop). The web app handles CRUD operations, photo uploads, and CSV import. The agent polls for pending/inactive persons and synchronizes them to the Hikvision device via ISAPI endpoints.

---

## 1. Module Architecture — File Structure

### Web Application

```
src/
├── actions/
│   └── persons.ts                  # Server Actions (create, update, delete, list, photo upload URL)
├── types/
│   └── person.ts                   # Shared Person type + form schema
├── hooks/
│   └── use-persons.ts              # Client-side hook for optimistic updates + revalidation
├── app/(dashboard)/dashboard/persons/
│   └── page.tsx                    # Rebuild from stub → PersonsTable
├── components/
│   └── persons/
│       ├── persons-table.tsx       # Main table: search, filter, paginate, actions
│       ├── persons-table-client.tsx # Client wrapper for table interactivity
│       ├── person-dialog.tsx       # Create/edit modal with form + photo upload
│       ├── person-form.tsx         # Shared form fields (name, employee_id, department, card_number)
│       ├── photo-upload.tsx        # Supabase Storage upload with preview + progress
│       └── csv-import-dialog.tsx   # CSV import: parse, validate, batch create, summary
└── lib/
    └── person-schema.ts            # Zod validation schema for person form + CSV rows
```

### Agent Bridge

```
agent/src/
├── isapi/
│   ├── methods.ts                  # ADD: person methods (UserInfo, Record, Modify, Delete, Search, FaceDataRecord)
└── sync/
    └── persons.ts                  # NEW: person sync loop (poll pending_sync + inactive every 15s)
```

---

## 2. Server Actions Design

### File: `src/actions/persons.ts`

All actions use `'use server'` directive. Each action:
1. Creates a Supabase server client
2. Checks user role via `profiles` table (RLS already enforces this, but actions validate explicitly for typed error returns)
3. Performs the database operation
4. Returns a typed `{ success: boolean, data?: T, error?: string }` result

#### `listPersons(options: { page?: number, pageSize?: number, search?: string, statusFilter?: string })`

```
Returns: { success: true, data: { persons: PersonRow[], total: number, page: number, pageSize: number, totalPages: number }, error?: never }
```

- Queries `persons` table with `ilike` search on `name`, `employee_id`, `department`
- Filters by `status` if provided (excludes `inactive` by default unless explicitly requested)
- Orders by `created_at DESC`
- Uses `.range()` for pagination
- Returns count via a separate `.count` query or single query with count header

#### `createPerson(formData: PersonFormData)`

```
Returns: { success: true, data: PersonRow, error?: never } | { success: false, error: string }
```

- Validates input against `personSchema` (Zod)
- Checks `employee_id` uniqueness if provided (query existing active persons)
- Inserts into `persons` with `status: 'pending_sync'`
- If `face_photo_url` is provided, includes it in the insert
- Returns the inserted row via `.select().single()`

#### `updatePerson(id: string, formData: PersonFormData)`

```
Returns: { success: true, data: PersonRow, error?: never } | { success: false, error: string }
```

- Validates input against `personSchema`
- Checks person exists and is not already `inactive`
- If `name` changed → sets `status: 'pending_sync'` (needs re-sync to device)
- Updates all provided fields
- Sets `pending_sync` status triggers agent sync on next cycle
- Returns updated row via `.select().single()`

#### `deletePerson(id: string)`

```
Returns: { success: true, data: { id: string }, error?: never } | { success: false, error: string }
```

- **Soft delete**: sets `status: 'inactive'` instead of hard delete
- Does NOT remove `face_photo_url` from storage (preserved for audit)
- Agent sync loop will remove person from device on next cycle

#### `getPhotoUploadUrl(personId: string, fileName: string)`

```
Returns: { success: true, data: { url: string, fields: FormDataFields }, error?: never }
```

- Generates a signed upload URL via Supabase Storage `createSignedUploadUrl()` or direct client upload
- Returns the path pattern: `face-photos/{personId}/{timestamp}-{random}.{ext}`
- Client uses this to upload directly via Supabase JS client

#### `batchCreatePersons(rows: ValidatedCsvRow[])`

```
Returns: { success: true, data: { created: number, skipped: number, errors: CsvError[] }, error?: never }
```

- Validates all rows against schema
- Checks `employee_id` uniqueness in batch AND against existing database persons
- Inserts valid rows in a single `.insert()` call (array insert)
- Returns summary: count created, count skipped (duplicates), per-row errors

---

## 3. Component Design

### 3.1 PersonsTable (`persons-table.tsx`) — Server Component

- Server Component that calls `listPersons()` with URL search params (`?page=1&search=foo&status=active`)
- Renders `PersonsTableClient` with the fetched data
- Handles initial render for SEO/fast paint

### 3.2 PersonsTableClient (`persons-table-client.tsx`) — Client Component

- Receives persons data + pagination metadata as props
- Manages local state: search input (debounced), status filter, page
- On search/filter/page change → navigates via `router.push()` with new URL params → triggers Server Component re-render
- Action menu per row: Edit, Deactivate (with confirmation dialog)
- Skeleton rows while loading
- Empty state with illustration when no results

### 3.3 PersonDialog (`person-dialog.tsx`) — Client Component

- Base-UI Dialog wrapper (matches existing `@base-ui/react/dialog` pattern)
- State: `open`, `mode` ('create' | 'edit'), `personData` (pre-filled for edit)
- Renders `PersonForm` + `PhotoUpload` inside
- On submit → calls `createPerson()` or `updatePerson()` server action
- Shows toast notification (Sonner) on success/error
- On success → triggers table revalidation via `usePersons` hook or router refresh

### 3.4 PersonForm (`person-form.tsx`) — Client Component

- Controlled form with fields: `name` (required), `employee_id` (optional, unique), `department` (optional), `card_number` (optional)
- Validation via Zod schema (client-side with `zod` or React Hook Form + Zod resolver)
- Displays field-level errors inline
- Submit button disabled while pending

### 3.5 PhotoUpload (`photo-upload.tsx`) — Client Component

- File input accepting `image/jpeg, image/png`
- Client-side validation: max 5MB, image type check
- Preview via `URL.createObjectURL()`
- Upload to Supabase Storage via browser client:
  ```ts
  const { data, error } = await supabase.storage
    .from('face-photos')
    .upload(path, file, { contentType: file.type, upsert: true })
  ```
- Progress bar via `onUploadProgress` or chunked upload
- Returns `face_photo_url` (public URL via `getPublicUrl()`)
- On upload success → updates form state with URL

### 3.6 CSVImportDialog (`csv-import-dialog.tsx`) — Client Component

- File input for `.csv` files
- Parses via `papaparse` (browser):
  ```ts
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => { ... }
  })
  ```
- Validates each row against `csvRowSchema` (Zod)
- Shows preview table with validation status per row (green check / red error)
- Batch submit button → calls `batchCreatePersons()` server action
- Progress bar during batch operation
- Summary modal: X created, Y skipped (duplicates), Z errors

---

## 4. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WEB APPLICATION                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User → PersonsTable (Server) ──listPersons()──→ Supabase → Render      │
│                                                                         │
│  User → [+ New Person] → PersonDialog → PersonForm → PhotoUpload        │
│    └─ upload photo → Supabase Storage → get URL                         │
│    └─ submit → createPerson() → Supabase (status: pending_sync)         │
│    └─ toast success → table revalidates                                 │
│                                                                         │
│  User → [Edit] → PersonDialog (pre-filled) → updatePerson()             │
│    └─ if name changed → status: pending_sync                            │
│    └─ toast success → table revalidates                                 │
│                                                                         │
│  User → [Deactivate] → deletePerson() → status: inactive                │
│    └─ toast success → table revalidates                                 │
│                                                                         │
│  User → [Import CSV] → CSVImportDialog → papaparse → validate           │
│    └─ batchCreatePersons() → Supabase (bulk insert)                     │
│    └─ summary → table revalidates                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENT BRIDGE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Agent → poll persons WHERE status='pending_sync' (every 15s)           │
│    └─ for each person → createPersonOnDevice(ISAPI UserInfo + Record)   │
│    └─ on success → update status: 'active'                              │
│    └─ on failure → log error, retry next cycle                          │
│                                                                         │
│  Agent → poll persons WHERE status='inactive' (every 15s)               │
│    └─ for each person → deletePersonFromDevice(ISAPI Delete)            │
│    └─ on success → log audit, no status change (already inactive)       │
│    └─ on failure → log error, retry next cycle                          │
│                                                                         │
│  Agent → optional: FaceDataRecord upload if face photo URL present      │
│    └─ download photo from Supabase Storage                              │
│    └─ encode as base64 → ISAPI FaceDataRecord PUT                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Storage Design — Supabase Storage

### Bucket: `face-photos`

- **Type**: Public bucket (photos need to be viewable by the web app without signed URLs)
- **RLS Policies**:
  - SELECT: All authenticated users (can view any person's photo)
  - INSERT: Users with role `admin` or `hr_operator` (can upload photos)
  - UPDATE: Same as INSERT (can replace photos)
  - DELETE: Only `admin` (restrictive — photos are audit evidence)

### Path Pattern

```
face-photos/{person-id}/{timestamp}-{random}.{ext}
```

Example: `face-photos/abc123-def456/1713024000000-x7k2m9.jpg`

- `person-id`: UUID from the persons table
- `timestamp`: Date.now() at upload time
- `random`: Short random string to avoid collisions
- `ext`: jpg or png (based on uploaded file type)

### Cleanup Strategy (Future)

- When a person is soft-deleted, photo remains in storage (audit trail)
- Hard cleanup job (manual or scheduled) could archive old photos
- Not in scope for Fase 3

---

## 6. ISAPI Person Methods (Agent)

### File: `agent/src/isapi/methods.ts` — Additions

New ISAPI endpoints and methods for person management:

```
POST   /ISAPI/AccessControl/UserInfo/Record?format=json    → Create person on device
PUT    /ISAPI/AccessControl/UserInfo/Modify/{employeeNo}   → Update person on device
DELETE /ISAPI/AccessControl/UserInfo/Delete/{employeeNo}   → Delete person from device
GET    /ISAPI/AccessControl/UserInfo/Search                 → Search/list persons on device
POST   /ISAPI/Biometric/FaceDataRecord/{employeeNo}         → Upload face data
```

#### `createPersonOnDevice(config, personData)`

- POST to `/ISAPI/AccessControl/UserInfo/Record?format=json`
- Request body (JSON or XML):
  ```json
  {
    "UserInfo": {
      "employeeNo": "0001",
      "name": "John Doe",
      "userType": "normal",
      "doorRight": "1",
      "RightPlan": [{ "doorNo": 1, "planTemplateNo": 1 }]
    }
  }
  ```
- Returns: `{ success: true }` or `{ success: false, error: string }`

#### `updatePersonOnDevice(config, employeeNo, personData)`

- PUT to `/ISAPI/AccessControl/UserInfo/Modify/{employeeNo}`
- Similar body to create, with updated fields only
- Device must already have the person

#### `deletePersonFromDevice(config, employeeNo)`

- DELETE to `/ISAPI/AccessControl/UserInfo/Delete/{employeeNo}`
- Removes person and associated biometric data (face, card) from device

#### `searchPersonsOnDevice(config, options?)`

- POST to `/ISAPI/AccessControl/UserInfo/Search`
- Returns list of persons currently on device
- Used for reconciliation / debug

#### `uploadFaceData(config, employeeNo, imageData)`

- POST to `/ISAPI/Biometric/FaceDataRecord/{employeeNo}`
- `imageData`: Base64-encoded JPEG (device-specific size limits apply)
- Content-Type: `application/octet-stream` or XML wrapper

---

## 7. Agent Person Sync Loop

### File: `agent/src/sync/persons.ts`

```ts
export function startPersonSync(
  config: Config,
  supabase: SupabaseClient
): () => void
```

### Sync Strategy

Two parallel polling loops, both on a 15-second interval:

**Loop 1 — Pending Sync (outbound to device):**
1. Query `persons WHERE status = 'pending_sync' LIMIT 50`
2. For each person:
   a. Call `createPersonOnDevice()` via ISAPI
   b. If person has `face_photo_url`, download photo → encode → `uploadFaceData()`
   c. On success: update `status = 'active'`, set `device_employee_no`
   d. On failure: log error, leave as `pending_sync` (retry next cycle)

**Loop 2 — Inactive Cleanup (remove from device):**
1. Query `persons WHERE status = 'inactive' AND device_employee_no IS NOT NULL LIMIT 50`
2. For each person:
   a. Call `deletePersonFromDevice()` via ISAPI
   b. On success: set `device_employee_no = NULL` (marks as removed from device)
   c. On failure: log error, retry next cycle

### Error Handling

- Each person operation wrapped in `withRetry()` (same utility as event sync)
- Max 3 attempts with exponential backoff
- Errors logged with person ID and employee ID for debugging
- No person blocks the loop — failures are logged, loop continues with next person

### Concurrency

- Process persons sequentially (one at a time) to avoid overwhelming the device
- Device ISAPI has rate limits; sequential processing is safer
- Future optimization: semaphore with max concurrency of 2-3

---

## 8. CSV Validation Design

### Schema: `csvRowSchema` (Zod)

```ts
const csvRowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  employee_id: z.string().optional(),
  department: z.string().optional(),
  card_number: z.string().optional(),
})
```

### Validation Rules

1. **Name is required** — empty or whitespace-only names fail validation
2. **employee_id must be unique** — checked against:
   - Other rows in the same CSV batch (dedup within file)
   - Existing active persons in the database (cross-reference)
3. **Row-level errors** — each row gets a validation result:
   - `{ status: 'valid', data: ValidatedRow }`
   - `{ status: 'error', row: number, errors: string[] }`
4. **Duplicate employee_ids within the file** — first occurrence wins, subsequent rows are marked as errors
5. **Empty rows** — skipped automatically (Papa Parse `skipEmptyLines`)

### CSV Expected Format

The CSV should have headers (case-insensitive):
```
name,employee_id,department,card_number
```

At minimum, `name` is required. Other columns are optional.

---

## 9. Dependencies

### Web Application (new)

```json
{
  "papaparse": "^5.4.1",
  "@types/papaparse": "^5.3.14"
}
```

Already available:
- `@supabase/supabase-js` (includes storage client)
- `zod` (not yet in web deps, needed for validation)
- `@base-ui/react` (dialog, form primitives)
- `sonner` (toast notifications)
- `lucide-react` (icons)

### Agent Bridge (new)

**No new dependencies needed.** All ISAPI methods use existing:
- `digest-fetch` (HTTP client with digest auth)
- `fast-xml-parser` (XML serialization/deserialization)

---

## 10. Architecture Decisions

### Why soft delete instead of hard delete?
- **Audit trail**: Deactivated persons still appear in access event history
- **Recovery**: Accidental deactivations can be undone by restoring status
- **Device sync clarity**: Agent knows the person existed and was intentionally removed (vs. a missing record)

### Why Server Actions instead of API routes?
- **Less boilerplate**: No need for route handlers, middleware, separate validation layer
- **Type safety**: Server actions return typed results directly to client components
- **RLS alignment**: Supabase RLS already enforces access control; server actions add an explicit validation layer on top
- **Next.js convention**: Aligns with App Router patterns, works naturally with React Server Components

### Why Supabase Storage for photos?
- **Integrated with auth**: No separate storage service, same auth context
- **Public bucket support**: Photos viewable without signed URLs (simpler frontend)
- **RLS on storage**: Same policy system as database tables
- **Simplicity**: No S3 bucket config, no CDN setup — just upload and get a URL

### Why polling instead of Supabase Realtime for sync?
- **Simpler architecture**: No WebSocket connections, no subscription management
- **No extra cost**: Realtime requires additional Supabase plan tier
- **Agent controls pacing**: Polling interval is predictable, doesn't spike under load
- **Idempotent operations**: Poll → process → update status is inherently safe and retryable

### Why 15-second sync interval?
- **Freshness balance**: 15s is near-imperceptible to users (person created → appears on device within ~15s)
- **Device load**: Hikvision devices have limited ISAPI throughput; 15s avoids overwhelming
- **Batch efficiency**: Multiple pending persons can be processed in a single cycle
- **Configurable**: Interval lives in `config.pollIntervalMs` — can be tuned per deployment

---

## 11. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Device ISAPI rate limiting during sync | Medium | Sequential processing, 15s interval, retry with backoff |
| Large CSV import (>1000 rows) causes timeout | Medium | Batch insert in chunks of 100, progress feedback |
| Face photo upload fails (size/format mismatch) | Low | Client-side validation (5MB max, JPEG/PNG), error toast |
| Concurrent edits to same person | Low | Optimistic locking via `updated_at` check (future) |
| RLS policy misconfiguration blocks server actions | High | Server client uses service role key or authenticated context — test thoroughly |
| Device unreachable during sync | Medium | Retry logic with exponential backoff, persons stay `pending_sync` |
| `employee_id` collision between CSV and existing DB | Low | Pre-insert uniqueness check, row-level error reporting |

---

## 12. Implementation Phases (for Apply stage)

### Phase 1: Foundation
- [ ] Add `zod` to web dependencies
- [ ] Create `src/lib/person-schema.ts` (Zod schemas)
- [ ] Create `src/types/person.ts` (TS types derived from schema)
- [ ] Create Supabase Storage bucket `face-photos` with RLS policies (migration)

### Phase 2: Server Actions
- [ ] Implement `listPersons()` with pagination
- [ ] Implement `createPerson()` with validation
- [ ] Implement `updatePerson()` with status logic
- [ ] Implement `deletePerson()` (soft delete)
- [ ] Implement `batchCreatePersons()` for CSV import

### Phase 3: UI Components
- [ ] Build `persons-table.tsx` (Server Component)
- [ ] Build `persons-table-client.tsx` (Client wrapper)
- [ ] Build `person-dialog.tsx` (modal)
- [ ] Build `person-form.tsx` (form fields)
- [ ] Build `photo-upload.tsx` (file upload + preview)
- [ ] Build `csv-import-dialog.tsx` (CSV parse + validate)
- [ ] Rebuild `persons/page.tsx` to use PersonsTable

### Phase 4: Agent ISAPI Methods
- [ ] Add `createPersonOnDevice()` to `agent/src/isapi/methods.ts`
- [ ] Add `updatePersonOnDevice()` to methods
- [ ] Add `deletePersonFromDevice()` to methods
- [ ] Add `uploadFaceData()` for face photo sync
- [ ] Add XML serialization helpers if needed

### Phase 5: Agent Sync Loop
- [ ] Create `agent/src/sync/persons.ts` with dual polling loops
- [ ] Integrate into `agent/src/index.ts` startup
- [ ] Test end-to-end: create person → sync to device → verify

### Phase 6: CSV Import Integration
- [ ] Add `papaparse` dependency
- [ ] Implement CSV parsing + validation in dialog
- [ ] Connect to `batchCreatePersons()` server action
- [ ] Test with sample CSV files

---

## Status: ready
## Next Recommended: /sdd-tasks — Convert this design into a task DAG for implementation
## Risks: Medium — ISAPI person endpoints vary by device firmware; may need adaptation after first integration test
