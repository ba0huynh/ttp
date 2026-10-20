import { Badge } from '#/components/ui/badge.tsx'

export function SalesDeliveryBadge({
  deliveredCount,
  vehicleCount,
}: {
  deliveredCount: number
  vehicleCount: number
}) {
  const isFull = deliveredCount === vehicleCount
  return (
    <Badge
      variant="outline"
      className={`text-xs ${
        isFull
          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
          : 'bg-amber-50 text-amber-700 border-amber-300'
      }`}
    >
      {isFull ? 'Đã giao đủ' : `Đã giao ${deliveredCount}/${vehicleCount}`}
    </Badge>
  )
}

export function SalesInvoiceBadge({
  invoicedCount,
  vehicleCount,
}: {
  invoicedCount: number
  vehicleCount: number
}) {
  const isFull = invoicedCount === vehicleCount
  return (
    <Badge
      variant="outline"
      className={`text-xs ${
        isFull
          ? 'bg-blue-50 text-blue-700 border-blue-300'
          : 'bg-slate-100 text-slate-600 border-slate-200'
      }`}
    >
      {isFull
        ? 'Đã lập HĐ'
        : invoicedCount === 0
          ? 'Chưa ra HĐ'
          : 'Ra HĐ một phần'}
    </Badge>
  )
}
