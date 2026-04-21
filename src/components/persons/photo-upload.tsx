'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2, Upload, X, Image } from 'lucide-react'
import { toast } from 'sonner'

interface PhotoUploadProps {
  personId?: string
  currentUrl?: string | null
  onUploaded: (url: string) => void
  onRemoved: () => void
}

export function PhotoUpload({
  personId,
  currentUrl,
  onUploaded,
  onRemoved,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)

  async function handleFile(file: File) {
    // Validate
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Solo se permiten imágenes JPEG o PNG')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5MB')
      return
    }

    setUploading(true)

    try {
      const supabase = createClient()

      // Generate path
      const ext = file.name.split('.').pop()
      const path = `${personId ?? 'temp'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      // Upload
      const { error } = await supabase.storage
        .from('face-photos')
        .upload(path, file, { contentType: file.type })

      if (error) throw error

      // Get public URL
      const { data } = supabase.storage
        .from('face-photos')
        .getPublicUrl(path)

      const url = data.publicUrl
      setPreview(url)
      onUploaded(url)
      toast.success('Foto subida correctamente')
    } catch (err) {
      toast.error('Error al subir la foto')
      console.error('Photo upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    setPreview(null)
    onRemoved()
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-foreground">Foto Facial</label>

      {preview ? (
        <div className="relative inline-block group">
          <img
            src={preview}
            alt="Foto facial"
            className="h-28 w-28 rounded-xl object-cover ring-2 ring-primary/20 shadow-md transition-all group-hover:ring-primary/40"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute -right-2 -top-2 h-7 w-7 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
            onClick={handleRemove}
            type="button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 group">
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
            disabled={uploading}
          />
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <>
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors">
                <Image className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">Subir</span>
            </>
          )}
        </label>
      )}

      <p className="text-[11px] font-medium text-muted-foreground">
        JPEG o PNG, máximo 5MB
      </p>
    </div>
  )
}
