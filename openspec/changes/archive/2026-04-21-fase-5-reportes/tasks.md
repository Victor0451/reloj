# Tasks: Fase 5 — Reportes de Asistencia

## Phase 1: Foundation

- [x] 1.1 Install `xlsx` library: `npm install xlsx`
- [x] 1.2 Create `src/types/report.types.ts` with `AttendanceSummaryRow` interface matching spec response shape
- [x] 1.3 Create `src/actions/reports.ts` with empty exports stub (to be implemented in Phase 2)

## Phase 2: Server Actions

- [x] 2.1 Implement `getAttendanceSummary(dateFrom, dateTo, employeeId?)` in `src/actions/reports.ts`
  - Query `access_events` filtered by date range
  - LEFT JOIN `persons` for person_name
  - Group by `employee_id` AND calendar date (derived from `event_time` truncated to date)
  - Calculate `first_checkin` = MIN(timestamp) where direction='in'
  - Calculate `last_checkout` = MAX(timestamp) where direction='out'
  - Calculate `total_hours` = diff between last_checkout and first_checkin
  - If missing checkout: `last_checkout=null`, `total_hours=null`, `status='incomplete'`
  - Handle cross-midnight shifts: split by calendar date
- [x] 2.2 Implement `exportAttendanceExcel(dateFrom, dateTo, employeeId?)`
  - Call `getAttendanceSummary` internally
  - Use `xlsx` to build worksheet "Resumen de Asistencia"
  - Column widths: Fecha(12), ID Empleado(14), Nombre(24), Primer Check-in(16), Último Check-out(16), Horas Totales(14)
  - Return `Blob` with MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- [x] 2.3 Implement `exportAttendancePDF(dateFrom, dateTo, employeeId?)`
  - Use `@react-pdf/renderer` (install first if not present)
  - A4 page, "Reporte de Asistencia" header with date range + timestamp
  - Table with same columns as Excel, page footer "Page X of Y"
  - Multi-page support with repeat header
  - Throw error "No hay datos para el rango seleccionado" when no data
  - NOTE: @react-pdf/renderer not installed → throws error with installation instructions

## Phase 3: Report UI

- [x] 3.1 Update `src/app/(dashboard)/dashboard/reports/page.tsx`
  - Replace placeholder card with report filters (report type dropdown, date range pickers, employee filter)
  - Add "Descargar Excel" and "Descargar PDF" buttons
  - Add preview table section below filters
  - Default dates: last 7 days (Desde=hace 7 días, Hasta=hoy)
- [x] 3.2 Create `src/components/reports/report-preview.tsx`
  - Props: `dateFrom`, `dateTo`, `employeeId?`
  - Table showing attendance summary (first 10 rows for preview)
  - Skeleton loading state with 5 placeholder rows
  - Empty state: "No hay datos para el rango seleccionado"
  - Auto-loads on mount with default filters
- [x] 3.3 Wire page to server actions
  - Call `getAttendanceSummary` for preview on mount and on filter change
  - Excel: call `exportAttendanceExcel` → `URL.createObjectURL` → trigger download → revoke URL
  - PDF: call `exportAttendancePDF` → same download pattern
  - Disable buttons during loading with "Generando..." text

## Phase 4: Polish & Verification

- [x] 4.1 Error handling: show toast/message when export fails
  - Excel export: try/catch with toast.error('Error al exportar Excel')
  - PDF export: try/catch with message includes '@react-pdf/renderer' → toast.error('PDF no disponible: librería no instalada')
  - ReportPreview: error state with toast.error + retry action
- [x] 4.2 Verify: TypeScript check passes (`npx tsc --noEmit`) — no errors in src/ files
  - Manual verification: Excel download flow correctly wired via URL.createObjectURL
  - Manual verification: PDF shows appropriate message when library not installed
- [ ] 4.3 Optional: add "Horas trabajadas" report type (future, not MVP)