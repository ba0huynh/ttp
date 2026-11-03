import {
  formatErrorMessage,
  confirmDialog,
  showErrorDialog,
} from '#/components/ui/confirm-dialog.tsx'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import {
  ArrowLeft,
  AlertTriangle,
  CheckSquare,
  Download,
  Eye,
  FileCheck,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Truck,
  X,
  XCircle,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { PageHeader } from '#/components/layout/StatCard.tsx'
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Checkbox } from '#/components/ui/checkbox.tsx'
import { cn } from 'cn'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
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
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx'
import {
  TablePagination,
  usePagination,
} from '#/components/ui/table-pagination.tsx'
import { DecimalInput } from '#/components/ui/decimal-input.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import { formatDate, formatVnd, priceWithVat, todayIso } from '#/lib/business.ts'
import { currentUserQuery, salesOrderDetailQuery } from '#/lib/queries.ts'
import { hasPermission } from '#/lib/permissions.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import {
  cancelSalesOrderFn,
  recordDeliveryFn,
  recordInvoiceFn,
  updateDeliveryNoteFn,
  revertDeliveryNoteFn,
  revertInvoiceFn,
  updateInvoiceFn,
  updateSalesOrderPricingFn,
} from '#/server/fns/sales.ts'

export const Route = createFileRoute('/sales/$orderId')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'sales.view')
    return { user }
  },
  loader: async ({ context: { queryClient }, params }) => {
    const id = Number(params.orderId)
    if (!Number.isInteger(id)) throw redirect({ to: '/sales' })
    await queryClient.query(salesOrderDetailQuery(id))
  },
  errorComponent: OrderNotFound,
  component: SalesOrderPage,
})

function OrderNotFound() {
  const { user } = Route.useRouteContext()
  return (
    <AppLayout user={user}>
      <div className="py-16 text-center space-y-3">
        <p className="text-slate-600">Không tìm thấy phiếu bán này.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/sales">
            <ArrowLeft className="size-4" />
            Về danh sách phiếu bán
          </Link>
        </Button>
      </div>
    </AppLayout>
  )
}

function SalesOrderPage() {
  const { user } = Route.useRouteContext()
  const { orderId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(salesOrderDetailQuery(Number(orderId)))
  const { order, items } = data

  // Filter state for vehicles inside this order
  const [showFilters, setShowFilters] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [deliveryFilter, setDeliveryFilter] = React.useState('all')
  const [invoiceFilter, setInvoiceFilter] = React.useState('all')
  const [modelFilter, setModelFilter] = React.useState('all')
  const [colorFilter, setColorFilter] = React.useState('all')
  const [exporting, setExporting] = React.useState(false)

  const distinctModels = React.useMemo(() => {
    return Array.from(
      new Set(items.map((i) => i.modelName).filter(Boolean)),
    ).sort()
  }, [items])

  const distinctColors = React.useMemo(() => {
    const map = new Map<string, string | null>()
    for (const i of items) {
      if (i.colorName) {
        map.set(i.colorName, i.colorHex ?? null)
      }
    }
    return Array.from(map.entries())
      .map(([name, hex]) => ({ name, hex }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [items])

  // Select mode for physical vehicle delivery from inventory
  const [selectMode, setSelectMode] = React.useState(false)
  const [selectedForDelivery, setSelectedForDelivery] = React.useState<number[]>([])

  const filteredItems = React.useMemo(() => {
    return items.filter((i) => {
      // In select mode, only show cars not yet exported OR not yet invoiced
      if (selectMode && i.isDelivered && i.isInvoiced) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchChassis = i.chassisNumber?.toLowerCase().includes(q)
        const matchEngine = i.engineNumber?.toLowerCase().includes(q)
        const matchModel = i.modelName?.toLowerCase().includes(q)
        const matchColor = i.colorName?.toLowerCase().includes(q)
        if (!matchChassis && !matchEngine && !matchModel && !matchColor) return false
      }
      if (deliveryFilter === 'undelivered' && i.isDelivered) return false
      if (deliveryFilter === 'delivered' && !i.isDelivered) return false
      if (invoiceFilter === 'invoiced' && !i.isInvoiced) return false
      if (invoiceFilter === 'uninvoiced' && i.isInvoiced) return false
      if (modelFilter !== 'all' && i.modelName !== modelFilter) return false
      if (colorFilter !== 'all' && i.colorName !== colorFilter) return false
      return true
    })
  }, [
    items,
    selectMode,
    searchQuery,
    deliveryFilter,
    invoiceFilter,
    modelFilter,
    colorFilter,
  ])

  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) +
    (deliveryFilter !== 'all' ? 1 : 0) +
    (invoiceFilter !== 'all' ? 1 : 0) +
    (modelFilter !== 'all' ? 1 : 0) +
    (colorFilter !== 'all' ? 1 : 0)

  const resetFilters = () => {
    setSearchQuery('')
    setDeliveryFilter('all')
    setInvoiceFilter('all')
    setModelFilter('all')
    setColorFilter('all')
  }

  const handleExportExcel = async () => {
    if (exporting || filteredItems.length === 0) return
    setExporting(true)
    try {
      // Loaded on click so the xlsx library stays out of this page's bundle
      const { downloadSalesOrderExcel } = await import(
        '#/lib/sales-order-excel.ts'
      )
      // Written into the file so a filtered export is not mistaken for the full order
      const filters = [
        selectMode && 'Chế độ chọn: xe chưa xuất kho hoặc chưa xuất HĐ',
        searchQuery.trim() && `Tìm kiếm: "${searchQuery.trim()}"`,
        deliveryFilter === 'undelivered' && 'Kho thực tế: Còn trong kho',
        deliveryFilter === 'delivered' && 'Kho thực tế: Đã giao xe',
        invoiceFilter === 'invoiced' && 'Hóa đơn: Đã HĐ',
        invoiceFilter === 'uninvoiced' && 'Hóa đơn: Chưa HĐ',
        modelFilter !== 'all' && `Dòng xe: ${modelFilter}`,
        colorFilter !== 'all' && `Màu xe: ${colorFilter}`,
      ].filter((f): f is string => Boolean(f))
      downloadSalesOrderExcel({
        order,
        items: filteredItems,
        totalInOrder: items.length,
        filters,
      })
      toast.success(`Đã xuất ${filteredItems.length} xe ra file Excel`)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Không thể xuất Excel')
    } finally {
      setExporting(false)
    }
  }

  const itemsPg = usePagination(
    filteredItems,
    `${selectMode}|${searchQuery}|${deliveryFilter}|${invoiceFilter}|${modelFilter}|${colorFilter}`,
  )

  // In select mode every listed vehicle is selectable (it still needs export and/or invoice)
  const selectableFiltered = filteredItems
  const allSelectableChecked =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((i) => selectedForDelivery.includes(i.vehicleId))

  // Selectable vehicles on the CURRENT view page
  const pageSelectable = itemsPg.pageItems

  // What the selection can still be used for
  const selectedDeliverable = items
    .filter((i) => selectedForDelivery.includes(i.vehicleId) && !i.isDelivered)
    .map((i) => i.vehicleId)
  const selectedInvoiceable = items
    .filter((i) => selectedForDelivery.includes(i.vehicleId) && !i.isInvoiced)
    .map((i) => i.vehicleId)
  const pageAllChecked =
    pageSelectable.length > 0 &&
    pageSelectable.every((i) => selectedForDelivery.includes(i.vehicleId))
  const pageSomeChecked =
    pageSelectable.some((i) => selectedForDelivery.includes(i.vehicleId)) &&
    !pageAllChecked

  const toggleSelectVehicle = (vehicleId: number) => {
    setSelectedForDelivery((prev) =>
      prev.includes(vehicleId)
        ? prev.filter((id) => id !== vehicleId)
        : [...prev, vehicleId],
    )
  }

  // Header checkbox operates strictly on the CURRENT PAGE's visible items
  const toggleSelectPage = () => {
    if (pageAllChecked) {
      // Deselect only the vehicles on the current page
      const pageIds = new Set(pageSelectable.map((i) => i.vehicleId))
      setSelectedForDelivery((prev) => prev.filter((id) => !pageIds.has(id)))
    } else {
      // Select all undelivered vehicles on the current page (merging with existing selections)
      const pageIds = pageSelectable.map((i) => i.vehicleId)
      setSelectedForDelivery((prev) =>
        Array.from(new Set([...prev, ...pageIds])),
      )
    }
  }

  const selectAllAcrossPages = () => {
    setSelectedForDelivery(selectableFiltered.map((i) => i.vehicleId))
  }

  const deselectAll = () => {
    setSelectedForDelivery([])
  }

  const toggleSelectMode = () => {
    if (selectMode) {
      setSelectedForDelivery([])
      setSelectMode(false)
    } else {
      setSelectMode(true)
    }
  }

  // Delivery / invoicing / cancelling change physical stock, invoiced stock,
  // receivables and the dashboard together, so refresh the whole cache.
  const onSettled = () => {
    setSelectedForDelivery([])
    setSelectMode(false)
    queryClient.invalidateQueries()
  }
  const deliveryMutation = useMutation({
    mutationFn: recordDeliveryFn,
    onSuccess: onSettled,
  })
  const invoiceMutation = useMutation({
    mutationFn: recordInvoiceFn,
    onSuccess: onSettled,
  })
  const cancelMutation = useMutation({
    mutationFn: cancelSalesOrderFn,
    onSuccess: onSettled,
  })
  const updateDeliveryMutation = useMutation({
    mutationFn: updateDeliveryNoteFn,
    onSuccess: onSettled,
  })
  const updateInvoiceMutation = useMutation({
    mutationFn: updateInvoiceFn,
    onSuccess: onSettled,
  })
  const revertInvoiceMutation = useMutation({
    mutationFn: revertInvoiceFn,
    onSuccess: onSettled,
  })
  const revertDeliveryMutation = useMutation({
    mutationFn: revertDeliveryNoteFn,
    onSuccess: onSettled,
  })
  const updatePricingMutation = useMutation({
    mutationFn: updateSalesOrderPricingFn,
    onSuccess: onSettled,
  })

  type OrderItem = (typeof items)[number]
  const [editingItem, setEditingItem] = React.useState<OrderItem | null>(null)
  const [editPriceBeforeVat, setEditPriceBeforeVat] = React.useState(0)
  const [editVatRate, setEditVatRate] = React.useState(0)
  const [editPricingError, setEditPricingError] = React.useState<string | null>(null)

  const [batchPricingOpen, setBatchPricingOpen] = React.useState(false)
  const [batchVatRate, setBatchVatRate] = React.useState<number>(10)
  const [applyVatToBatch, setApplyVatToBatch] = React.useState(true)
  const [batchPriceBeforeVat, setBatchPriceBeforeVat] = React.useState<number>(0)
  const [applyPriceToBatch, setApplyPriceToBatch] = React.useState(false)
  const [batchPricingError, setBatchPricingError] = React.useState<string | null>(null)

  const [deliveryDialogOpen, setDeliveryDialogOpen] = React.useState(false)
  // Editable delivery fields of the vehicle detail dialog
  const [dDate, setDDate] = React.useState(todayIso())
  const [dReceiver, setDReceiver] = React.useState('')
  const [dTransport, setDTransport] = React.useState('')
  const [detailError, setDetailError] = React.useState<string | null>(null)
  // Editable invoice fields of the same dialog
  const [iNumber, setINumber] = React.useState('')
  const [iDate, setIDate] = React.useState(todayIso())
  const [invoiceError, setInvoiceError] = React.useState<string | null>(null)

  const [invoiceDialogOpen, setInvoiceDialogOpen] = React.useState(false)
  const [selectedVehicles, setSelectedVehicles] = React.useState<number[]>([])
  const [deliveryDate, setDeliveryDate] = React.useState(todayIso())
  const [receiverName, setReceiverName] = React.useState('')
  const [transportInfo, setTransportInfo] = React.useState('')
  const [invoiceDate, setInvoiceDate] = React.useState(todayIso())
  const [invoiceNumber, setInvoiceNumber] = React.useState('')
  const [actionError, setActionError] = React.useState<string | null>(null)
  const actionLoading =
    deliveryMutation.isPending ||
    invoiceMutation.isPending ||
    updateDeliveryMutation.isPending ||
    updateInvoiceMutation.isPending ||
    revertDeliveryMutation.isPending ||
    revertInvoiceMutation.isPending ||
    updatePricingMutation.isPending

  const canManageSales = hasPermission(user, 'sales.create')
  const canDeliver = hasPermission(user, 'sales.deliver')
  const canInvoice = hasPermission(user, 'sales.invoice')
  const canCancel = items.every((i) => !i.isDelivered && !i.isInvoiced)

  const openDeliveryModal = () => {
    // Only vehicles that have NOT been delivered yet
    setSelectedVehicles(
      items.filter((v) => !v.isDelivered).map((v) => v.vehicleId),
    )
    setDeliveryDate(todayIso())
    setReceiverName('')
    setTransportInfo('')
    setActionError(null)
    setDeliveryDialogOpen(true)
  }

  const openSingleDeliveryModal = (vehicleId: number) => {
    setSelectedVehicles([vehicleId])
    setDeliveryDate(todayIso())
    setReceiverName('')
    setTransportInfo('')
    setActionError(null)
    setDeliveryDialogOpen(true)
  }

  const handleSaveDeliveryEdit = async (v: OrderItem) => {
    if (!v.deliveryNoteId) return
    setDetailError(null)
    try {
      await updateDeliveryMutation.mutateAsync({
        data: {
          salesOrderId: order.id,
          deliveryNoteId: v.deliveryNoteId,
          deliveryDate: dDate,
          receiverName: dReceiver || null,
          transportInfo: dTransport || null,
          note: v.deliveryNoteContent || null,
        },
      })
    } catch (err: unknown) {
      setDetailError(formatErrorMessage(err, 'Lỗi khi cập nhật phiếu giao'))
    }
  }

  const openBatchDeliveryModal = () => {
    if (selectedDeliverable.length === 0) return
    setSelectedVehicles(selectedDeliverable)
    setDeliveryDate(todayIso())
    setReceiverName('')
    setTransportInfo('')
    setActionError(null)
    setDeliveryDialogOpen(true)
  }

  const openBatchInvoiceModal = () => {
    if (selectedInvoiceable.length === 0) return
    setSelectedVehicles(selectedInvoiceable)
    setInvoiceDate(todayIso())
    setInvoiceNumber('')
    setActionError(null)
    setInvoiceDialogOpen(true)
  }

  const openInvoiceModal = () => {
    // Only vehicles that have NOT been invoiced yet
    setSelectedVehicles(
      items.filter((v) => !v.isInvoiced).map((v) => v.vehicleId),
    )
    setInvoiceDate(todayIso())
    setInvoiceNumber('')
    setActionError(null)
    setInvoiceDialogOpen(true)
  }

  // One vehicle -> one invoice, so a single row can be invoiced on its own
  const openSingleInvoiceModal = (vehicleId: number) => {
    setSelectedVehicles([vehicleId])
    setInvoiceDate(todayIso())
    setInvoiceNumber('')
    setActionError(null)
    setInvoiceDialogOpen(true)
  }

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedVehicles.length === 0) return
    setActionError(null)
    try {
      await deliveryMutation.mutateAsync({
        data: {
          salesOrderId: order.id,
          vehicleIds: selectedVehicles,
          deliveryDate,
          receiverName,
          transportInfo,
        },
      })
      setDeliveryDialogOpen(false)
    } catch (err: unknown) {
      setActionError(formatErrorMessage(err, 'Lỗi khi ghi nhận giao xe'))
    }
  }

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedVehicles.length === 0) return
    setActionError(null)
    try {
      await invoiceMutation.mutateAsync({
        data: {
          salesOrderId: order.id,
          vehicleIds: selectedVehicles,
          invoiceDate,
          // A custom number only applies when a single vehicle is invoiced
          invoiceNumber:
            selectedVehicles.length === 1 ? invoiceNumber || undefined : undefined,
        },
      })
      setInvoiceDialogOpen(false)
    } catch (err: unknown) {
      setActionError(formatErrorMessage(err, 'Lỗi khi lập hóa đơn'))
    }
  }

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    setEditPricingError(null)
    try {
      await updatePricingMutation.mutateAsync({
        data: {
          salesOrderId: order.id,
          items: [
            {
              itemId: editingItem.id,
              priceBeforeVat: editPriceBeforeVat,
              vatRate: editVatRate,
            },
          ],
        },
      })
      setEditingItem(null)
    } catch (err: unknown) {
      setEditPricingError(formatErrorMessage(err, 'Lỗi khi cập nhật giá bán / VAT'))
    }
  }

  const handleBatchPricingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedForDelivery.length === 0) return
    if (!applyVatToBatch && !applyPriceToBatch) {
      setBatchPricingError('Vui lòng chọn áp dụng % VAT hoặc Đơn giá chưa VAT')
      return
    }
    setBatchPricingError(null)

    const selectedVehiclesList = items.filter((it) =>
      selectedForDelivery.includes(it.vehicleId),
    )

    const payloadItems = selectedVehiclesList.map((it) => ({
      itemId: it.id,
      priceBeforeVat: applyPriceToBatch ? batchPriceBeforeVat : it.priceBeforeVat,
      vatRate: applyVatToBatch ? batchVatRate : it.vatRate,
    }))

    try {
      await updatePricingMutation.mutateAsync({
        data: {
          salesOrderId: order.id,
          items: payloadItems,
        },
      })
      setBatchPricingOpen(false)
    } catch (err: unknown) {
      setBatchPricingError(formatErrorMessage(err, 'Lỗi khi cập nhật giá bán / VAT'))
    }
  }

  // Vehicle detail dialog: export + invoice details with their actions
  const [detailVehicleId, setDetailVehicleId] = React.useState<number | null>(
    null,
  )
  const detailItem = items.find((i) => i.vehicleId === detailVehicleId) ?? null
  const savedDelivery = (v: OrderItem) => ({
    date:
      v.deliveryDate ||
      (v.deliveredAt ? String(v.deliveredAt).slice(0, 10) : todayIso()),
    receiver: v.receiverName || '',
    transport: v.transportInfo || '',
  })
  React.useEffect(() => {
    const v = items.find((i) => i.vehicleId === detailVehicleId)
    if (!v) return
    const saved = savedDelivery(v)
    setDDate(saved.date)
    setDReceiver(saved.receiver)
    setDTransport(saved.transport)
    setINumber(v.invoiceNumber || '')
    setIDate(
      v.invoiceDate ||
        (v.invoicedAt ? String(v.invoicedAt).slice(0, 10) : todayIso()),
    )
    setInvoiceError(null)
    setDetailError(null)
    // Only when another vehicle is opened (not after every refetch)
  }, [detailVehicleId])

  // Save only appears once a delivery field differs from what is stored
  const deliveryDirty = (() => {
    if (!detailItem?.isDelivered) return false
    const saved = savedDelivery(detailItem)
    return (
      dDate !== saved.date ||
      dReceiver !== saved.receiver ||
      dTransport !== saved.transport
    )
  })()

  const invoiceDirty = (() => {
    if (!detailItem?.isInvoiced) return false
    const savedDate =
      detailItem.invoiceDate ||
      (detailItem.invoicedAt
        ? String(detailItem.invoicedAt).slice(0, 10)
        : todayIso())
    return (
      iNumber !== (detailItem.invoiceNumber || '') || iDate !== savedDate
    )
  })()

  const handleSaveInvoiceEdit = async (v: OrderItem) => {
    setInvoiceError(null)
    try {
      await updateInvoiceMutation.mutateAsync({
        data: {
          salesOrderId: order.id,
          vehicleId: v.vehicleId,
          invoiceNumber: iNumber,
          invoiceDate: iDate,
        },
      })
    } catch (err: unknown) {
      setInvoiceError(formatErrorMessage(err, 'Lỗi khi cập nhật hóa đơn'))
    }
  }

  const handleRevertDeliveryOf = async (v: OrderItem) => {
    const sameNote = v.deliveryNoteId
      ? items.filter((it) => it.deliveryNoteId === v.deliveryNoteId).length
      : 1
    if (
      !(await confirmDialog({
        title: `Hủy xuất kho xe ${v.chassisNumber}?`,
        description:
          'Xe sẽ được hoàn trả về trạng thái tồn kho thực tế. Hóa đơn của xe (nếu có) không đổi.',
        confirmLabel: 'Hủy xuất kho',
        cancelLabel: 'Giữ lại',
        destructive: true,
      }))
    )
      return
    try {
      await revertDeliveryMutation.mutateAsync({
        data: {
          salesOrderId: order.id,
          deliveryNoteId: v.deliveryNoteId ?? undefined,
          vehicleId: sameNote > 1 || !v.deliveryNoteId ? v.vehicleId : undefined,
        },
      })
    } catch (err: unknown) {
      await showErrorDialog(err, 'Không thể hủy xuất kho')
    }
  }

  const handleRevertInvoice = async (v: OrderItem) => {
    if (
      !(await confirmDialog({
        title: `Hủy hóa đơn xe ${v.chassisNumber}?`,
        description:
          'Xe sẽ trở lại trạng thái chưa xuất hóa đơn và hóa đơn của xe này bị xóa. Kho thực tế không đổi.',
        confirmLabel: 'Hủy hóa đơn',
        cancelLabel: 'Giữ lại',
        destructive: true,
      }))
    )
      return
    try {
      await revertInvoiceMutation.mutateAsync({
        data: { salesOrderId: order.id, vehicleId: v.vehicleId },
      })
    } catch (err: unknown) {
      await showErrorDialog(err, 'Không thể hủy hóa đơn')
    }
  }

  const handleCancelOrder = async () => {
    if (
      !(await confirmDialog({
        title: 'Hủy phiếu bán xe này?',
        description: 'Các xe sẽ được trả lại trạng thái chưa bán.',
        confirmLabel: 'Hủy phiếu bán',
        cancelLabel: 'Giữ lại',
        destructive: true,
      }))
    )
      return
    try {
      await cancelMutation.mutateAsync({ data: { orderId: order.id } })
      await navigate({ to: '/sales' })
    } catch (err: unknown) {
      await showErrorDialog(err, 'Không thể hủy phiếu bán')
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={
            <Link
              to="/sales"
              className="inline-flex items-center gap-1 hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Danh sách phiếu bán
            </Link>
          }
          title={`Phiếu bán #${order.id}`}
          description={
            <>
              Khách hàng: <strong>{order.customerName}</strong> · Điểm bán:{' '}
              <strong>{order.branchName ?? 'Trực tiếp'}</strong> · Ngày
              bán: {formatDate(order.orderDate)}
            </>
          }
          actions={
            <>
              {canDeliver && items.some((i) => !i.isDelivered) && (
                <Button size="sm" onClick={openDeliveryModal}>
                  <Truck className="size-4" />
                  Giao xe thực tế
                </Button>
              )}
              {canInvoice && items.some((i) => !i.isInvoiced) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={openInvoiceModal}
                >
                  <FileCheck className="size-4" />
                  Xuất hóa đơn nội bộ
                </Button>
              )}
              {canCancel && hasPermission(user, 'sales.create') && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  disabled={cancelMutation.isPending}
                  onClick={handleCancelOrder}
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <XCircle className="size-4" />
                  )}
                  {cancelMutation.isPending ? 'Đang hủy...' : 'Hủy phiếu bán'}
                </Button>
              )}
            </>
          }
        />

        <Card>
          <CardHeader className="border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800">
                {selectMode
                  ? `Chọn xe chưa xuất kho hoặc chưa xuất hóa đơn (${filteredItems.length})`
                  : `Danh sách xe trong phiếu (${items.length})`}
              </CardTitle>
              {activeFilterCount > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Đang hiển thị {filteredItems.length}/{items.length} xe theo bộ lọc
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <Input
                  placeholder="Tìm số khung, dòng xe..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs rounded-lg bg-white"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFilters(true)}
                aria-haspopup="dialog"
                className={`h-8 gap-1.5 text-xs ${activeFilterCount > 0 ? 'border-emerald-600 text-emerald-800 font-semibold' : ''}`}
              >
                <SlidersHorizontal className="size-3.5" />
                Bộ lọc
                {activeFilterCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-emerald-700 text-white text-[10px] px-1.5 font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleExportExcel()}
                disabled={exporting || filteredItems.length === 0}
                title={`Xuất ${filteredItems.length} xe theo bộ lọc hiện tại`}
                className="h-8 gap-1.5 text-xs"
              >
                {exporting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                {exporting ? 'Đang xuất...' : 'Xuất Excel'}
              </Button>
              {(canDeliver || canInvoice) &&
                items.some((i) => !i.isDelivered || !i.isInvoiced) && (
                <Button
                  size="sm"
                  variant={selectMode ? 'default' : 'outline'}
                  onClick={toggleSelectMode}
                  className={`h-8 gap-1.5 text-xs ${
                    selectMode
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white font-semibold'
                      : 'border-slate-300 text-slate-700'
                  }`}
                >
                  {selectMode ? (
                    <>
                      <X className="size-3.5" />
                      Thoát chọn
                    </>
                  ) : (
                    <>
                      <CheckSquare className="size-3.5" />
                      Chế độ chọn
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          {selectMode && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-950">
                <span className="font-semibold">Đang chọn xe:</span>
                <Badge
                  variant="outline"
                  className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[11px]"
                >
                  {selectedForDelivery.length} xe
                </Badge>
                {selectedForDelivery.length > 0 && (
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-rose-600 hover:underline font-medium ml-2 cursor-pointer"
                  >
                    Bỏ chọn tất cả
                  </button>
                )}
                {selectableFiltered.length > pageSelectable.length &&
                  !allSelectableChecked && (
                    <button
                      type="button"
                      onClick={selectAllAcrossPages}
                      className="text-emerald-700 hover:underline font-medium ml-2 cursor-pointer"
                    >
                      Chọn tất cả {selectableFiltered.length} xe trong phiếu
                    </button>
                  )}
              </div>
              <div className="flex items-center gap-2">
                {canInvoice && (
                  <Button
                    size="sm"
                    disabled={selectedInvoiceable.length === 0}
                    onClick={openBatchInvoiceModal}
                    className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1.5"
                  >
                    <FileCheck className="size-3.5" />
                    Xuất hóa đơn{' '}
                    {selectedInvoiceable.length > 0
                      ? `(${selectedInvoiceable.length})`
                      : ''}{' '}
                    xe đã chọn
                  </Button>
                )}
                {canManageSales && (
                  <Button
                    size="sm"
                    disabled={selectedForDelivery.length === 0}
                    onClick={() => {
                      const first = items.find((it) => it.vehicleId === selectedForDelivery[0])
                      setBatchVatRate(first?.vatRate ?? 10)
                      setBatchPriceBeforeVat(first?.priceBeforeVat ?? 0)
                      setApplyVatToBatch(true)
                      setApplyPriceToBatch(false)
                      setBatchPricingError(null)
                      setBatchPricingOpen(true)
                    }}
                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
                  >
                    <Pencil className="size-3.5" />
                    Sửa giá{' '}
                    {selectedForDelivery.length > 0
                      ? `(${selectedForDelivery.length})`
                      : ''}{' '}
                    xe đã chọn
                  </Button>
                )}
                {canDeliver && (
                <Button
                  size="sm"
                  disabled={selectedDeliverable.length === 0}
                  onClick={openBatchDeliveryModal}
                  className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1.5"
                >
                  <Truck className="size-3.5" />
                  Xuất kho{' '}
                  {selectedDeliverable.length > 0
                    ? `(${selectedDeliverable.length})`
                    : ''}{' '}
                  xe đã chọn
                </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggleSelectMode}
                  className="h-7 text-xs text-slate-600 hover:text-slate-900"
                >
                  Hủy
                </Button>
              </div>
            </div>
          )}
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {selectMode && (
                      <TableHead className="w-10 text-center">
                        <Checkbox
                          checked={
                            pageAllChecked
                              ? true
                              : pageSomeChecked
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={toggleSelectPage}
                          disabled={pageSelectable.length === 0}
                          aria-label="Chọn tất cả xe trên trang này"
                        />
                      </TableHead>
                    )}
                    <TableHead>Số Khung</TableHead>
                    <TableHead>Dòng xe / Màu</TableHead>
                    <TableHead className="text-right">Đơn Giá Chưa VAT</TableHead>
                    <TableHead className="text-right">% VAT</TableHead>
                    <TableHead className="text-right">Đơn Giá Bán Đã VAT</TableHead>
                    <TableHead className="text-center">Kho Thực Tế</TableHead>
                    <TableHead className="text-center">Kho Hóa Đơn</TableHead>
                    {!selectMode && (
                      <TableHead className="w-28 text-center">Thao tác</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {itemsPg.pageItems.map((i) => {
                    const isSelected = selectedForDelivery.includes(i.vehicleId)
                    return (
                      <TableRow
                        key={i.id}
                        className={cn(
                          selectMode && 'cursor-pointer',
                          selectMode && isSelected && 'bg-emerald-50/70',
                        )}
                        onClick={(e) => {
                          if (selectMode) {
                            const target = e.target as HTMLElement
                            if (!target.closest('button') && !target.closest('a')) {
                              toggleSelectVehicle(i.vehicleId)
                            }
                          }
                        }}
                      >
                        {selectMode && (
                          <TableCell
                            className="text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() =>
                                toggleSelectVehicle(i.vehicleId)
                              }
                              aria-label={`Chọn xe ${i.chassisNumber}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-medium text-slate-900">
                          {i.chassisNumber}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">
                            {i.modelName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {i.colorName}
                          </div>
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-medium text-slate-900',
                            canManageSales &&
                              !selectMode &&
                              'cursor-pointer hover:text-amber-700 hover:bg-amber-50/60 transition-colors',
                          )}
                          onClick={(e) => {
                            if (canManageSales && !selectMode) {
                              e.stopPropagation()
                              setEditingItem(i)
                              setEditPriceBeforeVat(i.priceBeforeVat)
                              setEditVatRate(i.vatRate)
                              setEditPricingError(null)
                            }
                          }}
                          title={
                            canManageSales && !selectMode
                              ? `Bấm để sửa đơn giá chưa VAT xe ${i.chassisNumber}`
                              : undefined
                          }
                        >
                          {formatVnd(i.priceBeforeVat)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right text-slate-600 font-medium',
                            canManageSales &&
                              !selectMode &&
                              'cursor-pointer hover:text-amber-700 hover:bg-amber-50/60 transition-colors',
                          )}
                          onClick={(e) => {
                            if (canManageSales && !selectMode) {
                              e.stopPropagation()
                              setEditingItem(i)
                              setEditPriceBeforeVat(i.priceBeforeVat)
                              setEditVatRate(i.vatRate)
                              setEditPricingError(null)
                            }
                          }}
                          title={
                            canManageSales && !selectMode
                              ? `Bấm để sửa % VAT xe ${i.chassisNumber}`
                              : undefined
                          }
                        >
                          {i.vatRate}%
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900">
                          {formatVnd(i.unitPrice)}
                        </TableCell>
                        <TableCell
                          className="text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Click: deliver this vehicle, or open its delivery (view / edit / cancel) */}
                          <button
                            type="button"
                            disabled={!canDeliver || actionLoading}
                            onClick={() =>
                              i.isDelivered
                                ? handleRevertDeliveryOf(i)
                                : openSingleDeliveryModal(i.vehicleId)
                            }
                            title={
                              !canDeliver
                                ? undefined
                                : i.isDelivered
                                  ? `Bấm để hủy xuất kho xe ${i.chassisNumber}`
                                  : `Bấm để xuất kho xe ${i.chassisNumber}`
                            }
                            className={canDeliver ? 'cursor-pointer' : ''}
                          >
                            <Badge
                              variant="outline"
                              className={`text-[11px] ${
                                i.isDelivered
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : 'bg-amber-50 text-amber-700 border-amber-300'
                              } ${canDeliver ? 'hover:ring-2 hover:ring-emerald-200' : ''}`}
                            >
                              {i.isDelivered
                                ? `Đã giao (${formatDate(i.deliveredAt)})`
                                : 'Còn trong kho thực tế'}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell
                          className="text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Click toggles the invoice: issue one / cancel it */}
                          <button
                            type="button"
                            disabled={!canInvoice || actionLoading}
                            onClick={() =>
                              i.isInvoiced
                                ? handleRevertInvoice(i)
                                : openSingleInvoiceModal(i.vehicleId)
                            }
                            title={
                              !canInvoice
                                ? undefined
                                : i.isInvoiced
                                  ? `Bấm để hủy hóa đơn xe ${i.chassisNumber}`
                                  : `Bấm để xuất hóa đơn xe ${i.chassisNumber}`
                            }
                            className={canInvoice ? 'cursor-pointer' : ''}
                          >
                            <Badge
                              variant="outline"
                              className={`text-[11px] ${
                                i.isInvoiced
                                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              } ${canInvoice ? 'hover:ring-2 hover:ring-blue-200' : ''}`}
                            >
                              {i.isInvoiced
                                ? `Đã xuất HĐ (${formatDate(i.invoicedAt)})`
                                : 'Chưa xuất HĐ'}
                            </Badge>
                          </button>
                        </TableCell>
                        {!selectMode && (
                          <TableCell className="text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {canManageSales && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-50 gap-1 font-medium px-2"
                                  onClick={() => {
                                    setEditingItem(i)
                                    setEditPriceBeforeVat(i.priceBeforeVat)
                                    setEditVatRate(i.vatRate)
                                    setEditPricingError(null)
                                  }}
                                  title={`Sửa đơn giá chưa VAT & % VAT xe ${i.chassisNumber}`}
                                >
                                  <Pencil className="size-3 text-amber-600" />
                                  Sửa giá
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-blue-300 text-blue-800 hover:bg-blue-50 gap-1.5 font-medium px-2.5"
                                onClick={() => setDetailVehicleId(i.vehicleId)}
                                title={`Xem chi tiết xuất kho / hóa đơn xe ${i.chassisNumber}`}
                              >
                                <Eye className="size-3.5 text-blue-600" />
                                Xem
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                  {filteredItems.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-10 text-center text-xs text-slate-400 italic"
                      >
                        {selectMode
                          ? 'Tất cả các xe trong phiếu đã được xuất kho và xuất hóa đơn.'
                          : 'Không tìm thấy xe nào phù hợp với bộ lọc hiện tại.'}
                        {!selectMode && activeFilterCount > 0 && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="ml-2 text-emerald-700 underline font-medium not-italic"
                          >
                            Xóa bộ lọc
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination pagination={itemsPg} />
          </CardContent>
        </Card>

        {/* Physical Vehicle Delivery Modal */}
        <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Truck className="size-4 text-emerald-600" />
                Lập Phiếu Giao Xe Thực Tế
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ghi nhận thời điểm xe rời kho vật lý giao cho tài xế/khách hàng.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleDeliverySubmit} className="space-y-3 pt-2">
              {actionError && (
                <Alert variant="destructive" className="text-xs py-2">
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Ngày Giao Hàng *
                </Label>
                <Input
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Tên Người/Tài Xế Nhận Xe
                </Label>
                <Input
                  placeholder="Ví dụ: Anh Nam (Lái xe đại lý)"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Thông Tin Phương Tiện / Biển Số Xe Tải
                </Label>
                <Input
                  placeholder="Ví dụ: Xe lồng biển số 51C-123.45"
                  value={transportInfo}
                  onChange={(e) => setTransportInfo(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="text-xs font-semibold text-slate-700 pt-2">
                Số lượng xe xuất kho thực tế:{' '}
                <strong>{selectedVehicles.length} chiếc</strong>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeliveryDialogOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading || selectedVehicles.length === 0}
                  size="sm"
                  className="h-8 text-xs font-semibold"
                >
                  {actionLoading ? 'Đang lưu...' : 'Xác Nhận Xuất Kho Giao Xe'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Vehicle detail: export + invoice, with actions. Stays open underneath the
            export / invoice / edit dialogs opened from it */}
        {detailItem !== null && (
        <Dialog
          open={detailItem !== null}
          onOpenChange={(o) => !o && setDetailVehicleId(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Chi Tiết Xe {detailItem?.chassisNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Xuất kho và hóa đơn của xe là 2 nghiệp vụ độc lập.
              </DialogDescription>
            </DialogHeader>
            {detailItem && (
              <div className="space-y-3 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      Số khung: {detailItem.chassisNumber}
                    </span>
                    <span className="font-medium text-slate-700">
                      {detailItem.colorName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Dòng xe: {detailItem.modelName || '—'}</span>
                    <span>Số máy: {detailItem.engineNumber || '—'}</span>
                  </div>
                  <div className="text-slate-600">
                    Đơn giá bán đã VAT:{' '}
                    <strong className="text-slate-900">
                      {formatVnd(detailItem.unitPrice)}
                    </strong>
                  </div>
                </div>

                {/* Export */}
                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Truck className="size-3.5 text-emerald-600" />
                      Xuất kho thực tế
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${
                        detailItem.isDelivered
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-amber-50 text-amber-700 border-amber-300'
                      }`}
                    >
                      {detailItem.isDelivered ? 'Đã xuất kho' : 'Chưa xuất kho'}
                    </Badge>
                  </div>
                  {detailItem.isDelivered && (
                    <div className="space-y-2">
                      <div className="text-slate-600">
                        Mã phiếu giao:{' '}
                        <strong className="text-slate-900">
                          {detailItem.deliveryNoteNumber || '—'}
                        </strong>
                      </div>
                      {detailError && (
                        <Alert variant="destructive" className="text-xs py-2">
                          <AlertDescription>{detailError}</AlertDescription>
                        </Alert>
                      )}
                      <div className="grid grid-cols-1 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">
                            Ngày giao hàng
                          </Label>
                          <Input
                            type="date"
                            disabled={!canDeliver}
                            value={dDate}
                            onChange={(e) => setDDate(e.target.value)}
                            className="h-9 text-sm px-3 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">
                            Người / tài xế nhận xe
                          </Label>
                          <Input
                            disabled={!canDeliver}
                            value={dReceiver}
                            onChange={(e) => setDReceiver(e.target.value)}
                            className="h-9 text-sm px-3 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">
                            Phương tiện / biển số xe tải
                          </Label>
                          <Input
                            disabled={!canDeliver}
                            value={dTransport}
                            onChange={(e) => setDTransport(e.target.value)}
                            className="h-9 text-sm px-3 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {canDeliver && (
                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      {detailItem.isDelivered ? (
                        <>
                          {deliveryDirty && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                actionLoading || !detailItem.deliveryNoteId
                              }
                              className="h-8 text-xs"
                              onClick={() => handleSaveDeliveryEdit(detailItem)}
                            >
                              Lưu thay đổi
                            </Button>
                          )}
                          <Button
                            size="sm"
                            disabled={actionLoading}
                            className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                            onClick={() => handleRevertDeliveryOf(detailItem)}
                          >
                            <RotateCcw className="size-3.5" />
                            Hủy xuất kho
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
                          onClick={() => openSingleDeliveryModal(detailItem.vehicleId)}
                        >
                          <Truck className="size-3.5" />
                          Xuất kho
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Invoice */}
                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <FileCheck className="size-3.5 text-blue-600" />
                      Hóa đơn nội bộ
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${
                        detailItem.isInvoiced
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {detailItem.isInvoiced ? 'Đã xuất HĐ' : 'Chưa xuất HĐ'}
                    </Badge>
                  </div>
                  {detailItem.isInvoiced && (
                    <div className="space-y-2">
                      {invoiceError && (
                        <Alert variant="destructive" className="text-xs py-2">
                          <AlertDescription>{invoiceError}</AlertDescription>
                        </Alert>
                      )}
                      <div className="grid grid-cols-1 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">
                            Số hóa đơn
                          </Label>
                          <Input
                            disabled={!canInvoice}
                            value={iNumber}
                            onChange={(e) => setINumber(e.target.value)}
                            className="h-9 text-sm px-3 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">
                            Ngày xuất hóa đơn
                          </Label>
                          <Input
                            type="date"
                            disabled={!canInvoice}
                            value={iDate}
                            onChange={(e) => setIDate(e.target.value)}
                            className="h-9 text-sm px-3 rounded-lg"
                          />
                        </div>
                        <div className="text-slate-600">
                          Số tiền:{' '}
                          <strong className="text-slate-900">
                            {formatVnd(detailItem.unitPrice)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}
                  {canInvoice && (
                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      {detailItem.isInvoiced ? (
                        <>
                        {invoiceDirty && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionLoading || !iNumber.trim()}
                            className="h-8 text-xs"
                            onClick={() => handleSaveInvoiceEdit(detailItem)}
                          >
                            Lưu thay đổi
                          </Button>
                        )}
                        <Button
                          size="sm"
                          disabled={actionLoading}
                          className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                          onClick={() => handleRevertInvoice(detailItem)}
                        >
                          <RotateCcw className="size-3.5" />
                          Hủy hóa đơn
                        </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
                          onClick={() => openSingleInvoiceModal(detailItem.vehicleId)}
                        >
                          <FileCheck className="size-3.5" />
                          Xuất hóa đơn
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setDetailVehicleId(null)}
              >
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}

        {/* Internal Commercial Invoice Modal */}
        <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <FileCheck className="size-4 text-blue-600" />
                Lập Hóa Đơn Xuất Bán Nội Bộ
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ghi nhận giảm kho hóa đơn và phát sinh công nợ phải thu cho pháp
                nhân nhận xe.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleInvoiceSubmit} className="space-y-3 pt-2">
              {actionError && (
                <Alert variant="destructive" className="text-xs py-2">
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Ngày Xuất Hóa Đơn *
                </Label>
                <Input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Số Hóa Đơn (Tự sinh nếu để trống)
                </Label>
                <Input
                  placeholder={
                    selectedVehicles.length > 1
                      ? 'Mỗi xe một hóa đơn: số hóa đơn tự sinh'
                      : 'Ví dụ: HD-260120-001'
                  }
                  disabled={selectedVehicles.length > 1}
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="text-xs font-semibold text-slate-700 pt-2">
                Số lượng xe lập hóa đơn:{' '}
                <strong>{selectedVehicles.length} chiếc</strong>
                {selectedVehicles.length > 1 && (
                  <span className="block font-normal text-slate-500 mt-0.5">
                    Mỗi xe được xuất thành một hóa đơn riêng.
                  </span>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoiceDialogOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {actionLoading ? 'Đang lưu...' : 'Xác Nhận Xuất Hóa Đơn'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {/* Filter Dialog */}
        <Dialog open={showFilters} onOpenChange={setShowFilters}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <SlidersHorizontal className="size-4 text-emerald-600" />
                Bộ Lọc Danh Sách Xe
              </DialogTitle>
              <DialogDescription className="text-xs">
                Lọc danh sách xe trong phiếu bán #{order.id} ({filteredItems.length}/{items.length} xe phù hợp)
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tìm kiếm</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                  <Input
                    placeholder="Số khung, số máy, tên dòng xe, màu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 pl-8 text-xs rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Kho Thực Tế</Label>
                <SearchSelect
                  className="h-10 text-xs rounded-lg"
                  value={deliveryFilter}
                  onValueChange={setDeliveryFilter}
                >
                  <SearchSelectItem value="all">Tất cả kho thực tế</SearchSelectItem>
                  <SearchSelectItem value="undelivered">Còn trong kho</SearchSelectItem>
                  <SearchSelectItem value="delivered">Đã giao xe</SearchSelectItem>
                </SearchSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Trạng thái xuất hóa đơn
                </Label>
                <SearchSelect
                  className="h-10 text-xs rounded-lg"
                  value={invoiceFilter}
                  onValueChange={setInvoiceFilter}
                >
                  <SearchSelectItem value="all">
                    Tất cả trạng thái hóa đơn
                  </SearchSelectItem>
                  <SearchSelectItem value="invoiced">Đã HĐ</SearchSelectItem>
                  <SearchSelectItem value="uninvoiced">Chưa HĐ</SearchSelectItem>
                </SearchSelect>
              </div>

              {distinctModels.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Dòng xe</Label>
                  <SearchSelect
                    className="h-10 text-xs rounded-lg"
                    value={modelFilter}
                    onValueChange={setModelFilter}
                  >
                    <SearchSelectItem value="all">
                      Tất cả dòng xe ({distinctModels.length})
                    </SearchSelectItem>
                    {distinctModels.map((m) => (
                      <SearchSelectItem key={m} value={m}>
                        {m}
                      </SearchSelectItem>
                    ))}
                  </SearchSelect>
                </div>
              )}

              {distinctColors.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Màu xe</Label>
                  <SearchSelect
                    className="h-10 text-xs rounded-lg"
                    value={colorFilter}
                    onValueChange={setColorFilter}
                  >
                    <SearchSelectItem value="all">
                      Tất cả màu xe ({distinctColors.length})
                    </SearchSelectItem>
                    {distinctColors.map((c) => (
                      <SearchSelectItem key={c.name} value={c.name} keywords={c.name}>
                        {c.name}
                      </SearchSelectItem>
                    ))}
                  </SearchSelect>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                className="h-8 text-xs text-slate-500 hover:text-slate-800"
              >
                <RotateCcw className="size-3 mr-1" />
                Đặt lại
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowFilters(false)}
                className="h-8 text-xs font-semibold"
              >
                Áp dụng ({filteredItems.length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Single Vehicle Pricing Dialog */}
        <Dialog
          open={Boolean(editingItem)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingItem(null)
              setEditPricingError(null)
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Pencil className="size-4 text-amber-600" />
                Chỉnh Sửa Giá Bán & Thuế VAT
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Cập nhật đơn giá chưa VAT và tỷ lệ % VAT cho xe trong phiếu bán #{order.id}.
              </DialogDescription>
            </DialogHeader>

            {editingItem && (
              <form onSubmit={handleSavePricing} className="space-y-4 pt-1">
                {editPricingError && (
                  <Alert variant="destructive" className="py-2 text-xs">
                    <AlertDescription>{editPricingError}</AlertDescription>
                  </Alert>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Số khung:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {editingItem.chassisNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Dòng xe / Màu:</span>
                    <span className="font-medium text-slate-800">
                      {editingItem.modelName}{' '}
                      {editingItem.colorName ? `• ${editingItem.colorName}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/80">
                    <span className="text-slate-500">Giá vốn xe:</span>
                    <span className="font-semibold text-slate-700">
                      {formatVnd(editingItem.costPrice)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Đơn Giá Chưa VAT (VNĐ) <span className="text-rose-500">*</span>
                    </Label>
                    <MoneyInput
                      value={editPriceBeforeVat}
                      onValueChange={setEditPriceBeforeVat}
                      className="h-9 text-sm text-right px-3"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      % VAT <span className="text-rose-500">*</span>
                    </Label>
                    <DecimalInput
                      maxDecimals={2}
                      value={editVatRate}
                      onValueChange={(val) =>
                        setEditVatRate(Math.min(Math.max(0, val), 100))
                      }
                      className="h-9 text-sm text-right px-3"
                    />
                  </div>

                  {/* Calculated preview */}
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-emerald-900">
                        Đơn Giá Bán Đã VAT
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        Tự động tính từ đơn giá & % VAT
                      </div>
                    </div>
                    <div className="text-base font-bold text-emerald-800 font-mono">
                      {formatVnd(priceWithVat(editPriceBeforeVat, editVatRate))}
                    </div>
                  </div>

                  {/* Below cost warning */}
                  {editPriceBeforeVat > 0 &&
                    editPriceBeforeVat < editingItem.costPrice && (
                      <Alert className="border-amber-200 bg-amber-50 text-amber-900 py-2.5">
                        <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                        <AlertDescription className="text-xs ml-1 leading-relaxed">
                          Cảnh báo: Đơn giá chưa VAT ({formatVnd(editPriceBeforeVat)}) thấp
                          hơn giá vốn ({formatVnd(editingItem.costPrice)}).
                        </AlertDescription>
                      </Alert>
                    )}
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingItem(null)}
                    disabled={updatePricingMutation.isPending}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={updatePricingMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
                  >
                    {updatePricingMutation.isPending && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    Lưu Thay Đổi
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Batch Pricing Edit Dialog */}
        <Dialog
          open={batchPricingOpen}
          onOpenChange={(open) => {
            if (!open) {
              setBatchPricingOpen(false)
              setBatchPricingError(null)
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Pencil className="size-4 text-amber-600" />
                Sửa Giá Cho ({selectedForDelivery.length}) Xe Đã Chọn
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Áp dụng tỷ lệ VAT hoặc đơn giá chưa VAT đồng loạt cho các xe được chọn.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleBatchPricingSubmit} className="space-y-4 pt-1">
              {batchPricingError && (
                <Alert variant="destructive" className="py-2 text-xs">
                  <AlertDescription>{batchPricingError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {/* Toggle apply VAT */}
                <div className="space-y-2 p-3 border rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="applyVatCheckbox"
                      checked={applyVatToBatch}
                      onCheckedChange={(c) => setApplyVatToBatch(Boolean(c))}
                    />
                    <Label
                      htmlFor="applyVatCheckbox"
                      className="text-xs font-semibold cursor-pointer text-slate-800"
                    >
                      Cập nhật % VAT đồng loạt
                    </Label>
                  </div>
                  {applyVatToBatch && (
                    <div className="pl-6 pt-1">
                      <DecimalInput
                        maxDecimals={2}
                        value={batchVatRate}
                        onValueChange={(val) =>
                          setBatchVatRate(Math.min(Math.max(0, val), 100))
                        }
                        className="h-9 text-sm text-right px-3"
                      />
                    </div>
                  )}
                </div>

                {/* Toggle apply price */}
                <div className="space-y-2 p-3 border rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="applyPriceCheckbox"
                      checked={applyPriceToBatch}
                      onCheckedChange={(c) => setApplyPriceToBatch(Boolean(c))}
                    />
                    <Label
                      htmlFor="applyPriceCheckbox"
                      className="text-xs font-semibold cursor-pointer text-slate-800"
                    >
                      Cập nhật Đơn Giá Chưa VAT đồng loạt
                    </Label>
                  </div>
                  {applyPriceToBatch && (
                    <div className="pl-6 pt-1">
                      <MoneyInput
                        value={batchPriceBeforeVat}
                        onValueChange={setBatchPriceBeforeVat}
                        className="h-9 text-sm text-right px-3"
                      />
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBatchPricingOpen(false)}
                  disabled={updatePricingMutation.isPending}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    updatePricingMutation.isPending ||
                    (!applyVatToBatch && !applyPriceToBatch)
                  }
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
                >
                  {updatePricingMutation.isPending && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                  Áp Dụng Cho {selectedForDelivery.length} Xe
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
