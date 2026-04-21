"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ChartPanelProps {
  data?: { label: string; value: number }[]
  total?: number
  lowest?: number
  highest?: number
  average?: number
  progress?: number
  progressLabel?: string
  className?: string
}

function ChartPanel({
  data = defaultData,
  total = 1250,
  lowest = 210,
  highest = 764,
  average = 250,
  progress = 80,
  progressLabel = "total target",
  className,
}: ChartPanelProps) {
  const maxValue = Math.max(...data.map(d => d.value))

  return (
    <div
      data-slot="chart-panel"
      className={cn(
        "flex flex-col gap-4 p-4",
        className
      )}
    >
      {/* Chart area - simplified line chart */}
      <div className="h-32 relative">
        {/* Area fill gradient - UI Kit spec: rgba(124,58,237,0.15) → transparent */}
        <div 
          className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent rounded-lg"
        />
        
        {/* Simple line visualization */}
        <div className="absolute inset-0 flex items-end justify-between gap-1 px-2 pb-2">
          {data.map((point, index) => (
            <div
              key={index}
              className="flex-1 flex flex-col items-center"
            >
              {/* Bar */}
              <div 
                className="w-full bg-primary rounded-t-sm"
                style={{ 
                  height: `${(point.value / maxValue) * 100}%`,
                  minHeight: point.value > 0 ? '4px' : '0'
                }}
              />
            </div>
          ))}
        </div>
        
        {/* Axis labels - UI Kit spec: 12px #9CA3AF */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
          {data.map((point, index) => (
            <span key={index} className="text-[10px] text-muted-foreground">
              {point.label}
            </span>
          ))}
        </div>
      </div>

      {/* KPIs row - UI Kit spec colors */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">total value</p>
          <p className="text-sm font-bold text-foreground">{total}k</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">lowest</p>
          <p className="text-sm font-bold text-foreground">{lowest}k</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">highest</p>
          <p className="text-sm font-bold text-highlight">{highest}k</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">average</p>
          <p className="text-sm font-bold text-primary">{average}k</p>
        </div>
      </div>

      {/* Progress bar - UI Kit spec */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{progressLabel}</span>
          <span className="text-muted-foreground">{progress}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// Default data
const defaultData = [
  { label: "Jan", value: 450 },
  { label: "Feb", value: 520 },
  { label: "Mar", value: 380 },
  { label: "Apr", value: 620 },
  { label: "May", value: 480 },
  { label: "Jun", value: 550 },
  { label: "Jul", value: 670 },
  { label: "Aug", value: 720 },
  { label: "Sep", value: 580 },
]

export { ChartPanel, type ChartPanelProps as ChartPanelPropsType }
