'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, FileSpreadsheet, FileX, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import ReportPreview from '@/components/reports/report-preview'
import {
  exportAttendanceExcel,
  exportAttendancePDF,
} from '@/actions/reports'
import type { ReportFilters } from '@/types/report.types'

// Default date range: last 7 days
function getDefaultDates() {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]

  return { dateFrom: weekAgoStr, dateTo: todayStr }
}

export default function ReportsPage() {
  const { dateFrom: defaultDateFrom, dateTo: defaultDateTo } = getDefaultDates()

  const [reportType] = useState('attendance-summary')
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(defaultDateTo)
  const [employeeId, setEmployeeId] = useState('')

  const [isGenerating, startGenerating] = useTransition()
  const [isExportingExcel, startExportExcel] = useTransition()
  const [isExportingPdf, startExportPdf] = useTransition()

  const [previewKey, setPreviewKey] = useState(0)

  function handleGenerarReporte() {
    if (!dateFrom || !dateTo) {
      toast.error('Seleccioná un rango de fechas')
      return
    }
    if (dateFrom > dateTo) {
      toast.error('Rango de fechas inválido')
      return
    }
    startGenerating(() => {
      setPreviewKey((k) => k + 1)
    })
  }

  function handleExportExcel() {
    if (!dateFrom || !dateTo) {
      toast.error('Seleccioná un rango de fechas')
      return
    }

    const filters: ReportFilters = {
      dateFrom,
      dateTo,
      employeeId: employeeId || undefined,
    }

    startExportExcel(async () => {
      try {
        const blob = await exportAttendanceExcel(filters)
        triggerDownload(blob, `reporte-asistencia-${dateFrom}-${dateTo}.xlsx`)
        toast.success('Excel exportado correctamente')
      } catch (err) {
        console.error('Excel export error:', err)
        toast.error('Error al exportar Excel')
      }
    })
  }

  function handleExportPdf() {
    if (!dateFrom || !dateTo) {
      toast.error('Seleccioná un rango de fechas')
      return
    }

    const filters: ReportFilters = {
      dateFrom,
      dateTo,
      employeeId: employeeId || undefined,
    }

    startExportPdf(async () => {
      try {
        const blob = await exportAttendancePDF(filters)
        triggerDownload(blob, `reporte-asistencia-${dateFrom}-${dateTo}.pdf`)
        toast.success('PDF exportado correctamente')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        if (message.includes('@react-pdf/renderer')) {
          toast.error('PDF no disponible: librería no instalada')
        } else {
          toast.error('Error al exportar PDF')
        }
      }
    })
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const isBusy = isGenerating || isExportingExcel || isExportingPdf

  return (
    <div className="space-y-8">
      <div className="animate-in-premium page-header">
        <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">
          Generá reportes de asistencia y exportalos a PDF o Excel
        </p>
      </div>

      {/* Filters Card */}
      <Card className="glass-card animate-in-premium-delay-1">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">Generar Reporte</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Configurá los filtros y generá el reporte de asistencia
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filter Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            {/* Report Type */}
            <div className="flex flex-col gap-1.5 w-full sm:w-48">
              <label className="text-sm font-medium text-muted-foreground">
                Tipo de Reporte
              </label>
              <select
                value={reportType}
                disabled
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium outline-none transition-all bg-muted/50 cursor-not-allowed"
              >
                <option value="attendance-summary">Resumen de Asistencia</option>
              </select>
            </div>

            {/* Date From */}
            <div className="flex flex-col gap-1.5 w-full sm:w-auto">
              <label className="text-sm font-medium text-muted-foreground">
                Desde
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 w-auto"
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1.5 w-full sm:w-auto">
              <label className="text-sm font-medium text-muted-foreground">
                Hasta
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 w-auto"
              />
            </div>

            {/* Employee ID Filter */}
            <div className="flex flex-col gap-1.5 flex-1 w-full">
              <label className="text-sm font-medium text-muted-foreground">
                ID de Empleado (opcional)
              </label>
              <Input
                type="text"
                placeholder="Todos los empleados"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerarReporte}
              disabled={isBusy || !dateFrom || !dateTo}
              className="btn-primary h-10 px-6 w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generar Reporte
                </>
              )}
            </Button>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={isBusy || !dateFrom || !dateTo}
              className="btn-secondary h-10 px-4 flex-1 sm:flex-none"
            >
              {isExportingExcel ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Descargar Excel
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={isBusy || !dateFrom || !dateTo}
              className="btn-secondary h-10 px-4 flex-1 sm:flex-none"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <FileX className="mr-2 h-4 w-4" />
                  Descargar PDF
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      <div className="animate-in-premium-delay-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Vista Previa</h2>
          {dateFrom && dateTo && (
            <span className="text-sm text-muted-foreground">
              {dateFrom} — {dateTo}
              {employeeId && ` • Empleado: ${employeeId}`}
            </span>
          )}
        </div>
        <ReportPreview
          key={previewKey}
          dateFrom={dateFrom}
          dateTo={dateTo}
          employeeId={employeeId || undefined}
        />
      </div>
    </div>
  )
}
