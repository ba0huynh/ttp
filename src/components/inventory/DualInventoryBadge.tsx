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
  // Case 1: Both physically delivered and financially invoiced
  if (isDelivered && isInvoiced) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1 font-medium cursor-help"
            >
              <span className="size-1.5 rounded-full bg-emerald-600" />
              Đã giao · Đã HĐ
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            Xe đã bàn giao thực tế{deliveredAt ? ` (${deliveredAt})` : ''} và đã xuất hóa đơn{invoicedAt ? ` (${invoicedAt})` : ''}.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Case 2: Invoiced financially but not physically delivered yet (awaiting truck pickup)
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
              Chưa giao · Đã HĐ
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            Xe chưa bàn giao thực tế (còn trong kho vật lý), nhưng kế toán đã lập hóa đơn ngày {invoicedAt ?? '—'}.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Case 3: Physically delivered to customer but not invoiced yet
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
              Đã giao · Chưa HĐ
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            Xe đã xuất kho thực tế giao cho khách ngày {deliveredAt ?? '—'}, nhưng chưa xuất hóa đơn.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Case 4: Neither delivered nor invoiced (available / in stock)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-700 border-slate-200 text-xs gap-1 font-medium cursor-help"
          >
            <span className="size-1.5 rounded-full bg-slate-400" />
            Chưa giao · Chưa HĐ
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          Xe nguyên tồn kho: chưa giao thực tế và chưa xuất hóa đơn tài chính.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
