import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { useCan } from '#/components/auth/Can.tsx'
import { BankLabel } from '#/components/finance/BankLabel.tsx'
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
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
import { masterDataQuery } from '#/lib/queries.ts'
import { saveBankAccountFn } from '#/server/fns/master-data.ts'

/** Company bank account dropdown with a pinned row that creates one on the spot */
export function BankAccountSelect({
  value,
  onChange,
  noneLabel,
  compact = false,
  className = 'h-11 w-full text-sm rounded-lg',
}: {
  value: number | null
  onChange: (id: number | null) => void
  /** When set, adds an option for "no account" (e.g. cash) */
  noneLabel?: string
  /** Shows the logo and account number only (no bank name), for narrow table cells */
  compact?: boolean
  className?: string
}) {
  const { data: master } = useQuery(masterDataQuery())
  const queryClient = useQueryClient()
  const canManage = useCan('master-data.manage')
  const banks = master?.banks ?? []

  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [bankId, setBankId] = React.useState(0)
  const [number, setNumber] = React.useState('')
  const [branch, setBranch] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!name.trim() || !bankId || !number.trim())
      return setError('Vui lòng nhập tên tài khoản, ngân hàng và số tài khoản')
    setPending(true)
    try {
      const res = await saveBankAccountFn({
        data: {
          bankId,
          accountName: name.trim(),
          accountNumber: number.trim(),
          branch: branch.trim() || null,
          isActive: true,
        },
      })
      await queryClient.invalidateQueries({ queryKey: ['master-data'] })
      onChange(res.id)
      setOpen(false)
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Không lưu được tài khoản'))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <SearchSelect
        className={className}
        value={value ? String(value) : noneLabel ? 'none' : ''}
        onValueChange={(v) => onChange(v === 'none' ? null : Number(v))}
        createAction={
          canManage
            ? {
                label: 'Thêm tài khoản ngân hàng mới',
                onClick: () => {
                  setName('')
                  setBankId(0)
                  setNumber('')
                  setBranch('')
                  setError(null)
                  setOpen(true)
                },
              }
            : undefined
        }
      >
        {noneLabel && (
          <SearchSelectItem value="none">
            {noneLabel}
          </SearchSelectItem>
        )}
        {(master?.bankAccounts ?? [])
          .filter((a) => a.isActive)
          .map((a) => {
            const bankLabel = a.bankShortName || a.bankCode || a.bankName
            return (
              <SearchSelectItem
                key={a.id}
                value={String(a.id)}
                keywords={`${a.bankName} ${a.bankCode ?? ''} ${a.bankShortName ?? ''} ${a.accountNumber}`}
              >
                <BankLabel image={a.bankImage} name={bankLabel}>
                  {compact ? a.accountNumber : `${bankLabel} • ${a.accountNumber}`}
                </BankLabel>
              </SearchSelectItem>
            )
          })}
      </SearchSelect>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Thêm Tài Khoản Ngân Hàng
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} noValidate className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tên Tài Khoản *</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={255}
                placeholder="CÔNG TY TNHH TM DV TRƯỜNG THỊNH PHÁT"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Ngân Hàng *</Label>
              <SearchSelect
                className="h-11 w-full text-sm rounded-lg"
                placeholder="Chọn ngân hàng"
                value={bankId ? String(bankId) : ''}
                onValueChange={(v) => setBankId(Number(v))}
              >
                {banks.map((b) => (
                  <SearchSelectItem
                    key={b.id}
                    value={String(b.id)}
                    keywords={`${b.code ?? ''} ${b.shortName ?? ''}`}
                   
                  >
                    <BankLabel image={b.image} name={b.name}>
                      {b.name}
                    </BankLabel>
                  </SearchSelectItem>
                ))}
              </SearchSelect>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Số Tài Khoản *</Label>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                maxLength={50}
                placeholder="0071001234567"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Chi Nhánh</Label>
              <Input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                maxLength={150}
                placeholder="Chi nhánh TP. Hồ Chí Minh"
              />
            </div>
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
                {pending ? 'Đang lưu...' : 'Lưu Tài Khoản'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
