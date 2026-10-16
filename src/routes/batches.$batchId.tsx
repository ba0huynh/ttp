import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { BatchEditor } from '#/components/batches/BatchEditor.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { PageHeader } from '#/components/layout/StatCard.tsx'
import { Button } from '#/components/ui/button.tsx'
import { formatDate } from '#/lib/business.ts'
import { batchDetailQuery, currentUserQuery } from '#/lib/queries.ts'
import { hasPermission } from '#/lib/permissions.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'

export const Route = createFileRoute('/batches/$batchId')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'batches.view')
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
            </>
          }
        />

        {/* Read-only for roles without batches.manage: every control is disabled */}
        <fieldset
          disabled={!hasPermission(user, 'batches.manage')}
          className="min-w-0 space-y-6 border-0 p-0"
        >
          <BatchEditor detail={data} />
        </fieldset>
      </div>
    </AppLayout>
  )
}
