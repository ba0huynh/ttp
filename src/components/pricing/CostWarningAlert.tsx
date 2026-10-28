import { AlertCircle, TrendingDown, TrendingUp } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert.tsx'
import { formatVnd } from '#/lib/business.ts'

interface CostWarningAlertProps {
  sellingPrice: number
  costPrice: number
  importPrice?: number
  className?: string
}

export function CostWarningAlert({
  sellingPrice,
  costPrice,
  importPrice,
  className,
}: CostWarningAlertProps) {
  if (sellingPrice <= 0 || costPrice <= 0) return null

  const isLoss = sellingPrice < costPrice
  const diff = sellingPrice - costPrice
  const marginPercent = ((diff / costPrice) * 100).toFixed(1)

  if (isLoss) {
    return (
      <Alert
        variant="destructive"
        className={`bg-rose-50 border-rose-300 text-rose-900 ${className ?? ''}`}
      >
        <AlertCircle className="size-5 text-rose-600" />
        <AlertTitle className="font-bold flex items-center gap-1.5 text-rose-800">
          <TrendingDown className="size-4" />
          CẢNH BÁO: BÁN LỖ ({formatVnd(Math.abs(diff))}/xe)
        </AlertTitle>
        <AlertDescription className="text-xs text-rose-700 mt-1 space-y-1">
          <p>
            Giá bán đề xuất{' '}
            <strong className="underline">{formatVnd(sellingPrice)}</strong>{' '}
            đang{' '}
            <strong>thấp hơn Giá vốn thực tế ({formatVnd(costPrice)})</strong>.
          </p>
          {importPrice && (
            <p className="text-[11px] text-rose-600">
              (Lưu ý: Đơn giá nhập đã VAT là {formatVnd(importPrice)}, nhưng chi phí
              hải quan, thuế, vận chuyển phân bổ khiến giá vốn bị đội lên cao).
            </p>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div
      className={`text-xs p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between ${className ?? ''}`}
    >
      <div className="flex items-center gap-1.5 font-medium">
        <TrendingUp className="size-4 text-emerald-600" />
        <span>Biên lợi nhuận gộp:</span>
        <strong className="text-emerald-900">
          +{formatVnd(diff)} ({marginPercent}%)
        </strong>
      </div>
      <div className="text-[11px] text-emerald-700">
        Giá vốn: {formatVnd(costPrice)}
      </div>
    </div>
  )
}
