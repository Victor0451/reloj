'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCcw } from 'lucide-react'
import { checkAllDevicesConnection } from '@/actions/device-connectivity'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ConnectivityCheckButtonProps {
  className?: string
}

export function ConnectivityCheckButton({ className }: ConnectivityCheckButtonProps) {
  const [isChecking, setIsChecking] = useState(false)
  const router = useRouter()

  async function handleCheckAllDevices() {
    setIsChecking(true)
    try {
      const result = await checkAllDevicesConnection()
      if (result.success) {
        toast.success('Verificación de conectividad completada')
        // Refrescar la página para mostrar los nuevos estados
        router.refresh()
      } else {
        toast.error('Error en verificación: ' + result.error)
      }
    } catch (error) {
      toast.error('Error al verificar conexiones: ' + (error as Error).message)
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <Button 
      onClick={handleCheckAllDevices} 
      disabled={isChecking}
      className={className}
    >
      <RefreshCcw className={isChecking ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
      {isChecking ? 'Verificando...' : 'Verificar Conectividad'}
    </Button>
  )
}