import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowLeft, Banknote, Landmark, PackagePlus, Truck } from 'lucide-react'

import { BatchEditor } from '#/components/batches/BatchEditor.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { PageHeader, StatCard } from '#/components/layout/StatCard.tsx'
import { Button } from '#/components/ui/button.tsx'
import { formatDate, formatVnd } from '#/lib/business.ts'
import { batchDetailQuery, currentUserQuery } from '#/lib/queries.ts'

export const Route = createFileRoute('/batches/$batchId')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async ({ context: { queryClient }, params }) => {
    const id = Number(params.batchId)
    if (!Number.isInteger(id)) throw redirect({ to: '/batches' })
    await queryClient.query(batchDetailQuery(id))
  },
  errorComponent: BatchNotFound,
  component: BatchDetailPage,
})

function BatchNotFound() {
  const { user } = Route.useRouteContext()
  return (
    <AppLayout user={user}>
      <div className="py-16 text-center space-y-3">
        <p className="text-slate-600">Không tìm thấy lô nhập này.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/batches">
            <ArrowLeft className="size-4" />
            Về danh sách lô
          </Link>
        </Button>
      </div>
    </AppLayout>
  )
}

function BatchDetailPage() {
  const { user } = Route.useRouteContext()
  const { batchId } = Route.useParams()
  const { data } = useSuspenseQuery(batchDetailQuery(Number(batchId)))

  const totalImport = data.vehicles.reduce((s, v) => s + v.importPrice, 0)
  const totalExpense = data.expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={
            <Link
              to="/batches"
              className="inline-flex items-center gap-1 hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Danh sách lô xe
            </Link>
          }
          title={`Lô nhập ${formatDate(data.batch.importDate)}`}
          description={
            <>
              Nhà cung cấp: <strong>{data.batch.supplierName}</strong> · Ngày
              nhập: {formatDate(data.batch.importDate)}
              {data.batch.loanContractNumber && (
                <> · Khế ước: {data.batch.loanContractNumber}</>
              )}
            </>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Số xe trong lô"
            icon={PackagePlus}
            value={data.vehicles.length}
            unit="chiếc"
          />
          <StatCard
            label="Tiền hàng"
            icon={Banknote}
            tone="blue"
            value={formatVnd(totalImport)}
          />
          <StatCard
            label="Chi phí lô"
            icon={Truck}
            tone="amber"
            value={formatVnd(totalExpense)}
            hint={`${data.expenses.length} khoản chi phí`}
          />
          <StatCard
            label="Tổng giá vốn lô"
            icon={Landmark}
            tone="violet"
            value={formatVnd(totalImport + totalExpense)}
          />
        </div>

        <BatchEditor detail={data} />
      </div>
    </AppLayout>
  )
}
