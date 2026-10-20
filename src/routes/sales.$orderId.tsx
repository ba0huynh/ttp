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
  CheckSquare,
  Eye,
  FileCheck,
  Loader2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Truck,
  X,
  XCircle,
} from 'lucide-react'
import * as React from 'react'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { PageHeader } from '#/components/layout/StatCard.tsx'
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Checkbox } from '#/components/ui/checkbox.tsx'
import { ColorLabel } from '#/components/ui/color-label.tsx'
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
import { formatDate, formatVnd, todayIso } from '#/lib/business.ts'
import { currentUserQuery, salesOrderDetailQuery } from '#/lib/queries.ts'
import { hasPermission } from '#/lib/permissions.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import {
  cancelSalesOrderFn,
  recordDeliveryFn,
  recordInvoiceFn,
  updateDeliveryNoteFn,
  revertDeliveryNoteFn,
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
  const [modelFilter, setModelFilter] = React.useState('all')
  const [colorFilter, setColorFilter] = React.useState('all')

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
      // In select mode, only show cars that have not been exported / delivered yet
      if (selectMode && i.isDelivered) return false

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
      if (modelFilter !== 'all' && i.modelName !== modelFilter) return false
      if (colorFilter !== 'all' && i.colorName !== colorFilter) return false
      return true
    })
  }, [items, selectMode, searchQuery, deliveryFilter, modelFilter, colorFilter])

  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) +
    (deliveryFilter !== 'all' ? 1 : 0) +
    (modelFilter !== 'all' ? 1 : 0) +
    (colorFilter !== 'all' ? 1 : 0)

  const resetFilters = () => {
    setSearchQuery('')
    setDeliveryFilter('all')
    setModelFilter('all')
    setColorFilter('all')
  }

  const itemsPg = usePagination(
    filteredItems,
    `${selectMode}|${searchQuery}|${deliveryFilter}|${modelFilter}|${colorFilter}`,
  )

  // All undelivered vehicles matching active filters
  const undeliveredFiltered = React.useMemo(
    () => filteredItems.filter((i) => !i.isDelivered),
    [filteredItems],
  )
  const allUndeliveredChecked =
    undeliveredFiltered.length > 0 &&
    undeliveredFiltered.every((i) => selectedForDelivery.includes(i.vehicleId))

  // Selectable (undelivered) vehicles on the CURRENT view page
  const pageUndelivered = React.useMemo(
    () => itemsPg.pageItems.filter((i) => !i.isDelivered),
    [itemsPg.pageItems],
  )
  const pageAllChecked =
    pageUndelivered.length > 0 &&
    pageUndelivered.every((i) => selectedForDelivery.includes(i.vehicleId))
  const pageSomeChecked =
    pageUndelivered.some((i) => selectedForDelivery.includes(i.vehicleId)) &&
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
      const pageIds = new Set(pageUndelivered.map((i) => i.vehicleId))
      setSelectedForDelivery((prev) => prev.filter((id) => !pageIds.has(id)))
    } else {
      // Select all undelivered vehicles on the current page (merging with existing selections)
      const pageIds = pageUndelivered.map((i) => i.vehicleId)
      setSelectedForDelivery((prev) =>
        Array.from(new Set([...prev, ...pageIds])),
      )
    }
  }

  const selectAllAcrossPages = () => {
    setSelectedForDelivery(undeliveredFiltered.map((i) => i.vehicleId))
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
  const revertDeliveryMutation = useMutation({
    mutationFn: revertDeliveryNoteFn,
    onSuccess: onSettled,
  })

  type OrderItem = (typeof items)[number]
  const [deliveryDialogOpen, setDeliveryDialogOpen] = React.useState(false)
  const [viewDeliveryDialogOpen, setViewDeliveryDialogOpen] = React.useState(false)
  const [activeDeliveryItem, setActiveDeliveryItem] = React.useState<OrderItem | null>(null)
  const [editDeliveryDate, setEditDeliveryDate] = React.useState(todayIso())
  const [editReceiverName, setEditReceiverName] = React.useState('')
  const [editTransportInfo, setEditTransportInfo] = React.useState('')
  const [editDeliveryError, setEditDeliveryError] = React.useState<string | null>(null)

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
    revertDeliveryMutation.isPending

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

  const openViewDeliveryModal = (item: OrderItem) => {
    setActiveDeliveryItem(item)
    setEditDeliveryDate(
      item.deliveryDate ||
        (item.deliveredAt ? String(item.deliveredAt).slice(0, 10) : todayIso()),
    )
    setEditReceiverName(item.receiverName || '')
    setEditTransportInfo(item.transportInfo || '')
    setEditDeliveryError(null)
    setViewDeliveryDialogOpen(true)
  }

  const handleUpdateDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeDeliveryItem) return
    if (!activeDeliveryItem.deliveryNoteId) {
      setEditDeliveryError('Không tìm thấy thông tin phiếu giao của xe này để cập nhật')
      return
    }
    setEditDeliveryError(null)
    try {
      await updateDeliveryMutation.mutateAsync({
        data: {
          salesOrderId: order.id,
          deliveryNoteId: activeDeliveryItem.deliveryNoteId,
          deliveryDate: editDeliveryDate,
          receiverName: editReceiverName || null,
          transportInfo: editTransportInfo || null,
          note: activeDeliveryItem.deliveryNoteContent || null,
        },
      })
      setViewDeliveryDialogOpen(false)
    } catch (err: unknown) {
      setEditDeliveryError(formatErrorMessage(err, 'Lỗi khi cập nhật phiếu giao'))
    }
  }

  const handleRevertDelivery = async (revertAll: boolean = false) => {
    if (!activeDeliveryItem) return
    const noteId = activeDeliveryItem.deliveryNoteId
    const relatedItems = noteId
      ? items.filter((it) => it.deliveryNoteId === noteId)
      : [activeDeliveryItem]
    const vehicleCount = relatedItems.length

    const message =
      revertAll || vehicleCount <= 1
        ? `Xác nhận hủy xuất kho${vehicleCount > 1 ? ` toàn bộ phiếu giao (${vehicleCount} xe)` : ` cho xe ${activeDeliveryItem.chassisNumber}`}? Xe sẽ được hoàn trả về trạng thái tồn kho thực tế.`
        : `Xác nhận hủy xuất kho cho xe ${activeDeliveryItem.chassisNumber}? Xe sẽ được hoàn trả về trạng thái tồn kho thực tế.`

    const confirmed = await confirmDialog({
      title: 'Xác nhận hủy xuất kho',
      description: message,
      confirmLabel: 'Hủy xuất kho',
      destructive: true,
    })
    if (!confirmed) return

    setEditDeliveryError(null)
    try {
      await revertDeliveryMutation.mutateAsync({
        data: {
          salesOrderId: order.id,
          deliveryNoteId: noteId ?? undefined,
          vehicleId:
            revertAll || vehicleCount <= 1 ? undefined : activeDeliveryItem.vehicleId,
        },
      })
      setViewDeliveryDialogOpen(false)
    } catch (err: unknown) {
      setEditDeliveryError(formatErrorMessage(err, 'Lỗi khi hủy xuất kho'))
    }
  }

  const openBatchDeliveryModal = () => {
    if (selectedForDelivery.length === 0) return
    setSelectedVehicles(selectedForDelivery)
    setDeliveryDate(todayIso())
    setReceiverName('')
    setTransportInfo('')
    setActionError(null)
    setDeliveryDialogOpen(true)
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
          invoiceNumber: invoiceNumber || undefined,
        },
      })
      setInvoiceDialogOpen(false)
    } catch (err: unknown) {
      setActionError(formatErrorMessage(err, 'Lỗi khi lập hóa đơn'))
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
                  ? `Chọn xe chưa xuất kho (${filteredItems.length})`
                  : `Danh sách xe trong phiếu (${items.length})`}
              </CardTitle>
              {activeFilterCount > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Đang hiển thị {filteredItems.length}/{items.length} xe theo bộ lọc
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
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
              {canDeliver && items.some((i) => !i.isDelivered) && (
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
                <span className="font-semibold">Đang chọn xe xuất kho:</span>
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
                {undeliveredFiltered.length > pageUndelivered.length &&
                  !allUndeliveredChecked && (
                    <button
                      type="button"
                      onClick={selectAllAcrossPages}
                      className="text-emerald-700 hover:underline font-medium ml-2 cursor-pointer"
                    >
                      Chọn tất cả {undeliveredFiltered.length} xe trong phiếu
                    </button>
                  )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={selectedForDelivery.length === 0}
                  onClick={openBatchDeliveryModal}
                  className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1.5"
                >
                  <Truck className="size-3.5" />
                  Xuất kho{' '}
                  {selectedForDelivery.length > 0
                    ? `(${selectedForDelivery.length})`
                    : ''}{' '}
                  xe đã chọn
                </Button>
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
                          disabled={pageUndelivered.length === 0}
                          aria-label="Chọn tất cả xe trên trang này"
                        />
                      </TableHead>
                    )}
                    <TableHead>Số Khung</TableHead>
                    <TableHead>Dòng xe / Màu</TableHead>
                    <TableHead className="text-right">Đơn Giá Bán</TableHead>
                    <TableHead className="text-center">Kho Thực Tế</TableHead>
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
                            <ColorLabel name={i.colorName} hex={i.colorHex} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900">
                          {formatVnd(i.unitPrice)}
                        </TableCell>
                        <TableCell className="text-center">
                          {i.isDelivered ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[11px]"
                            >
                              Đã giao ({formatDate(i.deliveredAt)})
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-300 text-[11px]"
                            >
                              Còn trong kho thực tế
                            </Badge>
                          )}
                        </TableCell>
                        {!selectMode && (
                          <TableCell className="text-center whitespace-nowrap">
                            {canDeliver && !i.isDelivered ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1.5 font-medium px-2.5"
                                onClick={() => openSingleDeliveryModal(i.vehicleId)}
                                title={`Lập phiếu giao cho xe ${i.chassisNumber}`}
                              >
                                <Truck className="size-3 text-emerald-600" />
                                Giao xe
                              </Button>
                            ) : canDeliver && i.isDelivered ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-blue-300 text-blue-800 hover:bg-blue-50 gap-1.5 font-medium px-2.5"
                                onClick={() => openViewDeliveryModal(i)}
                                title={`Xem / Sửa phiếu xuất xe ${i.chassisNumber}`}
                              >
                                <Eye className="size-3.5 text-blue-600" />
                                Xem
                              </Button>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                  {filteredItems.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-xs text-slate-400 italic"
                      >
                        {selectMode
                          ? 'Tất cả các xe trong phiếu đã được xuất kho thực tế.'
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

        {/* View & Edit Delivery / Un-export Modal */}
        <Dialog
          open={viewDeliveryDialogOpen}
          onOpenChange={setViewDeliveryDialogOpen}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Truck className="size-4 text-blue-600" />
                Chi Tiết Phiếu Giao Xe Thực Tế
              </DialogTitle>
              <DialogDescription className="text-xs">
                Mã phiếu giao:{' '}
                <strong className="text-slate-800">
                  {activeDeliveryItem?.deliveryNoteNumber || 'Chưa có mã'}
                </strong>
              </DialogDescription>
            </DialogHeader>

            {activeDeliveryItem && (
              <form
                onSubmit={handleUpdateDeliverySubmit}
                className="space-y-3 pt-1"
              >
                {editDeliveryError && (
                  <Alert variant="destructive" className="text-xs py-2">
                    <AlertDescription>{editDeliveryError}</AlertDescription>
                  </Alert>
                )}

                {/* Selected vehicle preview card */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      Số khung: {activeDeliveryItem.chassisNumber}
                    </span>
                    <ColorLabel
                      name={activeDeliveryItem.colorName}
                      hex={activeDeliveryItem.colorHex}
                    />
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>
                      Dòng xe: {activeDeliveryItem.modelName || '—'}
                    </span>
                    <span>
                      Số máy: {activeDeliveryItem.engineNumber || '—'}
                    </span>
                  </div>

                  {activeDeliveryItem.deliveryNoteId &&
                    (() => {
                      const related = items.filter(
                        (it) =>
                          it.deliveryNoteId ===
                          activeDeliveryItem.deliveryNoteId,
                      )
                      if (related.length <= 1) return null
                      return (
                        <div className="pt-1 border-t border-slate-200 text-[11px] text-slate-600">
                          <span className="font-medium text-slate-700">
                            Phiếu giao này gồm {related.length} xe:{' '}
                          </span>
                          {related.map((r) => r.chassisNumber).join(', ')}
                        </div>
                      )
                    })()}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Ngày Giao Hàng *
                  </Label>
                  <Input
                    type="date"
                    required
                    value={editDeliveryDate}
                    onChange={(e) => setEditDeliveryDate(e.target.value)}
                    className="h-10 text-sm px-3 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Tên Người/Tài Xế Nhận Xe
                  </Label>
                  <Input
                    placeholder="Ví dụ: Anh Nam (Lái xe đại lý)"
                    value={editReceiverName}
                    onChange={(e) => setEditReceiverName(e.target.value)}
                    className="h-10 text-sm px-3 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Thông Tin Phương Tiện / Biển Số Xe Tải
                  </Label>
                  <Input
                    placeholder="Ví dụ: Xe lồng biển số 51C-123.45"
                    value={editTransportInfo}
                    onChange={(e) => setEditTransportInfo(e.target.value)}
                    className="h-10 text-sm px-3 rounded-lg"
                  />
                </div>

                <DialogFooter className="pt-3 flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(() => {
                      const relatedCount = activeDeliveryItem.deliveryNoteId
                        ? items.filter(
                            (it) =>
                              it.deliveryNoteId ===
                              activeDeliveryItem.deliveryNoteId,
                          ).length
                        : 1
                      return (
                        <>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => handleRevertDelivery(false)}
                            className="h-8 text-xs gap-1 font-semibold"
                            title="Hoàn trả xe này về kho thực tế"
                          >
                            <RotateCcw className="size-3.5" />
                            {relatedCount > 1
                              ? 'Hủy xuất xe này'
                              : 'Hủy xuất kho'}
                          </Button>
                          {relatedCount > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={actionLoading}
                              onClick={() => handleRevertDelivery(true)}
                              className="h-8 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 gap-1 font-semibold"
                              title={`Hủy toàn bộ phiếu giao gồm ${relatedCount} xe`}
                            >
                              <RotateCcw className="size-3.5" />
                              Hủy cả {relatedCount} xe
                            </Button>
                          )}
                        </>
                      )
                    })()}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewDeliveryDialogOpen(false)}
                      className="h-8 text-xs"
                    >
                      Đóng
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        actionLoading || !activeDeliveryItem.deliveryNoteId
                      }
                      size="sm"
                      className="h-8 text-xs font-semibold"
                    >
                      {actionLoading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

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
                  placeholder="Ví dụ: HD-260120-001"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="text-xs font-semibold text-slate-700 pt-2">
                Số lượng xe lập hóa đơn:{' '}
                <strong>{selectedVehicles.length} chiếc</strong>
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
                  className="h-8 text-xs bg-blue-700 hover:bg-blue-800 text-white font-semibold"
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
                        <ColorLabel name={c.name} hex={c.hex} />
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
      </div>
    </AppLayout>
  )
}
