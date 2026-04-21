"use client"

import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from "react-error-boundary"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

function ErrorBoundaryFallback({ error, resetErrorBoundary }: FallbackProps) {
  // Log error for debugging (structured logging can be added later)
  console.error("[ErrorBoundary] Uncaught error:", error instanceof Error ? error.message : String(error))

  const errorMessage = error instanceof Error ? error.message : "Ha ocurrido un error inesperado. Por favor, intentá nuevamente."

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <Card className="max-w-md w-full" variant="default">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle className="text-center">Algo salió mal</CardTitle>
          <CardDescription className="text-center">
            Encontramos un error inesperado. Podés intentar nuevamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pt-2">
          {errorMessage && (
            <div className="mb-4 rounded-lg bg-muted/50 p-3 text-left">
              <p className="font-mono text-xs text-muted-foreground break-all">
                {errorMessage}
              </p>
            </div>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={resetErrorBoundary}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorBoundaryFallback}
      onError={(error) => {
        console.error("[ErrorBoundary] Uncaught error:", error instanceof Error ? error.message : String(error))
      }}
    >
      {children}
    </ReactErrorBoundary>
  )
}

export type { ErrorBoundaryProps }
