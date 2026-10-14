import { Badge } from '#/components/ui/badge.tsx'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip.tsx'

interface DualInventoryBadgeProps {
  isDelivered: boolean
  isInvoiced: boolean
  deliveredAt?: string | null
  invoicedAt?: string | null
}

export function DualInventoryBadge({
  isDelivered,
  isInvoiced,
  deliveredAt,
  invoicedAt,
}: DualInventoryBadgeProps) {
  if (isDelivered && isInvoiced) {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1 font-medium"
      >
        <span className="size-1.5 rounded-full bg-emerald-600" />
        Đã giao & Đã có HĐ
      </Badge>
    )
  }

  if (!isDelivered && isInvoiced) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-800 border-amber-300 text-xs gap-1 font-medium cursor-help"
            >
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              Đã xuất HĐ — Chưa giao xe
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            Xe đã ra khỏi Kho hóa đơn ngày {invoicedAt ?? '—'}, nhưng vẫn còn
            nằm trong Kho vật lý chờ khách lấy xe.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (isDelivered && !isInvoiced) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="bg-sky-50 text-sky-800 border-sky-300 text-xs gap-1 font-medium cursor-help"
            >
              <span className="size-1.5 rounded-full bg-sky-500 animate-pulse" />
              Đã giao xe — Chưa xuất HĐ
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            Xe đã xuất khỏi Kho thực tế giao cho khách ngày {deliveredAt ?? '—'}
            , nhưng kế toán chưa lập hóa đơn.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Badge
      variant="outline"
      className="bg-slate-100 text-slate-700 border-slate-200 text-xs gap-1 font-medium"
    >
      <span className="size-1.5 rounded-full bg-slate-400" />
      Còn tồn 2 kho (Chưa bán)
    </Badge>
  )
}
