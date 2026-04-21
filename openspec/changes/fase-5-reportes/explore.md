## Exploration: Fase 5 — Reportes de Asistencia

### Current State

**Reports page exists but is a placeholder.** At `src/app/(dashboard)/dashboard/reports/page.tsx` — shows "Próximamente" (Coming Soon) with no functionality.

**No report components, actions, or libraries exist yet.** The sidebar links to `/dashboard/reports` but there's nothing behind it.

**CSV export is already implemented** via `exportEventsCsv()` in `src/actions/events.ts` — this is the foundation pattern to build on.

### Affected Areas

- `src/app/(dashboard)/dashboard/reports/page.tsx` — placeholder, needs real implementation
- `src/actions/events.ts` — CSV export exists, Excel/PDF need new actions
- `src/components/events/events-table.tsx` — filter UI patterns to reuse
- `src/components/layout/AppSidebar.tsx` — already has "Reportes" nav item pointing to `/dashboard/reports`
- `src/actions/persons.ts` — employee data source for reports
- `supabase/schema.sql` — access_events, persons, devices tables for data

### Data Available for Reports

**access_events table:**
- `event_time` (TIMESTAMPTZ) — primary timestamp
- `employee_id` (TEXT) — links to persons
- `event_type` (TEXT) — "0" = entrada, "1" = salida
- `verify_mode` (TEXT) — authentication method
- `device_serial` (TEXT) — links to devices for location
- `person_id` (UUID) — FK to persons table

**persons table:**
- `employee_id`, `name`, `department`

**devices table:**
- `serial_number`, `name`, `location`

### Report Types Needed

1. **Attendance Summary** — who checked in/out per day
2. **Late Arrivals / Early Departures** — based on configurable schedules
3. **Absences** — days with no events for scheduled persons
4. **Time Worked** — calculated hours from first entry to last exit per day

### Export Formats

1. **CSV** — already exists in `exportEventsCsv()`, limit 10,000 rows
2. **Excel (XLSX)** — NOT implemented, needs library
3. **PDF** — NOT implemented, needs library

### Library Options

**Excel generation:**
| Library | Pros | Cons |
|---------|------|------|
| `xlsx` (SheetJS) | Most popular, good API, client/server | Large bundle (~5MB) |
| `exceljs` | Better styling support | More complex API |

**PDF generation:**
| Library | Pros | Cons |
|---------|------|------|
| `@react-pdf/renderer` | React-based, works with App Router | Larger runtime |
| `jspdf` + `jspdf-autotable` | Lightweight, good for tables | Imperative API |

### Approaches

1. **Server-side generation (Recommended)** — Generate Excel/PDF in Server Actions
   - Pros: handles large datasets, no client memory issues, follows existing patterns
   - Cons: requires streaming/download handling
   - Effort: Medium

2. **Client-side generation** — Generate in browser with JS libraries
   - Pros: doesn't block server, can use rich client UI
   - Cons: large libraries shipped to client, memory limits for large datasets
   - Effort: Medium

3. **API Route with file download** — POST to `/api/reports/[type]`
   - Pros: clean separation, easy to add auth checks
   - Cons: extra route file needed
   - Effort: Medium

### Technical Approach Recommendation

**Server Actions with client download triggers** — follow the `exportEventsCsv()` pattern:
- New Server Actions: `exportReportPdf(filters)`, `exportReportExcel(filters)`
- Return as binary Blob from Server Action, trigger download on client
- Use `xlsx` for Excel, `@react-pdf/renderer` for PDF
- Reuse filter types from `EventFilters` interface
- Add report-specific filters: `department`, `deviceId`

### Gap Analysis

| Item | Status |
|------|--------|
| Reports page UI | ✅ Exists as placeholder |
| PDF export | ❌ Not implemented |
| Excel export | ❌ Not implemented |
| Report type: Attendance summary | ❌ Not implemented |
| Report type: Late arrivals | ❌ Not implemented |
| Report type: Absences | ❌ Not implemented |
| Report type: Time worked | ❌ Not implemented |
| Date range filter UI | ✅ Exists in events-table |
| Employee filter UI | ✅ Exists in events-table |
| PDF library | ❌ Missing |
| Excel library | ❌ Missing |
| Device/Location in reports | ⚠️ Available via join but not used |

### Risks

- **PDF generation on server** — `@react-pdf/renderer` requires Node.js environment, works in Next.js App Router but needs careful handling of async operations
- **Large datasets** — events table could grow large; may need pagination or cursor-based export limits
- **No work schedules defined** — late arrivals/early departures require knowing expected work hours per person (not in schema)
- **Department filter** — persons have `department` but events don't; need JOIN logic

### Ready for Proposal

Yes. Foundation is solid: existing CSV export pattern, filter UI, data model. Next step: `sdd-propose` for the reportes change.
