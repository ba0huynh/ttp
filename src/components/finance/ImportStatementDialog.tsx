import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Upload } from 'lucide-react'
import * as React from 'react'

import { BankLabel } from '#/components/finance/BankLabel.tsx'
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx'
import { formatVnd, todayIso } from '#/lib/business.ts'
import { masterDataQuery } from '#/lib/queries.ts'
import { parseStatementText } from '#/lib/statement-import.ts'
import { importBankStatementFn } from '#/server/fns/finance.ts'

/** One editable line of the statement. Amounts are strings so the inputs can be empty. */
interface Row {
  key: number
  date: string
  description: string
  debit: string
  credit: string
}

const amountOf = (v: string) => (v.trim() === '' ? 0 : Number(v))
const isBlank = (r: Row) =>
  !r.description.trim() && amountOf(r.debit) === 0 && amountOf(r.credit) === 0

/** Module 10: enter a bank statement line by line in an editable table */
export function ImportStatementDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (statementId: number) => void
}) {
  const queryClient = useQueryClient()
  const { data: master } = useQuery({ ...masterDataQuery(), enabled: open })
  const accounts = (master?.bankAccounts ?? []).filter((a) => a.isActive)

  const nextKey = React.useRef(1)
  const newRow = (patch: Partial<Row> = {}): Row => ({
    key: nextKey.current++,
    date: todayIso(),
    description: '',
    debit: '',
    credit: '',
    ...patch,
  })

  const [accountId, setAccountId] = React.useState<number | null>(null)
  const [rows, setRows] = React.useState<Row[]>(() => [newRow()])
  const [error, setError] = React.useState<string | null>(null)

  const effectiveAccountId = accountId ?? accounts[0]?.id ?? null

  // Blank rows are ignored; the others must be complete
  const filled = rows.filter((r) => !isBlank(r))
  const isValid = (r: Row) => {
    const d = amountOf(r.debit)
    const c = amountOf(r.credit)
    return !!r.date && d >= 0 && c >= 0 && d + c > 0 && !(d > 0 && c > 0)
  }
  const invalidKeys = new Set(
    filled.filter((r) => !isValid(r)).map((r) => r.key),
  )
  const totalDebit = filled.reduce((s, r) => s + amountOf(r.debit), 0)
  const totalCredit = filled.reduce((s, r) => s + amountOf(r.credit), 0)

  const reset = () => {
    setAccountId(null)
    setRows([newRow()])
    setError(null)
  }

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const addRow = () =>
    setRows((rs) => [...rs, newRow({ date: rs[rs.length - 1]?.date })])
  const removeRow = (key: number) =>
    setRows((rs) => {
      const left = rs.filter((r) => r.key !== key)
      return left.length > 0 ? left : [newRow()]
    })

  /** Pasting several rows copied from Excel fills the table instead of one cell */
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (!/[\n\t]/.test(text.trim())) return
    const { lines } = parseStatementText(text)
    if (lines.length === 0) return
    e.preventDefault()
    setRows((rs) => [
      ...rs.filter((r) => !isBlank(r)),
      ...lines.map((l) =>
        newRow({
          date: l.transactionDate,
          description: l.description ?? '',
          debit: l.debit > 0 ? String(l.debit) : '',
          credit: l.credit > 0 ? String(l.credit) : '',
        }),
      ),
    ])
  }

  const importStatement = useMutation({
    mutationFn: importBankStatementFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const handleSubmit = async () => {
    setError(null)
    if (!effectiveAccountId) return setError('Chưa chọn tài khoản ngân hàng')
    if (filled.length === 0) return setError('Chưa có dòng giao dịch nào')
    if (invalidKeys.size > 0)
      return setError(
        `Có ${invalidKeys.size} dòng chưa hợp lệ: cần ngày và đúng một trong hai ô Ghi nợ / Ghi có (số tiền > 0)`,
      )
    try {
      const res = await importStatement.mutateAsync({
        data: {
          companyBankAccountId: effectiveAccountId,
          fileName: null,
          lines: filled.map((r) => ({
            transactionDate: r.date,
            description: r.description.trim() || null,
            debit: amountOf(r.debit),
            credit: amountOf(r.credit),
            balance: null,
          })),
        },
      })
      reset()
      onImported(res.id)
      onOpenChange(false)
    } catch (err: unknown) {
      setError((err as Error).message || 'Lỗi khi nhập sao kê')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-x-hidden overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            Nhập Sao Kê Ngân Hàng
          </DialogTitle>
          <DialogDescription className="text-xs">
            Nhập từng dòng giao dịch vào bảng. Mỗi dòng chỉ có{' '}
            <strong>Ghi nợ (tiền ra)</strong> hoặc{' '}
            <strong>Ghi có (tiền vào)</strong>. Có thể dán nhiều dòng copy từ
            Excel vào bất kỳ ô nào.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {error && (
            <Alert
              variant="destructive"
              className="bg-rose-50 text-rose-900 border-rose-200 text-xs py-2"
            >
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tài khoản ngân hàng</Label>
            <Select
              value={effectiveAccountId ? String(effectiveAccountId) : ''}
              onValueChange={(val) => setAccountId(Number(val))}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Chọn tài khoản" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    <BankLabel image={a.bankImage} name={a.bankName}>
                      {a.bankName} — {a.accountNumber}
                    </BankLabel>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="max-h-[42vh] overflow-auto rounded-md border border-slate-200">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="text-xs">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead className="w-44">Ngày GD</TableHead>
                    <TableHead>Nội dung</TableHead>
                    <TableHead className="w-44 text-right">
                      Ghi nợ (tiền ra)
                    </TableHead>
                    <TableHead className="w-44 text-right">
                      Ghi có (tiền vào)
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow
                      key={r.key}
                      className={invalidKeys.has(r.key) ? 'bg-rose-50' : ''}
                    >
                      <TableCell className="text-center text-xs text-slate-400">
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={r.date}
                          onChange={(e) =>
                            update(r.key, { date: e.target.value })
                          }
                          onPaste={handlePaste}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.description}
                          onChange={(e) =>
                            update(r.key, { description: e.target.value })
                          }
                          onPaste={handlePaste}
                          placeholder="Nội dung giao dịch"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <MoneyInput
                          value={r.debit}
                          blankZero
                          onValueChange={(n) =>
                            update(r.key, {
                              debit: n > 0 ? String(n) : '',
                              // one side only: entering money out clears money in
                              ...(n > 0 ? { credit: '' } : {}),
                            })
                          }
                          onPaste={handlePaste}
                          className="h-8 text-right text-xs text-rose-900"
                        />
                      </TableCell>
                      <TableCell>
                        <MoneyInput
                          value={r.credit}
                          blankZero
                          onValueChange={(n) =>
                            update(r.key, {
                              credit: n > 0 ? String(n) : '',
                              ...(n > 0 ? { debit: '' } : {}),
                            })
                          }
                          onPaste={handlePaste}
                          className="h-8 text-right text-xs text-emerald-900"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeRow(r.key)}
                          className="text-slate-400 hover:text-rose-600"
                          aria-label="Xóa dòng"
                          title="Xóa dòng"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                className="h-8 gap-1 text-xs"
              >
                <Plus className="size-3.5" />
                Thêm dòng
              </Button>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>
                  Số dòng: <strong>{filled.length}</strong>
                </span>
                <span>
                  Tổng tiền ra:{' '}
                  <strong className="text-rose-900">
                    {formatVnd(totalDebit)}
                  </strong>
                </span>
                <span>
                  Tổng tiền vào:{' '}
                  <strong className="text-emerald-900">
                    {formatVnd(totalCredit)}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={importStatement.isPending || filled.length === 0}
            onClick={handleSubmit}
            className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
          >
            <Upload className="size-3.5" />
            {importStatement.isPending
              ? 'Đang nhập...'
              : `Nhập ${filled.length} dòng`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
