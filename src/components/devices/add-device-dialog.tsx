'use client'

import { useMemo, useState } from 'react'
import { Plus, Monitor, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createDevice } from '@/actions/devices'
import { toast } from 'sonner'

type ConnectionStatus = 'idle' | 'success' | 'error'

type DeviceFormState = {
  name: string
  serial_number: string
  ip_address: string
  location: string
  username: string
  password: string
}

const INITIAL_FORM: DeviceFormState = {
  name: '',
  serial_number: '',
  ip_address: '',
  location: '',
  username: 'admin',
  password: '',
}

export function AddDeviceDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<DeviceFormState>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')

  const canTestConnection = useMemo(
    () => Boolean(form.ip_address.trim() && form.username.trim() && form.password.trim()),
    [form.ip_address, form.username, form.password]
  )

  function resetState() {
    setForm(INITIAL_FORM)
    setLoading(false)
    setTestingConnection(false)
    setConnectionStatus('idle')
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) resetState()
  }

  function updateField<K extends keyof DeviceFormState>(key: K, value: DeviceFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (connectionStatus !== 'idle') setConnectionStatus('idle')
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setConnectionStatus('idle')

    const result = await createDevice({
      ...form,
      brand: 'hikvision',
    })

    setLoading(false)

    if (result.success) {
      if (result.connectionSuccess) {
        toast.success('Dispositivo registrado y conectado correctamente')
      } else {
        toast.warning(result.connection?.error || 'Dispositivo registrado pero sin conexión. Verificá IP y credenciales.')
      }
      handleOpenChange(false)
      return
    }

    toast.error('Error al registrar: ' + (result.error || 'Error desconocido'))
  }

  async function handleTestConnection() {
    if (!canTestConnection) {
      toast.error('Completá IP, usuario y contraseña para probar')
      return
    }

    setTestingConnection(true)
    setConnectionStatus('idle')

    const result = await createDevice({
      name: form.name || 'TEST',
      serial_number: form.serial_number || 'TEST',
      ip_address: form.ip_address,
      location: form.location,
      username: form.username,
      password: form.password,
      brand: 'hikvision',
      testConnection: true,
    })

    setTestingConnection(false)

    if (result.success && result.connectionSuccess) {
      setConnectionStatus('success')
      toast.success('✅ Conexión exitosa')
      return
    }

    setConnectionStatus('error')
    toast.error(result.connection?.error || result.error || '❌ Error de conexión. Verificá IP y credenciales.')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Registrar Reloj
          </Button>
        }
      />
      <DialogContent className="glass-card border-border/50 sm:max-w-[450px]">
        <form onSubmit={handleSubmit} id="device-form">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Monitor className="h-5 w-5 text-primary" />
              Nuevo Dispositivo
            </DialogTitle>
            <DialogDescription>
              Ingresá los datos del reloj biométrico para vincularlo al sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Datos del Dispositivo</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    placeholder="Nombre (Ej: Entrada Principal)"
                    className="input-outlined"
                    required
                  />
                </div>
                <div>
                  <Input
                    id="serial_number"
                    name="serial_number"
                    value={form.serial_number}
                    onChange={(event) => updateField('serial_number', event.target.value)}
                    placeholder="Serial"
                    className="input-outlined"
                    required
                  />
                </div>
                <div>
                  <Input
                    id="ip_address"
                    name="ip_address"
                    value={form.ip_address}
                    onChange={(event) => updateField('ip_address', event.target.value)}
                    placeholder="IP (192.168.1.100)"
                    className="input-outlined"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    id="location"
                    name="location"
                    value={form.location}
                    onChange={(event) => updateField('location', event.target.value)}
                    placeholder="Ubicación (opcional)"
                    className="input-outlined"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Credenciales de Acceso</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    id="username"
                    name="username"
                    value={form.username}
                    onChange={(event) => updateField('username', event.target.value)}
                    placeholder="Usuario"
                    className="input-outlined"
                    required
                  />
                </div>
                <div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    placeholder="Contraseña"
                    className="input-outlined"
                    required
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={handleTestConnection}
                disabled={testingConnection}
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Probando...
                  </>
                ) : connectionStatus === 'success' ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-2 text-green-500" />
                    Conectado
                  </>
                ) : connectionStatus === 'error' ? (
                  <>
                    <XCircle className="h-3 w-3 mr-2 text-red-500" />
                    Error de conexión
                  </>
                ) : (
                  'Probar Conexión'
                )}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="btn-secondary"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Registrar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
