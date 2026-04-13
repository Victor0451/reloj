# Fase 3: Gestión de Personas — Technical Design

## Executive Summary

Complete CRUD for persons with facial photo upload and ISAPI device synchronization. The implementation spans two domains: the **Web Application** (Next.js Server Actions + UI components) and the **Agent Bridge** (ISAPI person methods + sync loop). This design defines exact file structures, data flows, type contracts, and architecture decisions.

---

## 1. Module Architecture — File Structure

### Web Application

```
src/
├── actions/
│   └── persons.ts                          # Server Actions (CRUD + CSV)
├── app/(dashboard)/dashboard/persons/
│   └── page.tsx                            # Rebuild from stub → PersonsTable
├── components/
│   └── persons/
│       ├── persons-table.tsx               # Paginated table with search/filters
│       ├── persons-table-client.tsx        # Client wrapper for interactivity
│       ├── person-dialog.tsx               # Create/edit modal
│       ├── person-form.tsx                 # Shared form fields
│       ├── photo-upload.tsx                # Supabase Storage upload
│       └── csv-import-dialog.tsx           # CSV import modal + progress
├── hooks/
│   └── use-persons.ts                      # Data fetching + mutation hooks
├── lib/
│   └── csv-validation.ts                   # CSV parse + validate schema
└── types/
    └── person.types.ts                     # Extended person types (form, CSV)
```

### Agent Bridge

```
agent/src/
├── isapi/
│   ├── methods.ts                          # ADD person methods to existing file
│   └── person-methods.ts                   # NEW: UserInfo/Record/Modify/Delete/Search, FaceDataRecord
└── sync/
    └── persons.ts                          # NEW: Person sync loop module
```

**Rationale for splitting `person-methods.ts`**: The existing `methods.ts` is already ~200 lines with device-specific ISAPI calls. Person management methods are a separate concern with different XML structures. A dedicated file keeps `methods.ts` focused on device operations and makes `person-methods.ts` independently testable.

---

## 2. Database & Storage Design

### 2.1 Existing `persons` Table (no schema changes needed)

```sql
-- Already exists from Fase 1
-- Columns: id, employee_id, name, department, card_number, face_photo_url,
--           device_employee_no, status, created_at, updated_at
-- Status enum: 'active' | 'inactive' | 'pending_sync'
-- RLS: SELECT (all authenticated), ALL (admin, hr_operator)
```

### 2.2 Supabase Storage Bucket: `face-photos`

**Bucket configuration:**
- Name: `face-photos`
- Public: `false` (signed URLs only)
- File size limit: 5MB (enforced at upload)
- Allowed MIME types: `image/jpeg`, `image/png`

**Path pattern:**
```
face-photos/{person-id}/{timestamp}-{random}.{ext}
```

**Storage RLS policies** (to be created):
```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload face photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'face-photos' AND auth.role() = 'authenticated');

-- Authenticated users can read
CREATE POLICY "Authenticated users can read face photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'face-photos' AND auth.role() = 'authenticated');

-- Only admins can delete
CREATE POLICY "Admins can delete face photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'face-photos'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 2.3 Photo URL Management

- **On upload**: Server action generates the path, uploads via Supabase Storage SDK, stores the full URL in `face_photo_url`.
- **On display**: Use signed URLs with 1-hour expiry. Client component calls `createClient().storage.from('face-photos').createSignedUrl(path, 3600)`.
- **On delete person**: Soft delete keeps photo. Hard cleanup (optional future task) would delete the file from storage.

---

## 3. Server Actions Design

### File: `src/actions/persons.ts`

All actions use `'use server'` directive. Each action:
1. Creates Supabase server client
2. Validates user role via `profiles` table
3. Executes typed query
4. Returns `{ success: boolean, data?: T, error?: string }` envelope

#### 3.1 `createPerson`

```typescript
interface CreatePersonInput {
  name: string              // required, min 2 chars, max 200
  employee_id?: string      // optional, unique if provided, max 50 chars
  department?: string       // optional, max 100 chars
  card_number?: string      // optional, max 50 chars
  face_photo_url?: string   // optional, set by photo-upload after upload
}

interface ActionResult<T> {
  success: boolean
  data?: T
  error?: string
  fieldErrors?: Record<string, string>  // per-field validation errors
}

async function createPerson(input: CreatePersonInput): Promise<ActionResult<PersonsInsert>>
```

**Flow:**
1. Validate input (name required, length checks)
2. Check `employee_id` uniqueness if provided
3. Insert into `persons` with `status: 'pending_sync'`
4. Return inserted row or error

#### 3.2 `updatePerson`

```typescript
async function updatePerson(
  id: string,
  input: Partial<CreatePersonInput>
): Promise<ActionResult<PersonsRow>>
```

**Flow:**
1. Validate `id` exists
2. Check role (admin or hr_operator)
3. If `name` changed → set `status: 'pending_sync'` (triggers re-sync to device)
4. If `face_photo_url` changed to new value → old photo is NOT deleted (orphan cleanup later)
5. Update and return row

#### 3.3 `deletePerson` (soft delete)

```typescript
async function deletePerson(id: string): Promise<ActionResult<void>>
```

**Flow:**
1. Validate `id` exists and is not already `inactive`
2. Set `status: 'inactive'`
3. Does NOT delete photo from storage (preserves audit trail)
4. Device sync loop will handle removal from device

#### 3.4 `listPersons`

```typescript
interface ListPersonsOptions {
  page: number              // 1-indexed
  pageSize?: number         // default 20, max 100
  search?: string           // fuzzy match on name, employee_id, department
  statusFilter?: PersonStatus | 'all'  // default 'all'
  sortBy?: 'name' | 'created_at' | 'updated_at'
  sortOrder?: 'asc' | 'desc'
}

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

async function listPersons(options: ListPersonsOptions): Promise<PaginatedResult<PersonsRow>>
```

**Query pattern:**
```typescript
let query = supabase
  .from('persons')
  .select('*', { count: 'exact' })

if (search) {
  query = query.or(`name.ilike.%${search}%,employee_id.ilike.%${search}%,department.ilike.%${search}%`)
}
if (statusFilter && statusFilter !== 'all') {
  query = query.eq('status', statusFilter)
}

const { data, count, error } = await query
  .order(sortBy, { ascending: sortOrder === 'asc' })
  .range((page - 1) * pageSize, page * pageSize - 1)
```

#### 3.5 `uploadPhoto` (Server Action for signed URL generation)

```typescript
async function getPhotoSignedUrl(path: string): Promise<ActionResult<{ url: string }>>
```

Client-side upload uses browser client directly (no server action needed for upload). This action generates signed URLs for display.

#### 3.6 `batchCreatePersons` (CSV import)

```typescript
interface CsvRow {
  name: string
  employee_id?: string
  department?: string
  card_number?: string
}

interface BatchResult {
  total: number
  created: number
  failed: number
  errors: { row: number; error: string; row: CsvRow }[]
}

async function batchCreatePersons(rows: CsvRow[]): Promise<ActionResult<BatchResult>>
```

**Flow:**
1. Validate all rows (name required, employee_id unique check against DB)
2. Insert valid rows in batch (Supabase `.insert()` accepts array)
3. Track per-row errors (row-level: name missing, duplicate employee_id)
4. Return summary with error details

---

## 4. Component Design

### 4.1 `persons-table.tsx` — Server Component

```tsx
// Server Component — fetches data, renders client wrapper
export default async function PersonsTable({
  searchParams: { page, search, status }
}: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const result = await listPersons({
    page: Number(params.page) || 1,
    search: params.search,
    statusFilter: (params.status as PersonStatus | 'all') || 'all',
  })

  return <PersonsTableClient initialData={result} initialParams={params} />
}
```

**Why split**: The table data fetch is a server-side operation. Pagination, search, and filter state lives in URL search params. The client wrapper handles interactive features (dialog open/close, optimistic updates, revalidation).

### 4.2 `persons-table-client.tsx` — Client Component

```tsx
'use client'

interface Props {
  initialData: PaginatedResult<PersonsRow>
  initialParams: Record<string, string>
}

export function PersonsTableClient({ initialData, initialParams }: Props) {
  // State: data, loading, search, filters, selected rows
  // URL sync: use useRouter() + useSearchParams() for pagination
  // Actions: create, edit, delete, CSV import
  // Renders: search input, filter dropdown, table, pagination controls
}
```

**Features:**
- Search input with debounced URL update (500ms)
- Status filter dropdown (All, Active, Inactive, Pending Sync)
- Sortable columns (name, created_at, updated_at)
- Action menu per row (Edit, Deactivate, Reactivate)
- Skeleton loading state (re-use `<Skeleton>` from ui)
- Empty state (re-use `<EmptyState>` from ui)

### 4.3 `person-dialog.tsx` — Client Component

```tsx
'use client'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: PersonsRow  // undefined = create mode, defined = edit mode
  onSuccess: () => void  // refresh table
}

export function PersonDialog({ open, onOpenChange, person, onSuccess }: Props) {
  const isEdit = !!person
  const action = isEdit ? updatePerson.bind(null, person.id) : createPerson

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Persona' : 'Nueva Persona'}</DialogTitle>
        </DialogHeader>
        <PersonForm
          defaultValues={person}
          action={action}
          onSuccess={onSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
```

### 4.4 `person-form.tsx` — Client Component (shared)

```tsx
'use client'

interface Props {
  defaultValues?: PersonsRow
  action: (formData: FormData) => Promise<ActionResult<unknown>>
  onSuccess: () => void
  onCancel: () => void
}

export function PersonForm({ defaultValues, action, onSuccess, onCancel }: Props) {
  // Fields:
  // - name (required, text input)
  // - employee_id (optional, text input)
  // - department (optional, text input)
  // - card_number (optional, text input)
  // - face_photo_url (managed by PhotoUpload child)

  // Submission: use `useFormState` or direct FormData submission
  // On success: close dialog, call onSuccess (table refresh)
  // On error: show field-level errors
}
```

**Why not react-hook-form**: The form has only 4 fields + photo. FormData + server actions is simpler, avoids extra dependency, and aligns with the existing `auth.ts` pattern. If form complexity grows (conditional fields, complex validation), migrate to react-hook-form later.

### 4.5 `photo-upload.tsx` — Client Component

```tsx
'use client'

interface Props {
  personId: string          // for path construction
  onPhotoUploaded: (url: string) => void  // callback with final URL
  currentPhotoUrl?: string  // for edit mode preview
}

export function PhotoUpload({ personId, onPhotoUploaded, currentPhotoUrl }: Props) {
  // State: preview, uploading, progress, error
  // Upload flow:
  // 1. User selects file → validate (type, size)
  // 2. Generate preview (URL.createObjectURL)
  // 3. Upload to Supabase Storage: storage.from('face-photos').upload(path, file)
  // 4. Get public/signed URL → call onPhotoUploaded(url)
}
```

**Upload path:**
```
face-photos/{personId}/{Date.now()}-{crypto.randomUUID().slice(0,8)}.{ext}
```

**Validation:**
- File type: `image/jpeg`, `image/png` only
- File size: max 5MB
- Dimension check: recommend max 800x800 (resize client-side if larger)

### 4.6 `csv-import-dialog.tsx` — Client Component

```tsx
'use client'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void  // refresh table
}

export function CsvImportDialog({ open, onOpenChange, onSuccess }: Props) {
  // State: file, parsed rows, validation errors, upload progress, batch result
  // Flow:
  // 1. File input → read as text
  // 2. Parse with Papa Parse (or lightweight custom parser)
  // 3. Validate rows (name required, employee_id unique)
  // 4. Show preview table with errors highlighted
  // 5. Submit → batchCreatePersons()
  // 6. Show summary (created/failed)
}
```

**CSV expected columns:**
```csv
name,employee_id,department,card_number
```

- `name` is required (row fails if missing)
- Other columns optional
- Header row is flexible: matches by name (case-insensitive) or position

---

## 5. Agent Bridge — ISAPI Person Methods

### File: `agent/src/isapi/person-methods.ts`

```typescript
import type { Config } from "../config";
import { isapiRequest } from "./client";
import { parseXml, buildXml } from "./xml";

// ─── Types ───────────────────────────────────────────────────────────────

export interface PersonRecord {
  employeeNo: string;         // employee ID on device
  name: string;
  userType: 'normal' | 'disabled' | 'blacklist' | 'patrol';
  departmentNo?: string;
  gender?: 'male' | 'female' | 'unknown';
  cardNo?: string;
}

export interface FaceDataRecord {
  employeeNo: string;
  faceId: string;             // unique identifier for this face template
  faceUrl?: string;           // URL to the face image on device
  faceData?: string;          // base64 encoded face template (if available)
}

// ─── ISAPI Endpoints ─────────────────────────────────────────────────────

const PERSON_ENDPOINTS = {
  userInfo: "/ISAPI/AccessControl/UserInfo",        // GET, POST, PUT, DELETE
  userRecord: "/ISAPI/AccessControl/UserRecord",     // POST (search)
  userModify: "/ISAPI/AccessControl/UserModify",     // POST
  userDelete: "/ISAPI/AccessControl/UserDelete",     // POST
  faceDataRecord: "/ISAPI/Intelligent/FaceDataRecord", // POST
} as const;

// ─── Methods ─────────────────────────────────────────────────────────────

/**
 * Create a new person on the device.
 * Sends XML with person info (name, employeeNo, userType, etc.)
 */
export async function createPersonOnDevice(
  config: Config,
  person: PersonRecord
): Promise<{ success: boolean; statusCode: string }> {
  const xmlBody = buildXml({
    UserInfo: {
      employeeNo: person.employeeNo,
      name: person.name,
      userType: person.userType,
      ...(person.departmentNo && { departmentNo: person.departmentNo }),
      ...(person.gender && { gender: person.gender }),
      ...(person.cardNo && { cardNo: person.cardNo }),
    },
  });

  const response = await isapiRequest<Record<string, unknown>>(
    config,
    ENDPOINTS.userInfo,
    "POST",
    xmlBody
  );

  const parsed = parseXml(response.rawXml ?? "");
  const status = parsed.responseStatus?.statusCode as string ?? "unknown";

  return { success: status === "OK", statusCode: status };
}

/**
 * Update an existing person on the device.
 * Uses UserModify endpoint with the same XML structure as create.
 */
export async function updatePersonOnDevice(
  config: Config,
  person: PersonRecord
): Promise<{ success: boolean; statusCode: string }> {
  const xmlBody = buildXml({
    UserInfo: {
      employeeNo: person.employeeNo,
      name: person.name,
      userType: person.userType,
      ...(person.departmentNo && { departmentNo: person.departmentNo }),
      ...(person.gender && { gender: person.gender }),
      ...(person.cardNo && { cardNo: person.cardNo }),
    },
  });

  const response = await isapiRequest<Record<string, unknown>>(
    config,
    ENDPOINTS.userModify,
    "POST",
    xmlBody
  );

  const parsed = parseXml(response.rawXml ?? "");
  const status = parsed.responseStatus?.statusCode as string ?? "unknown";

  return { success: status === "OK", statusCode: status };
}

/**
 * Delete a person from the device.
 * Requires an XML body with UserInfo/list condition.
 */
export async function deletePersonFromDevice(
  config: Config,
  employeeNo: string
): Promise<{ success: boolean; statusCode: string }> {
  const xmlBody = buildXml({
    UserInfo: {
      employeeNo,
    },
  });

  const response = await isapiRequest<Record<string, unknown>>(
    config,
    ENDPOINTS.userDelete,
    "POST",
    xmlBody
  );

  const parsed = parseXml(response.rawXml ?? "");
  const status = parsed.responseStatus?.statusCode as string ?? "unknown";

  return { success: status === "OK", statusCode: status };
}

/**
 * Search for a person on the device.
 * Returns the person record if found, null otherwise.
 */
export async function searchPersonOnDevice(
  config: Config,
  employeeNo: string
): Promise<PersonRecord | null> {
  const xmlBody = buildXml({
    searchID: "1",
    searchResultPosition: 0,
    maxResults: 1,
    UserInfo: {
      employeeNo,
    },
  });

  const response = await isapiRequest<Record<string, unknown>>(
    config,
    ENDPOINTS.userRecord,
    "POST",
    xmlBody
  );

  const parsed = parseXml(response.rawXml ?? "");
  // Parse response — structure varies by firmware
  const matchList = parsed.searchResult?.matchList?.matchItem;
  if (!matchList) return null;

  const item = Array.isArray(matchList) ? matchList[0] : matchList;
  return {
    employeeNo: String(item.employeeNo ?? employeeNo),
    name: String(item.name ?? ""),
    userType: (String(item.userType ?? "normal") as PersonRecord["userType"]),
    departmentNo: item.departmentNo ? String(item.departmentNo) : undefined,
    cardNo: item.cardNo ? String(item.cardNo) : undefined,
  };
}

/**
 * Upload face data for a person.
 * Sends face image (base64 or URL) linked to employeeNo.
 */
export async function uploadFaceData(
  config: Config,
  employeeNo: string,
  faceImageBase64: string
): Promise<{ success: boolean; statusCode: string; faceId?: string }> {
  const xmlBody = buildXml({
    FaceDataRecord: {
      employeeNo,
      faceDataType: "template",  // or "image" depending on device capability
      faceData: faceImageBase64,
    },
  });

  const response = await isapiRequest<Record<string, unknown>>(
    config,
    ENDPOINTS.faceDataRecord,
    "POST",
    xmlBody
  );

  const parsed = parseXml(response.rawXml ?? "");
  const status = parsed.responseStatus?.statusCode as string ?? "unknown";
  const faceId = parsed.FaceDataRecord?.faceId as string | undefined;

  return { success: status === "OK", statusCode: status, faceId };
}
```

**Note on XML building**: The existing `xml.ts` has `parseXml` and `buildXml` (or equivalent). If `buildXml` does not exist, we need to add it. Hikvision ISAPI requires specific XML structures. The `buildXml` helper should produce:

```xml
<?xml version="1.0" encoding="utf-8"?>
<UserInfo>
  <employeeNo>EMP001</employeeNo>
  <name>John Doe</name>
  <userType>normal</userType>
</UserInfo>
```

---

## 6. Agent Bridge — Person Sync Loop

### File: `agent/src/sync/persons.ts`

```typescript
import type { Config } from "../config";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPersonOnDevice,
  updatePersonOnDevice,
  deletePersonFromDevice,
  uploadFaceData,
} from "../isapi/person-methods";
import * as log from "../utils/logger";
import { withRetry } from "../utils/backoff";

export function startPersonSync(
  config: Config,
  supabase: SupabaseClient,
  deviceSerial: string
): () => void {
  let isRunning = true;

  async function syncPendingPersons() {
    if (!isRunning) return;

    try {
      await withRetry(
        async () => {
          // 1. Fetch persons with status = 'pending_sync'
          const { data: pendingPersons, error: fetchError } = await supabase
            .from("persons")
            .select("*")
            .eq("status", "pending_sync")
            .limit(50);

          if (fetchError) {
            log.error("personSync", `Failed to fetch pending persons: ${fetchError.message}`);
            return;
          }

          if (!pendingPersons || pendingPersons.length === 0) {
            log.debug("personSync", "No pending persons to sync");
            return;
          }

          log.info("personSync", `Syncing ${pendingPersons.length} pending person(s)`);

          for (const person of pendingPersons) {
            await syncPersonToDevice(supabase, person);
          }
        },
        { maxAttempts: 2, onRetry: (attempt, delay) => {
          log.warn("personSync", `Retry ${attempt} in ${Math.round(delay)}ms`);
        }}
      );
    } catch (err) {
      log.error("personSync", "Person sync failed", {
        err: err instanceof Error ? err : undefined,
      });
    }
  }

  async function syncInactivePersons() {
    if (!isRunning) return;

    try {
      // 2. Fetch persons with status = 'inactive' that haven't been cleaned up
      // (we track this via a device_synced flag or similar — see schema note below)
      const { data: inactivePersons } = await supabase
        .from("persons")
        .select("*")
        .eq("status", "inactive")
        .is("device_employee_no", null)  // not yet synced to device
        .limit(50);

      if (!inactivePersons || inactivePersons.length === 0) return;

      log.info("personSync", `Removing ${inactivePersons.length} inactive person(s) from device`);

      for (const person of inactivePersons) {
        // If person was never synced, skip
        if (!person.device_employee_no) continue;

        const result = await deletePersonFromDevice(config, String(person.device_employee_no));
        if (result.success) {
          log.info("personSync", `Removed person ${person.name} from device`);
        } else {
          log.error("personSync", `Failed to remove person ${person.name}: ${result.statusCode}`);
        }
      }
    } catch (err) {
      log.error("personSync", "Inactive person cleanup failed", {
        err: err instanceof Error ? err : undefined,
      });
    }
  }

  async function syncPersonToDevice(supabase: SupabaseClient, person: Record<string, unknown>) {
    const personRecord = {
      employeeNo: String(person.employee_id ?? person.id.slice(0, 8)),
      name: String(person.name),
      userType: "normal" as const,
      departmentNo: person.department ? String(person.department) : undefined,
      cardNo: person.card_number ? String(person.card_number) : undefined,
    };

    // Create or update on device
    const existing = await searchPersonOnDevice(config, personRecord.employeeNo);
    const result = existing
      ? await updatePersonOnDevice(config, personRecord)
      : await createPersonOnDevice(config, personRecord);

    if (result.success) {
      // If person has a face photo, upload face data
      if (person.face_photo_url) {
        try {
          // Download photo from Supabase, convert to base64
          const { data: photoData } = await supabase.storage
            .from("face-photos")
            .download(extractPathFromUrl(person.face_photo_url as string));

          if (photoData) {
            const base64 = await blobToBase64(photoData);
            await uploadFaceData(config, personRecord.employeeNo, base64);
          }
        } catch (err) {
          log.warn("personSync", `Failed to upload face for ${person.name}`, { err });
        }
      }

      // Update person status to 'active' and set device_employee_no
      await supabase
        .from("persons")
        .update({
          status: "active",
          device_employee_no: parseInt(personRecord.employeeNo, 10),
          updated_at: new Date().toISOString(),
        })
        .eq("id", person.id);

      log.info("personSync", `Synced person ${person.name} to device`);
    } else {
      log.error("personSync", `Failed to sync person ${person.name}: ${result.statusCode}`);
    }
  }

  // Start intervals
  const pendingInterval = setInterval(syncPendingPersons, config.pollIntervalMs);
  const inactiveInterval = setInterval(syncInactivePersons, config.pollIntervalMs * 2); // less frequent

  // Initial runs
  syncPendingPersons();
  syncInactivePersons();

  return () => {
    isRunning = false;
    clearInterval(pendingInterval);
    clearInterval(inactiveInterval);
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function extractPathFromUrl(url: string): string {
  // URL format: https://<project>.supabase.co/storage/v1/object/face-photos/<path>
  // Extract: <path>
  const match = url.match(/face-photos\/(.+)$/);
  return match ? match[1] : url;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1]); // strip data URI prefix
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

**Sync interval rationale:**
- `pollIntervalMs` (default 15000ms = 15s) for pending persons — balances freshness with device load
- `pollIntervalMs * 2` (30s) for inactive cleanup — less urgent, reduces unnecessary device calls
- Batch size of 50 per run — prevents overwhelming the device if many persons were created offline

---

## 7. Agent Integration

### Update: `agent/src/index.ts`

Add to the startup sequence (after existing modules):

```typescript
import { startPersonSync } from "./sync/persons";

// In main():
const stopPersonSync = startPersonSync(config, supabase, deviceSerial);
registerCleanup(stopPersonSync);
```

---

## 8. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WEB APPLICATION                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  User ──► PersonsTable (Server) ──► listPersons() ──► Supabase      │
│                    │                                                      │
│                    ▼                                                      │
│         PersonsTableClient (interactive)                                 │
│                    │                                                      │
│    ┌───────────────┼───────────────┬──────────────┐                      │
│    ▼               ▼               ▼              ▼                      │
│  [+New]         [Edit]        [Deactivate]    [Import CSV]               │
│    │               │               │              │                      │
│    ▼               ▼               ▼              ▼                      │
│  PersonDialog  PersonDialog   deletePerson()  CsvImportDialog            │
│  + PersonForm  + PersonForm                     │                        │
│  + PhotoUpload   │                              ▼                        │
│                  │                         batchCreatePersons()           │
│                  ▼                                                      │
│           updatePerson()                                                │
│                  │                                                      │
│                  ▼                                                      │
│           Supabase ◄───────────────────────────────────────────────────┤
│                  │                                                      │
└──────────────────┼──────────────────────────────────────────────────────┘
                   │
                   │ (status changes: pending_sync, inactive)
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENT BRIDGE                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Person Sync Loop (every 15s)                                         │
│    │                                                                  │
│    ├──► SELECT * FROM persons WHERE status='pending_sync'             │
│    │         │                                                        │
│    │         ▼                                                        │
│    │    createPersonOnDevice(ISAPI) or updatePersonOnDevice(ISAPI)    │
│    │         │                                                        │
│    │         ├──► uploadFaceData(ISAPI) if face_photo_url exists      │
│    │         │                                                        │
│    │         ▼                                                        │
│    │    UPDATE persons SET status='active', device_employee_no=N      │
│    │                                                                  │
│    └──► SELECT * FROM persons WHERE status='inactive'                  │
│              │                                                        │
│              ▼                                                        │
│         deletePersonFromDevice(ISAPI)                                 │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Dependencies

### Web Application (new)

| Package | Version | Purpose |
|---------|---------|---------|
| `papaparse` | `^5.4.1` | CSV parsing (browser) |
| `@types/papaparse` | `^5.3.14` | TypeScript types |

**Install command:**
```bash
npm install papaparse && npm install -D @types/papaparse
```

### Agent Bridge (no new deps)

All needed packages already exist:
- `@supabase/supabase-js` — Supabase client (service role)
- `fast-xml-parser` — XML parsing for ISAPI responses
- `digest-fetch` — HTTP with digest auth for ISAPI

---

## 10. Architecture Decisions

### 10.1 Soft Delete Instead of Hard Delete

**Decision:** `deletePerson` sets `status: 'inactive'` instead of deleting the row.

**Why:**
- **Audit trail**: Access events reference `person_id` via FK. Hard delete would orphan events or require `ON DELETE SET NULL` (already set). Soft delete preserves the full history.
- **Recovery**: HR operators can reactivate a person accidentally deleted.
- **Device sync**: The agent needs to know which persons to remove from the device. A soft-deleted row with `status='inactive'` is the signal.
- **Photo preservation**: Face photos are retained for audit purposes.

### 10.2 Server Actions Instead of API Routes

**Decision:** All CRUD operations use `'use server'` functions, not REST API routes.

**Why:**
- **Less boilerplate**: No route handlers, no request/response parsing, no Zod schema for both client and server.
- **Type safety**: Server actions return typed results directly. No serialization/deserialization boundary.
- **RLS integration**: Server actions run with the user's session cookie automatically, so Supabase RLS policies apply.
- **Consistency**: The existing `auth.ts` already uses server actions — follow the established pattern.

### 10.3 Supabase Storage for Photos

**Decision:** Store face photos in Supabase Storage bucket `face-photos`, not S3 or local filesystem.

**Why:**
- **Integrated with auth**: Same authentication system, same RLS policies.
- **No additional infrastructure**: One service instead of two (no S3 bucket to manage).
- **Signed URLs**: Easy to generate time-limited access URLs for display.
- **Simplicity**: The agent bridge can download photos via the