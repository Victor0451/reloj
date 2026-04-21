# Specification: Person Management (Fase 3)

**Change**: person-management  
**Status**: draft  
**Summary**: Complete CRUD for persons with facial photo upload and ISAPI device synchronization.

---

## Domain 1: Person CRUD Server Actions

### 1.1 createPerson

**What**: Server action that inserts a new person into Supabase with status `pending_sync`.

**Authorization**: Only `admin` and `hr_operator` roles MAY create persons.

**Given** an authenticated user with role `admin` or `hr_operator`  
**When** `createPerson({ name, employee_id?, department?, card_number?, face_photo_url? })` is called  
**Then** the system MUST:

1. Validate that `name` is non-empty (trimmed length > 0)
2. If `employee_id` is provided, check it does not already exist among persons with status `active` or `pending_sync`
3. Insert a row into `persons` with:
   - `name` (required, non-empty)
   - `employee_id` (optional, must be unique among active persons)
   - `department` (optional)
   - `card_number` (optional)
   - `face_photo_url` (optional, if provided)
   - `status` = `'pending_sync'`
4. Return `{ success: true, personId: string }` on success
5. Return `{ success: false, error: string }` on validation or database error

**Given** an authenticated user with role `supervisor` or `technician`  
**When** `createPerson` is called  
**Then** the system MUST return `{ success: false, error: 'Unauthorized' }` and MUST NOT insert any row.

**Given** an unauthenticated request  
**When** `createPerson` is called  
**Then** the system MUST return `{ success: false, error: 'Unauthorized' }` and MUST NOT insert any row.

### 1.2 updatePerson

**What**: Server action that updates an existing person's fields.

**Authorization**: Only `admin` and `hr_operator` roles MAY update persons.

**Given** an authenticated user with role `admin` or `hr_operator`  
**When** `updatePerson(id, { name?, employee_id?, department?, card_number?, face_photo_url? })` is called  
**Then** the system MUST:

1. Verify the person with the given `id` exists
2. If `name` is in updates, validate it is non-empty (trimmed length > 0)
3. If `employee_id` is in updates, check uniqueness among persons with status `active` or `pending_sync` (excluding the current person)
4. Update only the provided fields
5. If `name` or `employee_id` changed, set `status` to `'pending_sync'`
6. Return `{ success: true }` on success
7. Return `{ success: false, error: string }` on validation or database error

**Given** the person `status` is `inactive`  
**When** `updatePerson` is called  
**Then** the system MUST return `{ success: false, error: 'Cannot update inactive person' }` and MUST NOT modify any fields.

### 1.3 deletePerson

**What**: Server action that performs a soft delete by setting status to `inactive`.

**Authorization**: Only `admin` and `hr_operator` roles MAY delete persons.

**Given** an authenticated user with role `admin` or `hr_operator`  
**When** `deletePerson(id)` is called  
**Then** the system MUST:

1. Verify the person with the given `id` exists and is not already `inactive`
2. Update `status` to `'inactive'`
3. MUST NOT delete the row from the database (soft delete only)
4. Return `{ success: true }` on success
5. Return `{ success: false, error: string }` if person not found or already inactive

### 1.4 listPersons

**What**: Server action that returns a paginated, searchable list of persons.

**Authorization**: Any authenticated user MAY list persons.

**Given** an authenticated user  
**When** `listPersons({ page?, pageSize?, search?, statusFilter? })` is called  
**Then** the system MUST:

1. Default `page` to 1, `pageSize` to 20
2. If `search` is provided, filter persons where `name` OR `employee_id` contains the search string (case-insensitive, using ILIKE)
3. If `statusFilter` is provided, filter persons where `status` equals the filter value
4. Return `{ persons: PersonRow[], total: number, page: number, pageSize: number, totalPages: number }`
5. Results MUST be ordered by `created_at DESC`

---

## Domain 2: PersonsTable UI

### 2.1 Table Structure

**Given** the Persons page is rendered  
**When** the table component loads  
**Then** the system MUST display columns:

| Column | Content |
|--------|---------|
| Name | Person's name |
| Employee ID | `employee_id` (or `—` if null) |
| Department | `department` (or `—` if null) |
| Status | Badge component showing: `active` (green), `inactive` (gray), `pending_sync` (yellow) |
| Actions | Edit button, Deactivate/Activate toggle button |

### 2.2 Pagination

**Given** there are more than 20 persons  
**When** the table renders  
**Then** the system MUST:

1. Show exactly 20 rows per page by default
2. Display pagination controls (page numbers, previous/next)
3. Allow the user to navigate between pages

### 2.3 Search

**Given** the user types in the search input  
**When** 300ms have passed since the last keystroke (debounce)  
**Then** the system MUST:

1. Filter the table by matching `name` or `employee_id` (case-insensitive)
2. Reset pagination to page 1
3. Show the number of results found

**Given** the search input is cleared  
**When** the debounce fires  
**Then** the system MUST show all persons again with no filter applied.

### 2.4 Status Filter

**Given** a status filter dropdown is rendered  
**When** the user selects a status (`active`, `inactive`, `pending_sync`, or `all`)  
**Then** the system MUST filter the table to show only persons matching that status.

### 2.5 Action Buttons

**Given** a row with status `active` or `pending_sync`  
**When** the user clicks the deactivate button  
**Then** the system MUST call `deletePerson(id)` and refresh the table.

**Given** a row with status `inactive`  
**When** the user clicks the activate button  
**Then** the system MUST call `updatePerson(id, { ... })` restoring status to `active` and refresh the table.

### 2.6 Loading State

**Given** data is being fetched  
**When** the loading state is active  
**Then** the system MUST display skeleton rows (using the `Skeleton` component) matching the table structure.

### 2.7 Empty State

**Given** the persons list returns zero results  
**When** no filter is applied  
**Then** the system MUST render the `EmptyState` component with:

- Icon: `Users`
- Title: "Sin personas registradas"
- Description: "Comienza agregando tu primera persona."

**Given** the persons list returns zero results with an active search or filter  
**When** no results match  
**Then** the system MUST render the `EmptyState` component with:

- Icon: `Search`
- Title: "Sin resultados"
- Description: "No se encontraron personas con los filtros aplicados."

---

## Domain 3: PersonDialog (Create/Edit)

### 3.1 Dialog Trigger

**Given** the user is on the Persons page  
**When** the user clicks "Agregar Persona" or the Edit button on a row  
**Then** the system MUST open a modal dialog (using the `Dialog` component).

### 3.2 Form Fields

**Given** the dialog is open in Create mode  
**When** the form renders  
**Then** the system MUST display:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Name | text input | Yes | Non-empty, min 2 chars |
| Employee ID | text input | No | Unique among active persons |
| Department | text input | No | None |
| Card Number | text input | No | None |

**Given** the dialog is open in Edit mode with an existing person  
**When** the form renders  
**Then** all fields MUST be pre-populated with the person's current values.

### 3.3 Photo Upload Section

**Given** the dialog is open  
**When** the form renders  
**Then** the system MUST display a photo upload section (see Domain 4 for details) with:

- Upload area / button
- Image preview if a photo is uploaded
- Remove button if a photo is present

### 3.4 Submit Behavior

**Given** the form is filled with valid data  
**When** the user clicks "Guardar"  
**Then** the system MUST:

1. In Create mode: call `createPerson(formData)`
2. In Edit mode: call `updatePerson(personId, formData)`
3. On success: close the dialog, refresh the table, show a success toast
4. On error: display validation errors inline next to the affected fields

### 3.5 Validation Errors

**Given** the form has invalid data (e.g., empty name, duplicate employee_id)  
**When** the user attempts to submit  
**Then** the system MUST:

1. Prevent submission
2. Display inline error messages below the affected fields
3. Focus the first invalid field

---

## Domain 4: PhotoUpload

### 4.1 Upload to Supabase Storage

**Given** a photo upload is initiated  
**When** the user selects an image file  
**Then** the system MUST:

1. Upload the file to the Supabase Storage bucket named `face-photos`
2. Use a path format: `face-photos/{personId-or-tempId}/{filename}`
3. Accept only MIME types `image/jpeg` and `image/png`
4. Reject files larger than 5MB (5,242,880 bytes)
5. Show a file type or size error if validation fails

### 4.2 Preview

**Given** a file has been successfully uploaded  
**When** the upload completes  
**Then** the system MUST display a preview of the uploaded image in the dialog.

### 4.3 Remove

**Given** a photo has been uploaded and is displayed  
**When** the user clicks the "Eliminar foto" button  
**Then** the system MUST:

1. Delete the file from Supabase Storage
2. Clear the preview
3. Reset the upload state

### 4.4 Upload Progress

**Given** a file upload is in progress  
**When** the upload is ongoing  
**Then** the system MUST display an upload progress indicator (percentage or progress bar).

---

## Domain 5: CSV Import

### 5.1 File Upload

**Given** the user initiates a CSV import  
**When** the user selects a CSV file  
**Then** the system MUST:

1. Accept only files with `.csv` extension or `text/csv` MIME type
2. Parse the file expecting a header row as the first line
3. Required header columns: `name`, `employee_id` (order-independent by header name)
4. Optional header columns: `department`, `card_number`
5. If the file lacks required headers, show an error: "El CSV debe contener las columnas: name, employee_id"

### 5.2 Validation

**Given** the CSV file is parsed  
**When** each data row is processed  
**Then** the system MUST:

1. Validate that `name` is non-empty; if empty, skip the row and record the error
2. Check `employee_id` uniqueness against existing `active` and `pending_sync` persons; if duplicate, skip the row and record the error
3. Rows that pass validation are queued for bulk creation
4. Row-level errors MUST NOT abort the entire import

### 5.3 Bulk Creation

**Given** a set of validated rows  
**When** the import begins  
**Then** the system MUST:

1. Create persons in batches of 50
2. Set each person's status to `pending_sync`
3. Show a progress bar during batch processing
4. Handle batch errors gracefully (log, skip failed batch, continue)

### 5.4 Summary Report

**Given** the import process completes  
**When** all batches have been processed  
**Then** the system MUST display a summary:

- Created: N persons
- Skipped: M persons (with reasons: empty name, duplicate employee_id)
- Errors: K rows with format or validation issues

---

## Domain 6: Agent ISAPI Person Methods

### 6.1 createPersonOnDevice

**What**: Creates a person record on the Hikvision device via ISAPI.

**Given** a person object with valid data  
**When** `createPersonOnDevice(person)` is called  
**Then** the system MUST:

1. Send a `POST` request to `/ISAPI/AccessControl/UserInfo/Record`
2. Build an XML body containing:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <UserInfo>
     <employeeNo>{person.employee_id or person.device_employee_no}</employeeNo>
     <name>{person.name}</name>
     <userType>normal</userType>
     <departmentName>{person.department || ''}</departmentName>
     <cardNumber>{person.card_number || ''}</cardNumber>
   </UserInfo>
   ```
3. Return the device-assigned `employeeNo` on success
4. Return an error object on failure (with status code and message)

### 6.2 updatePersonOnDevice

**What**: Updates an existing person record on the Hikvision device.

**Given** a person object with an existing `device_employee_no`  
**When** `updatePersonOnDevice(person)` is called  
**Then** the system MUST:

1. Send a `PUT` request to `/ISAPI/AccessControl/UserInfo/Modify`
2. Build an XML body with updated fields matching the createPerson structure
3. Return success on HTTP 200
4. Return an error object on failure

### 6.3 deletePersonFromDevice

**What**: Removes a person record from the Hikvision device.

**Given** a `deviceEmployeeNo` (integer)  
**When** `deletePersonFromDevice(deviceEmployeeNo)` is called  
**Then** the system MUST:

1. Send a `DELETE` request to `/ISAPI/AccessControl/UserInfo/Delete`
2. Build an XML body containing the employee number to delete
3. Return success on HTTP 200
4. Return an error object on failure

### 6.4 searchPersonsOnDevice

**What**: Searches for persons on the Hikvision device.

**Given** an optional search query  
**When** `searchPersonsOnDevice(query?)` is called  
**Then** the system MUST:

1. Send a `POST` request to `/ISAPI/AccessControl/UserInfo/Search`
2. Build an XML search body with the query (if provided) or return all persons
3. Parse the XML response into an array of person objects
4. Return the parsed array on success
5. Return an empty array if no results found

### 6.5 uploadFacePhoto

**What**: Uploads a facial photo to the Hikvision device for a specific person.

**Given** a `deviceEmployeeNo` and photo data (binary or base64)  
**When** `uploadFacePhoto(deviceEmployeeNo, photoData)` is called  
**Then** the system MUST:

1. Send a `POST` request to `/ISAPI/Intelligent/FDLib/FaceDataRecord`
2. Build the XML body with:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <FaceDataRecord>
     <employeeNo>{deviceEmployeeNo}</employeeNo>
     <faceLibType>black</faceLibType>
     <faceDataType>faceJpeg</faceDataType>
     <!-- photo data embedded -->
   </FaceDataRecord>
   ```
3. Return success on HTTP 200
4. Return an error object on failure

---

## Domain 7: Agent Person Sync Loop

### 7.1 Polling

**Given** the agent bridge is running  
**When** the sync loop is active  
**Then** the system MUST:

1. Poll Supabase every 15 seconds for persons with `status = 'pending_sync'`
2. Use the Supabase service role key for authentication (agent-side client)

### 7.2 Sync Pending Persons

**Given** one or more persons have `status = 'pending_sync'`  
**When** a sync cycle runs  
**Then** the system MUST, for each pending person:

1. Call `createPersonOnDevice(person)` on the device
2. If successful, update the person in Supabase:
   - Set `status` to `'active'`
   - Set `device_employee_no` to the value returned by the device
3. If the call fails, log the error and keep the person as `pending_sync` for the next cycle

### 7.3 Sync Inactive Persons

**Given** a person has `status = 'inactive'` and a `device_employee_no` exists  
**When** a sync cycle runs  
**Then** the system MUST:

1. Call `deletePersonFromDevice(deviceEmployeeNo)`
2. On success, clear `device_employee_no` in Supabase (set to null)
3. On failure, log the error and retry in the next cycle

### 7.4 Error Handling

**Given** an error occurs during device communication  
**When** the sync loop processes a person  
**Then** the system MUST:

1. Log the error with person details and error message
2. Apply exponential backoff with jitter for retries (using existing `withRetry` utility)
3. NOT crash or terminate the process
4. Continue processing remaining persons in the queue

**Given** the device returns HTTP 404 for a `device_employee_no`  
**When** the sync loop encounters this  
**Then** the system MUST:

1. Mark the person as `inactive` in Supabase
2. Log a warning that the device no longer has this person

---

## Domain 8: CSV Validation

### 8.1 Name Validation

**Given** a CSV row is being validated  
**When** the `name` field is checked  
**Then** the system MUST:

1. Reject rows where `name` is empty, null, or whitespace-only
2. Record the error: "Row {n}: name is required"

### 8.2 Employee ID Uniqueness

**Given** a CSV row is being validated  
**When** the `employee_id` field is checked  
**Then** the system MUST:

1. Query existing persons with status `active` or `pending_sync` for a matching `employee_id`
2. If a match exists, skip the row and record the error: "Row {n}: employee_id '{value}' already exists"
3. If the same CSV file contains duplicate `employee_id` values, only the first occurrence is accepted; subsequent duplicates are skipped

### 8.3 Optional Fields

**Given** a CSV row is being validated  
**When** the `department` or `card_number` fields are checked  
**Then** the system MUST:

1. Accept null or empty values (no validation error)
2. Store as null if empty

### 8.4 Row-Level Error Reporting

**Given** multiple rows have validation errors  
**When** the import completes  
**Then** the system MUST:

1. Continue processing all valid rows
2. Collect all row-level errors
3. Include the error details in the final summary report
4. NOT fail the entire import due to individual row errors
