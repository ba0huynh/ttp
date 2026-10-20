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

/** One status chip with a tooltip; shared by the two single-axis badges below */
function StatusChip({
  tone,
  pulse,
  label,
  tooltip,
}: {
  tone: 'slate' | 'emerald' | 'blue' | 'amber'
  pulse?: boolean
  label: string
  tooltip: string
}) {
  const TONES = {
    slate: ['bg-slate-100 text-slate-700 border-slate-200', 'bg-slate-400'],
    emerald: [
      'bg-emerald-50 text-emerald-700 border-emerald-200',
      'bg-emerald-600',
    ],
    blue: ['bg-blue-50 text-blue-700 border-blue-200', 'bg-blue-600'],
    amber: ['bg-amber-50 text-amber-800 border-amber-300', 'bg-amber-500'],
  } as const
  const [chip, dot] = TONES[tone]
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${chip} text-xs gap-1 font-medium cursor-help`}
          >
            <span
              className={`size-1.5 rounded-full ${dot} ${pulse ? 'animate-pulse' : ''}`}
            />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * "Trạng thái": the physical warehouse only (is_delivered).
 * Amber when the vehicle is already invoiced but still in the warehouse.
 */
export function DeliveryStatusBadge({
  isDelivered,
  isInvoiced,
  deliveredAt,
}: {
  isDelivered: boolean
  isInvoiced: boolean
  deliveredAt?: string | null
}) {
  if (isDelivered)
    return (
      <StatusChip
        tone="emerald"
        label="Đã giao"
        tooltip={`Xe đã bàn giao thực tế${deliveredAt ? ` ngày ${deliveredAt}` : ''}.`}
      />
    )
  return isInvoiced ? (
    <StatusChip
      tone="amber"
      pulse
      label="Chưa giao"
      tooltip="Xe vẫn còn trong kho vật lý (đã xuất hóa đơn, đang chờ xe tới lấy)."
    />
  ) : (
    <StatusChip
      tone="slate"
      label="Chưa giao"
      tooltip="Xe còn trong kho vật lý, chưa bàn giao."
    />
  )
}

/**
 * "Trạng thái HĐ": the invoiced stock only (is_invoiced).
 * Amber when the vehicle was delivered but no invoice has been issued yet.
 */
export function InvoiceStatusBadge({
  isDelivered,
  isInvoiced,
  invoicedAt,
}: {
  isDelivered: boolean
  isInvoiced: boolean
  invoicedAt?: string | null
}) {
  if (isInvoiced)
    return (
      <StatusChip
        tone="blue"
        label="Đã HĐ"
        tooltip={`Đã xuất hóa đơn nội bộ${invoicedAt ? ` ngày ${invoicedAt}` : ''}.`}
      />
    )
  return isDelivered ? (
    <StatusChip
      tone="amber"
      pulse
      label="Chưa HĐ"
      tooltip="Xe đã giao cho khách nhưng chưa xuất hóa đơn."
    />
  ) : (
    <StatusChip
      tone="slate"
      label="Chưa HĐ"
      tooltip="Chưa xuất hóa đơn, vẫn nằm trong kho hóa đơn."
    />
  )
}
