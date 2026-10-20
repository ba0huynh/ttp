import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import * as React from 'react'

import { Can } from '#/components/auth/Can.tsx'
import { Button } from '#/components/ui/button.tsx'
import { formatErrorMessage } from '#/components/ui/confirm-dialog.tsx'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  EMPTY_LOGO,
  LogoField,
  uploadImage,
} from '#/components/ui/logo-field.tsx'
import type { LogoValue } from '#/components/ui/logo-field.tsx'
import { SupplierLogo } from '#/components/ui/supplier-logo.tsx'
import { masterDataQuery } from '#/lib/queries.ts'
import { saveSupplierFn } from '#/server/fns/master-data.ts'

/**
 * Supplier popup: name and image, with a button that switches the same
 * dialog to edit mode. The data comes from the cached master data.
 */
export function SupplierDetailDialog({
  supplierId,
  open,
  onOpenChange,
}: {
  supplierId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: master } = useQuery(masterDataQuery())
  const queryClient = useQueryClient()
  const supplier = master?.suppliers.find((s) => s.id === supplierId)

  const [editing, setEditing] = React.useState(false)
  const [name, setName] = React.useState('')
  const [logo, setLogo] = React.useState<LogoValue>(EMPTY_LOGO)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const save = useMutation({
    mutationFn: saveSupplierFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  // Always reopen in view mode
  React.useEffect(() => {
    if (open) setEditing(false)
  }, [open])

  const startEdit = () => {
    if (!supplier) return
    setName(supplier.name)
    setLogo({ image: supplier.image ?? '', file: null })
    setError(null)
    setEditing(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplier) return
    setSaving(true)
    setError(null)
    try {
      // The file only reaches the server now, when the supplier is saved
      const image = logo.file
        ? await uploadImage(logo.file, 'suppliers')
        : logo.image || null
      await save.mutateAsync({
        data: {
          id: supplier.id,
          name,
          image,
        },
      })
      setEditing(false)
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Không lưu được nhà cung cấp'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            {editing ? 'Sửa Nhà Cung Cấp' : 'Thông Tin Nhà Cung Cấp'}
          </DialogTitle>
        </DialogHeader>

        {!supplier ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {master ? 'Không tìm thấy nhà cung cấp này.' : 'Đang tải...'}
          </p>
        ) : editing ? (
          <form onSubmit={handleSave} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Tên Doanh Nghiệp Cung Cấp *
              </Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={255}
              />
            </div>
            <LogoField
              value={logo}
              onChange={setLogo}
              name={name}
              label="Hình Ảnh"
            />
            {error && (
              <p className="text-[11px] font-medium text-rose-600 whitespace-pre-line break-words">
                {error}
              </p>
            )}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => setEditing(false)}
                className="h-8 text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={saving}
                size="sm"
                className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                {saving ? 'Đang lưu...' : 'Lưu Nhà Cung Cấp'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4 py-2">
              <SupplierLogo
                key={supplier.image ?? ''}
                src={supplier.image}
                name={supplier.name}
                className="h-36 w-full max-w-xs"
              />
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 break-words">
                  {supplier.name}
                </h2>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs"
              >
                Đóng
              </Button>
              <Can permission="master-data.manage">
                <Button
                  type="button"
                  size="sm"
                  onClick={startEdit}
                  className="h-8 gap-1 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  <Pencil className="size-3.5" />
                  Chỉnh sửa
                </Button>
              </Can>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** A supplier name that opens the supplier popup when clicked */
export function SupplierLink({
  supplierId,
  className = 'hover:text-emerald-700 hover:underline',
  children,
}: {
  supplierId: number
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`cursor-pointer text-left ${className}`}
      >
        {children}
      </button>
      {open && (
        <SupplierDetailDialog
          supplierId={supplierId}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  )
}
