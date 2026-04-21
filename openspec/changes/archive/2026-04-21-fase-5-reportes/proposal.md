# Proposal: Fase 5 - Reportes de Asistencia

## Intent

Build a complete attendance reporting system with multiple report types (Resumen de Asistencia, Llegadas Tarde, Horas Trabajadas, Ausencias) and multi-format export (Excel primary, PDF secondary, CSV existing). Establish a reusable report framework that extends the existing CSV export pattern in `events.ts`.

## Scope

### In Scope
- Install `xlsx` (Excel) and `@react-pdf/renderer` (PDF) libraries
- Server Actions: `generateAttendanceReport(filters)`, `exportReportExcel(filters)`, `exportReportPdf(filters)`
- Report page UI: report selector, date range picker, employee/department filters, export buttons
- Report type: Resumen de Asistencia (daily/weekly/monthly summary per employee)
- Extend existing CSV export pattern to all reports

### Out of Scope
- Late arrivals / Absences / Time worked report types (Phase 2+)
- PDF styling/theming (basic table layout only)
- Work schedule configuration UI (use hardcoded 9:00 AM default)

## Capabilities

### New Capabilities
- `reports-attendance-summary`: Generate attendance summary report per employee for date range; includes check-in/out times, late status, total hours
- `reports-export-excel`: Export filtered report data as `.xlsx` via Server Action binary response
- `reports-export-pdf`: Export filtered report data as `.pdf` via `@react-pdf/renderer`

### Modified Capabilities
- `events-export`: Extend CSV export to support report-specific filters (department, device)

## Approach

1. **Phase 1** — Install `xlsx` library; build `exportReportExcel()` Server Action following `exportEventsCsv()` pattern
2. **Phase 2** — Build report page UI: report type selector, date range picker, employee/department filter; wire to Excel export
3. **Phase 3** — Install `@react-pdf/renderer`; build `exportReportPdf()` Server Action with basic table layout
4. **Phase 4** — Additional report types (Llegadas Tarde, Horas Trabajadas, Ausencias)

Report filters interface extends `EventFilters` with `department`, `deviceId`. Server Actions return `Blob` for download. Client triggers download via `URL.createObjectURL()`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/(dashboard)/dashboard/reports/page.tsx` | Modified | Replace placeholder with real report UI |
| `src/actions/events.ts` | Modified | Add `exportReportExcel()`, `exportReportPdf()` |
| `src/actions/reports.ts` | New | Report generation logic (attendance calculations) |
| `src/components/reports/` | New | Report filters, export buttons, preview components |
| `package.json` | Modified | Add `xlsx`, `@react-pdf/renderer` dependencies |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| No work schedules in schema | High | Use hardcoded 9:00 AM; document as limitation |
| Large event datasets | Medium | Add 10k row export limit; server-side streaming |
| PDF memory on server | Medium | Async generation with timeout; limit concurrent requests |
| Department filter needs JOIN | Low | JOIN persons table on employee_id in filter query |

## Rollback Plan

1. Remove `xlsx` and `@react-pdf/renderer` from `package.json`
2. Delete `src/actions/reports.ts`
3. Delete `src/components/reports/` directory
4. Restore `src/app/(dashboard)/dashboard/reports/page.tsx` to placeholder
5. Run `git checkout` on `src/actions/events.ts` if modified

## Dependencies

- Fase 3 (Personas): persons table with employee_id, department
- Fase 4 (Eventos): access_events table, CSV export pattern
- `xlsx` library (npm)
- `@react-pdf/renderer` library (npm)
- shadcn/ui components: Select, DatePicker, Button, Table

## Success Criteria

- [ ] Reports page loads with report type selector and date range picker
- [ ] Employee/department filter returns correct data
- [ ] Excel export downloads valid `.xlsx` file with attendance data
- [ ] PDF export downloads valid `.pdf` file with formatted table
- [ ] CSV export works for all report types (extends existing)
- [ ] Export respects 10k row limit with clear user feedback
