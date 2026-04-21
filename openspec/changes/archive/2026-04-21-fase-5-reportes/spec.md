# Delta for fase-5-reportes

## ADDED Requirements

### Requirement: Attendance Summary Report (`attendance-summary`)

The system SHALL provide an attendance summary report that returns daily attendance records per employee for a given date range.

**Server Action**: `getAttendanceSummary(dateFrom: Date, dateTo: Date, employeeId?: string)`

**Response shape**:
```typescript
{
  date: string;          // ISO date YYYY-MM-DD
  employee_id: string;
  person_name: string;
  first_checkin: string; // HH:mm or null
  last_checkout: string; // HH:mm or null
  total_hours: number;   // decimal hours, 2 decimals
  status: 'complete' | 'incomplete';
}
```

**Business rules**:
- Group events by employee_id AND date (date derived from event timestamp, not server time)
- `first_checkin` = MIN(timestamp) for the employee+date where direction = 'in'
- `last_checkout` = MAX(timestamp) for the employee+date where direction = 'out'
- `total_hours` = difference between last_checkout and first_checkin in hours
- If `last_checkout` is null (no 'out' event after last 'in'), status = 'incomplete'
- If employeeId is provided, filter to that employee only

#### Scenario: Date range with no events

- GIVEN no attendance events exist between 2024-01-01 and 2024-01-07
- WHEN `getAttendanceSummary('2024-01-01', '2024-01-07')` is called
- THEN returns empty array `[]`

#### Scenario: Single employee with multiple events in one day

- GIVEN employee "Juan Pérez" (id: emp-001) has events: in at 08:00, out at 12:00, in at 13:00, out at 17:00 on 2024-01-15
- WHEN `getAttendanceSummary('2024-01-15', '2024-01-15', 'emp-001')` is called
- THEN returns one record with first_checkin='08:00', last_checkout='17:00', total_hours=9.00

#### Scenario: Employee with missing checkout

- GIVEN employee "Ana García" (id: emp-002) has only an 'in' event at 09:00 on 2024-01-16 with no subsequent 'out'
- WHEN `getAttendanceSummary('2024-01-16', '2024-01-16', 'emp-002')` is called
- THEN returns record with first_checkin='09:00', last_checkout=null, total_hours=null, status='incomplete'

#### Scenario: Employee working across midnight

- GIVEN employee "Carlos López" (id: emp-003) has 'in' at 23:00 on 2024-01-15 and 'out' at 07:00 on 2024-01-16
- WHEN `getAttendanceSummary('2024-01-15', '2024-01-16', 'emp-003')` is called
- THEN returns TWO records: one for 2024-01-15 with first_checkin='23:00', last_checkout=null, status='incomplete'; one for 2024-01-16 with first_checkin='07:00', last_checkout=null, status='incomplete' (cross-midnight shifts split by calendar date)

#### Scenario: Date range spanning month boundaries

- GIVEN events exist from 2024-01-28 to 2024-02-02
- WHEN `getAttendanceSummary('2024-01-28', '2024-02-02')` is called
- THEN returns records grouped correctly by calendar date, with each month/day combination as a separate row

---

### Requirement: Excel Export (`export-excel`)

The system SHALL export attendance report data to a valid `.xlsx` file.

**Server Action**: `exportAttendanceExcel(dateFrom: Date, dateTo: Date, employeeId?: string): Promise<Blob>`

**Library**: `xlsx` (npm)

**Sheet configuration**:
- Sheet name: "Resumen de Asistencia"
- No merged cells
- Header row frozen

**Columns**:
| Header | Width | Alignment |
|--------|-------|-----------|
| Fecha | 12 | left |
| ID Empleado | 14 | left |
| Nombre | 24 | left |
| Primer Check-in | 16 | center |
| Último Check-out | 16 | center |
| Horas Totales | 14 | right |

**Cell types**: Date as ISO string, numeric hours with 2 decimal places.

#### Scenario: Export with data

- GIVEN attendance summary returns 5 records for the selected date range
- WHEN `exportAttendanceExcel('2024-01-15', '2024-01-16')` is called
- THEN returns a Blob with MIME type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- AND the file opens correctly in Excel/Google Sheets with correct data

#### Scenario: Export with no data

- GIVEN no attendance events exist for the date range
- WHEN `exportAttendanceExcel('2024-01-01', '2024-01-07')` is called
- THEN returns Blob with empty sheet (headers only)
- AND file has correct header row with all column names

#### Scenario: Large date range

- GIVEN date range spans 90 days with 50 employees
- WHEN `exportAttendanceExcel('2024-01-01', '2024-03-31')` is called
- THEN server action completes within 30 seconds
- AND Blob is returned with all matching records

---

### Requirement: PDF Export (`export-pdf`)

The system SHALL export attendance report data to a valid `.pdf` file.

**Server Action**: `exportAttendancePDF(dateFrom: Date, dateTo: Date, employeeId?: string): Promise<Blob>`

**Library**: `@react-pdf/renderer` (npm)

**PDF layout**:
- Page size: A4
- Header: "Reporte de Asistencia" + date range + generation timestamp
- Table: same columns as Excel export
- Page footer: page number (Page X of Y)
- Font: Helvetica (built-in, no external fonts)

**Pagination**: When table exceeds page height, split to next page with header repeated.

#### Scenario: PDF with data

- GIVEN attendance summary returns 20 records
- WHEN `exportAttendancePDF('2024-01-15', '2024-01-31')` is called
- THEN returns Blob with MIME type `application/pdf`
- AND PDF opens correctly in browser/viewer with formatted table

#### Scenario: PDF with no data

- GIVEN no attendance events exist for the date range
- WHEN `exportAttendancePDF('2024-01-01', '2024-01-07')` is called
- THEN throws error with message "No hay datos para el rango seleccionado"

#### Scenario: Large dataset pagination

- GIVEN attendance summary returns 150 records
- WHEN `exportAttendancePDF('2024-01-01', '2024-04-30')` is called
- THEN generates multi-page PDF with table spanning pages
- AND each page has header row and page footer

---

### Requirement: Report UI (`report-ui`)

The system SHALL provide a report page at `/dashboard/reports` with filters and export functionality.

**Page path**: `src/app/(dashboard)/dashboard/reports/page.tsx`

**Layout**:
- Report type selector (dropdown): "Resumen de Asistencia" (default)
- Date range: "Desde" date picker + "Hasta" date picker
- Employee filter: optional text input (placeholder: "Todos los empleados")
- Action buttons: "Descargar Excel" (primary), "Descargar PDF" (secondary)
- Preview section: table showing first 10 rows of current selection

**Default state on page load**:
- Date range: last 7 days from today
- Report type: "Resumen de Asistencia"
- Employee filter: empty (all employees)
- Preview: auto-loads on mount with default filters

**Loading states**:
- Preview table shows skeleton rows while loading
- Export buttons disabled during loading
- "Generando..." text on button during export generation

**Download trigger**: Server action returns Blob → create `URL.createObjectURL(blob)` → trigger `<a download>` click → revoke URL

#### Scenario: Page loads with default dates

- GIVEN user navigates to `/dashboard/reports`
- WHEN page renders
- THEN report type dropdown shows "Resumen de Asistencia" selected
- AND "Desde" date picker shows date 7 days ago
- AND "Hasta" date picker shows today
- AND preview table loads immediately with data

#### Scenario: User changes report type

- GIVEN page has loaded with "Resumen de Asistencia" selected
- WHEN user selects "Horas Trabajadas" from dropdown
- THEN preview section reloads with new report type data
- AND export buttons remain enabled

#### Scenario: User clicks Excel export

- GIVEN user has configured date range and filters
- WHEN user clicks "Descargar Excel"
- THEN button shows "Generando..." and is disabled
- AND after Blob returns, browser downloads file named "reporte-asistencia-{dateFrom}-{dateTo}.xlsx"
- AND button returns to normal state

#### Scenario: User clicks PDF export with no data

- GIVEN no attendance data exists for selected filters
- WHEN user clicks "Descargar PDF"
- THEN button shows "Generando..." briefly
- AND returns to normal state
- AND toast/alert appears with message "No hay datos para el rango seleccionado"
- AND no file is downloaded

#### Scenario: No data for selection

- GIVEN user selects a date range with no events
- WHEN preview loads or export is attempted
- THEN preview shows message "No hay datos para el rango seleccionado"
- AND export buttons remain enabled but download empty file/throw error appropriately