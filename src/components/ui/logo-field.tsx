import { Upload } from 'lucide-react'
import * as React from 'react'

import { alertDialog } from '#/components/ui/confirm-dialog.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Label } from '#/components/ui/label.tsx'
import { SupplierLogo } from '#/components/ui/supplier-logo.tsx'

export type LogoValue = {
  /** Stored value: https address or upload key; '' when none */
  image: string
  /** A picked file that has not been uploaded yet */
  file: File | null
}

export const EMPTY_LOGO: LogoValue = { image: '', file: null }

/** Sends a picked file to /api/uploads and returns its key path */
export async function uploadImage(file: File, folder: 'banks' | 'suppliers') {
  const form = new FormData()
  form.append('file', file)
  form.append('folder', folder)
  const res = await fetch('/api/uploads', { method: 'POST', body: form })
  const body = (await res.json()) as { key?: string; error?: string }
  if (!res.ok || !body.key) throw new Error(body.error ?? 'Không tải được ảnh')
  return body.key
}

/**
 * Image picker with a live preview. The picked file stays in the browser
 * (blob preview) until the form is saved, so cancelling leaves nothing on disk.
 */
export function LogoField({
  value,
  onChange,
  name,
  label = 'Hình ảnh',
}: {
  value: LogoValue
  onChange: (next: LogoValue) => void
  name?: string
  label?: string
}) {
  const input = React.useRef<HTMLInputElement>(null)
  const [preview, setPreview] = React.useState('')

  React.useEffect(() => {
    if (!value.file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(value.file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value.file])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      await alertDialog('Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      await alertDialog('Ảnh tối đa 2MB')
      return
    }
    onChange({ ...value, file })
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold">{label}</Label>
      <div className="flex items-stretch gap-3">
        <div className="flex h-32 w-1/2 items-center justify-center rounded-lg border border-border bg-white p-2">
          <SupplierLogo
            key={preview || value.image}
            src={preview || value.image}
            name={name}
            className="h-full w-full"
          />
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleFile}
        />
        <div className="flex w-1/2 flex-col items-start justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => input.current?.click()}
            className="h-8 text-xs gap-1"
          >
            <Upload className="size-3.5" />
            Chọn ảnh
          </Button>
          {(value.image || value.file) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(EMPTY_LOGO)}
              className="h-8 text-xs text-slate-500"
            >
              Xóa ảnh
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
