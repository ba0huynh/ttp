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
import { saveExpenseTypeFn } from '#/server/fns/master-data.ts'

export function ExpenseTypeSelect({
  value,
  onChange,
  className,
  placeholder = 'Chọn loại chi phí',
}: {
  value: number
  onChange: (id: number) => void
  className?: string
  placeholder?: string
}) {
  const { data: master } = useQuery(masterDataQuery())
  const queryClient = useQueryClient()
  const canManage = useCan('master-data.manage')
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  const expenseTypes = master?.expenseTypes ?? []

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!name.trim()) return setError('Vui lòng nhập tên loại chi phí')
    setPending(true)
    try {
      const res = await saveExpenseTypeFn({ data: { name: name.trim() } })
      await queryClient.invalidateQueries({ queryKey: ['master-data'] })
      onChange(res.id)
      setOpen(false)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Không lưu được loại chi phí',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <SearchSelect
        className={className}
        placeholder={placeholder}
        value={value ? String(value) : ''}
        onValueChange={(val) => onChange(Number(val))}
        createAction={
          canManage
            ? {
                label: 'Thêm loại chi phí mới',
                onClick: () => {
                  setName('')
                  setError(null)
                  setOpen(true)
                },
              }
            : undefined
        }
      >
        {expenseTypes.map((et) => (
          <SearchSelectItem key={et.id} value={String(et.id)}>
            {et.name}
          </SearchSelectItem>
        ))}
      </SearchSelect>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Thêm Loại Chi Phí Mới
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} noValidate className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tên Loại Chi Phí *</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Thuế nhập khẩu, Phí vận chuyển..."
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
                {pending ? 'Đang lưu...' : 'Lưu Loại Chi Phí'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
