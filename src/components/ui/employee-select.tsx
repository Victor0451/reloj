'use client'

import * as React from 'react'
import { Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PersonRecord } from '@/types/person.types'

interface EmployeeSelectProps {
  persons: PersonRecord[]
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  className?: string
}

export function EmployeeSelect({
  persons,
  selected,
  onChange,
  placeholder = 'Buscar empleados...',
  className,
}: EmployeeSelectProps) {
  const [search, setSearch] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  const filtered = persons.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedPersons = persons.filter(p => selected.includes(p.id))

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(i => i !== id))
    } else {
      onChange([...selected, id])
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange([])
    setSearch('')
  }

  // Close on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className={cn('relative flex flex-col gap-1', className)}>
      <label className="text-xs font-medium">Empleados</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={cn(
            'h-10 w-full rounded-lg border border-border bg-card pl-10 pr-10 text-sm text-left',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            'transition-colors cursor-pointer'
          )}
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <span className="truncate">{selected.length} empleado{selected.length !== 1 ? 's' : ''} seleccionado{selected.length !== 1 ? 's' : ''}</span>
          )}
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No se encontraron empleados
              </div>
            )}
            {filtered.map(person => (
              <button
                key={person.id}
                type="button"
                onClick={() => toggle(person.id)}
                className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-accent focus:bg-accent focus:outline-none transition-colors"
              >
                <div
                  className={cn(
                    'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                    selected.includes(person.id)
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/30'
                  )}
                >
                  {selected.includes(person.id) && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <span className="text-sm text-left flex-1">{person.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected chips */}
      {selectedPersons.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {selectedPersons.map(person => (
            <button
              key={person.id}
              type="button"
              onClick={() => toggle(person.id)}
              className="flex items-center gap-1 h-6 rounded-full bg-primary/10 text-primary px-2.5 text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <span className="max-w-[120px] truncate">{person.name}</span>
              <X className="h-3 w-3 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
