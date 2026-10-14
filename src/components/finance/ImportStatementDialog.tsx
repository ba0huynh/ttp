import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp, Upload } from 'lucide-react'
import * as React from 'react'

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
import { Textarea } from '#/components/ui/textarea.tsx'
import { formatDate, formatVnd } from '#/lib/business.ts'
import { masterDataQuery } from '#/lib/queries.ts'
import { parseStatementText } from '#/lib/statement-import.ts'
import { importBankStatementFn } from '#/server/fns/finance.ts'

const SAMPLE = `Ngày GD\tSố tham chiếu\tNội dung\tGhi nợ\tGhi có\tSố dư
05/03/2026\tFT26064001\tCTY MOTO SAI GON TT PBX-2603-0001\t\t250.000.000\t1.250.000.000
08/03/2026\tFT26067002\tTT tien hang lo LOT-2602\t180.000.000\t\t1.070.000.000`

/** Module 10: import a bank statement by pasting rows from Excel or loading a CSV file */
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

  const [accountId, setAccountId] = React.useState<number | null>(null)
  const [text, setText] = React.useState('')
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [periodFrom, setPeriodFrom] = React.useState('')
  const [periodTo, setPeriodTo] = React.useState('')
  const [note, setNote] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const parsed = React.useMemo(() => parseStatementText(text), [text])
  const dates = parsed.lines.map((l) => l.transactionDate).sort()
  const minDate = dates[0] ?? ''
  const maxDate = dates[dates.length - 1] ?? ''
  const totalDebit = parsed.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = parsed.lines.reduce((s, l) => s + l.credit, 0)

  const effectiveAccountId = accountId ?? accounts[0]?.id ?? null
  const from = periodFrom || minDate
  const to = periodTo || maxDate

  const reset = () => {
    setAccountId(null)
    setText('')
    setFileName(null)
    setPeriodFrom('')
    setPeriodTo('')
    setNote('')
    setError(null)
  }

  const importStatement = useMutation({
    mutationFn: importBankStatementFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setText(await file.text())
    e.target.value = ''
  }

  const handleSubmit = async () => {
    setError(null)
    if (!effectiveAccountId) return setError('Chưa chọn tài khoản ngân hàng')
    if (parsed.lines.length === 0)
      return setError('Không đọc được dòng giao dịch hợp lệ nào')
    if (!from || !to || from > to) return setError('Kỳ sao kê không hợp lệ')
    try {
      const res = await importStatement.mutateAsync({
        data: {
          companyBankAccountId: effectiveAccountId,
          periodFrom: from,
          periodTo: to,
          fileName,
          note: note || null,
          lines: parsed.lines,
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            Nhập Sao Kê Ngân Hàng
          </DialogTitle>
          <DialogDescription className="text-xs">
            Dán các dòng copy từ Excel hoặc chọn file CSV. Thứ tự cột:{' '}
            <strong>
              Ngày GD | Số tham chiếu | Nội dung | Ghi nợ (tiền ra) | Ghi có
              (tiền vào) | Số dư
            </strong>{' '}
            (dòng tiêu đề sẽ tự bỏ qua).
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="text-xs font-semibold">Tài khoản ngân hàng</Label>
              <Select
                value={effectiveAccountId ? String(effectiveAccountId) : ''}
                onValueChange={(val) => setAccountId(Number(val))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Chọn tài khoản" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.bankShortName} — {a.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Từ ngày</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Đến ngày</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Dữ liệu sao kê {fileName && `(${fileName})`}
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setText(SAMPLE)}
                >
                  Dán mẫu
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  asChild
                >
                  <label className="cursor-pointer">
                    <FileUp className="size-3.5" />
                    Chọn file CSV
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt,text/csv,text/plain"
                      className="hidden"
                      onChange={handleFile}
                    />
                  </label>
                </Button>
              </div>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Dán dữ liệu từ Excel vào đây..."
              className="font-mono text-[11px] min-h-32"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Ghi chú</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {(parsed.lines.length > 0 || parsed.skippedRows.length > 0) && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>
                  Đọc được <strong>{parsed.lines.length}</strong> dòng
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
                {parsed.skippedRows.length > 0 && (
                  <span className="text-amber-700">
                    Bỏ qua dòng lỗi: {parsed.skippedRows.join(', ')}
                  </span>
                )}
              </div>
              <div className="max-h-56 overflow-auto rounded-md border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50/70">
                      <TableHead>Ngày GD</TableHead>
                      <TableHead>Tham chiếu</TableHead>
                      <TableHead>Nội dung</TableHead>
                      <TableHead className="text-right">Ghi nợ</TableHead>
                      <TableHead className="text-right">Ghi có</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {parsed.lines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">
                          {formatDate(l.transactionDate)}
                        </TableCell>
                        <TableCell className="font-mono text-slate-500">
                          {l.reference ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {l.description}
                        </TableCell>
                        <TableCell className="text-right text-rose-900">
                          {l.debit > 0 ? formatVnd(l.debit) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-emerald-900">
                          {l.credit > 0 ? formatVnd(l.credit) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
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
            disabled={importStatement.isPending || parsed.lines.length === 0}
            onClick={handleSubmit}
            className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
          >
            <Upload className="size-3.5" />
            {importStatement.isPending
              ? 'Đang nhập...'
              : `Nhập ${parsed.lines.length} dòng`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
