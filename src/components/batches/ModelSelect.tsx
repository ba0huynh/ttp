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
import { modelLabel } from '#/lib/business.ts'
import { masterDataQuery } from '#/lib/queries.ts'
import { saveModelFn } from '#/server/fns/master-data.ts'

export function ModelSelect({
  value,
  onChange,
  className,
  placeholder = 'Chọn dòng xe',
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
  const [modelYear, setModelYear] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  const models = master?.models ?? []

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!name.trim()) return setError('Vui lòng nhập dòng xe')
    setPending(true)
    try {
      const res = await saveModelFn({
        data: {
          name: name.trim(),
          modelYear: modelYear.trim() || null,
        },
      })
      await queryClient.invalidateQueries({ queryKey: ['master-data'] })
      onChange(res.id)
      setOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không lưu được dòng xe')
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
                label: 'Thêm dòng xe mới',
                onClick: () => {
                  setName('')
                  setModelYear('')
                  setError(null)
                  setOpen(true)
                },
              }
            : undefined
        }
      >
        {models.map((m) => (
          <SearchSelectItem key={m.id} value={String(m.id)}>
            {modelLabel(m)}
          </SearchSelectItem>
        ))}
      </SearchSelect>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Thêm Dòng Xe Mới
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} noValidate className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Dòng Xe *</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="SH 150i ABS"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Đời Xe</Label>
              <Input
                value={modelYear}
                onChange={(e) => setModelYear(e.target.value)}
                placeholder="2025"
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
                {pending ? 'Đang lưu...' : 'Lưu Dòng Xe'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
