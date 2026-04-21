'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAttendanceSummary } from '@/actions/reports'
import type { AttendanceSummaryRow, AttendanceSummaryResult, ReportFilters } from '@/types/report.types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { FileText, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ReportPreviewProps {
  dateFrom: string
  dateTo: string
  employeeId?: string
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mm = String(d.getUTCMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  } catch {
    return '—'
  }
}

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  } catch {
    return dateStr
  }
}

export default function ReportPreview({
  dateFrom,
  dateTo,
  employeeId,
}: ReportPreviewProps) {
  const [data, setData] = useState<AttendanceSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)

  const fetchData = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const filters: ReportFilters = {
        dateFrom,
        dateTo,
        employeeId: employeeId || undefined,
      }
      const result: AttendanceSummaryResult = await getAttendanceSummary(filters)
      setData(result.rows)
      setTruncated(result.truncated)
    } catch (err) {
      console.error('Error fetching attendance summary:', err)
      setError('Error al cargar los datos del reporte')
      toast.error('Error al cargar los datos del reporte')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, employeeId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const hasFilters = dateFrom && dateTo

  if (!hasFilters) {
    return (
      <Card className="glass-card overflow-hidden border-border/50 animate-in-premium-delay-1">
        <div className="py-12">
          <EmptyState
            icon={FileText}
            title="Sin filtros seleccionados"
            description="Seleccioná un rango de fechas para generar el reporte"
          />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="glass-card overflow-hidden border-border/50 animate-in-premium-delay-1">
        <div className="py-12">
          <EmptyState
            icon={AlertCircle}
            title="Error al cargar"
            description={error}
            action={{
              label: 'Reintentar',
              onClick: fetchData,
            }}
          />
        </div>
      </Card>
    )
  }

  if (truncated) {
    toast.warning('El reporte puede estar incompleto. El rango de fechas supera los 50.000 registros.')
  }

  return (
    <Card className="glass-card overflow-hidden border-border/50 animate-in-premium-delay-1">
      {loading ? (
        <div className="p-1">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50 bg-muted/5">
                {['Fecha', 'ID', 'Nombre', 'Check-in', 'Check-out', 'Horas', 'Estado'].map((h) => (
                  <TableHead
                    key={h}
                    className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border/30">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j} className="py-4">
                      <Skeleton className="h-5 w-full rounded-md" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : data.length === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={FileText}
            title="No hay datos para el rango seleccionado"
            description="No se encontraron registros de asistencia en el período indicado"
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50 bg-muted/5">
                <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                  Fecha
                </TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                  ID
                </TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                  Nombre
                </TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                  Check-in
                </TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                  Check-out
                </TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                  Horas
                </TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                  Estado
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow
                  key={`${row.employee_id}-${row.date}-${idx}`}
                  className="border-border/30 hover:bg-muted/10 transition-colors"
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDate(row.date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-medium text-xs">
                    {row.employee_id ?? '—'}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {row.person_name ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatTime(row.first_checkin)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatTime(row.last_checkout)}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-medium text-xs">
                    {row.total_hours !== null
                      ? `${row.total_hours.toFixed(1)}h`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.is_incomplete ? 'warning' : 'success'}
                      className="rounded-full px-2 py-0.5 font-bold uppercase text-[9px]"
                    >
                      {row.is_incomplete ? 'Incompleto' : 'Completo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}
