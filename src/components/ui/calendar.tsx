"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"

export interface CalendarDay {
  date: Date
  day: number
  isCurrentMonth: boolean
  isToday?: boolean
  isSelected?: boolean
  hasEvent?: boolean
}

export interface CalendarProps {
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
  events?: Date[]
  className?: string
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

function Calendar({
  selectedDate = new Date(),
  onDateSelect,
  events = [],
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selected, setSelected] = React.useState<Date | null>(selectedDate)

  const today = React.useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  const days = React.useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    
    // First day of the month
    const firstDay = new Date(year, month, 1)
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0)
    
    // Adjust for Monday start (UI Kit spec: Mon first)
    let startDay = firstDay.getDay() - 1
    if (startDay < 0) startDay = 6 // Sunday becomes 6
    
    const daysArray: CalendarDay[] = []
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDay - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i
      daysArray.push({
        date: new Date(year, month - 1, day),
        day,
        isCurrentMonth: false,
      })
    }
    
    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day)
      const isToday = date.getTime() === today.getTime() ? true : undefined
      const isSelected = selected ? date.getTime() === selected.getTime() : undefined
      const hasEvent = events.some(e => 
        new Date(e).getTime() === date.getTime()
      )
      
      daysArray.push({
        date,
        day,
        isCurrentMonth: true,
        isToday,
        isSelected,
        hasEvent,
      })
    }
    
    // Next month days (fill to 42 cells for 6 weeks)
    const remaining = 42 - daysArray.length
    for (let day = 1; day <= remaining; day++) {
      daysArray.push({
        date: new Date(year, month + 1, day),
        day,
        isCurrentMonth: false,
      })
    }
    
    return daysArray
  }, [currentMonth, selected, today, events])

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleDayClick = (day: CalendarDay) => {
    setSelected(day.date)
    onDateSelect?.(day.date)
  }

  return (
    <div
      data-slot="calendar"
      className={cn(
        "w-full max-w-sm mx-auto",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground">
          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-4 text-primary" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="size-4 text-primary" />
          </button>
        </div>
      </div>

      {/* Weekday headers - UI Kit spec: 12px, #9CA3AF */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs text-muted-foreground font-medium py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <button
            key={index}
            onClick={() => handleDayClick(day)}
            disabled={!day.isCurrentMonth}
            className={cn(
              "relative flex items-center justify-center text-sm transition-all duration-200",
              // Size: 18-20px (UI Kit spec)
              "h-8 w-8",
              
              // Not current month
              !day.isCurrentMonth && "text-muted-foreground/50 cursor-default",
              
              // Current month - default: #374151 (dark: #e5e5e5)
              day.isCurrentMonth && !day.isSelected && !day.isToday && "text-foreground hover:bg-muted rounded-full",
              
              // Today - UI Kit spec: border ring
              day.isToday && !day.isSelected && "calendar-day-today text-foreground",
              
              // Selected - UI Kit spec: circle #7C3AED with white number
              day.isSelected && "calendar-day-selected",
              
              // Disabled state
              "disabled:cursor-not-allowed disabled:hover:bg-transparent"
            )}
          >
            {day.day}
            
            {/* Event indicator - UI Kit spec: small calendar icon below number */}
            {day.hasEvent && day.isCurrentMonth && (
              <CalendarIcon className="absolute -bottom-0.5 size-2.5 text-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export { Calendar, type CalendarDay as CalendarDayType }
