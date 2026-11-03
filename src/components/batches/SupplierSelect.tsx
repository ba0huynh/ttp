import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { useCan } from '#/components/auth/Can.tsx'
import { Button } from '#/components/ui/button.tsx'
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
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
import { masterDataQuery } from '#/lib/queries.ts'
import { saveSupplierFn } from '#/server/fns/master-data.ts'

/** Supplier dropdown with a pinned row that creates a supplier on the spot */
export function SupplierSelect({
  value,
  onChange,
}: {
  /** 0 = no supplier */
  value: number
  onChange: (id: number) => void
}) {
  const { data: master } = useQuery(masterDataQuery())
  const queryClient = useQueryClient()
  const canManage = useCan('master-data.manage')
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!name.trim())
      return setError(
        'Tên nhà cung cấp không được để trống hoặc chỉ chứa khoảng trắng',
      )
    setPending(true)
    try {
      const res = await saveSupplierFn({ data: { name: name.trim() } })
      await queryClient.invalidateQueries({ queryKey: ['master-data'] })
      onChange(res.id)
      setOpen(false)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Không lưu được nhà cung cấp',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <SearchSelect
        className="h-11 w-full text-sm bg-white rounded-lg"
        placeholder="Chọn nhà cung cấp"
        value={value ? String(value) : ''}
        onValueChange={(v) => onChange(Number(v))}
        createAction={
          canManage
            ? {
                label: 'Thêm nhà cung cấp mới',
                onClick: () => {
                  setName('')
                  setError(null)
                  setOpen(true)
                },
              }
            : undefined
        }
      >
        {(master?.suppliers ?? []).map((s) => (
          <SearchSelectItem key={s.id} value={String(s.id)}>
            {s.name}
          </SearchSelectItem>
        ))}
      </SearchSelect>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Thêm Nhà Cung Cấp Mới
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} noValidate className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Tên Doanh Nghiệp Cung Cấp *
              </Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Thai Honda Co., Ltd"
              />
            </div>
            {error && (
              <p className="text-[11px] font-medium text-rose-600">{error}</p>
            )}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={pending}
                size="sm"
                className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                {pending ? 'Đang lưu...' : 'Lưu Nhà Cung Cấp'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
