import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowLeft, MapPin } from 'lucide-react'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { SupplierLogo } from '#/components/ui/supplier-logo.tsx'
import { hasPermission } from '#/lib/permissions.ts'
import { currentUserQuery, supplierDetailQuery } from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'

export const Route = createFileRoute('/suppliers/$supplierId')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    // Linked from /finance; master-data viewers may open it too
    if (!hasPermission(user, 'master-data.view'))
      requirePagePermission(user, 'finance.view')
    return { user }
  },
  loader: async ({ context: { queryClient }, params }) => {
    const id = Number(params.supplierId)
    if (!Number.isInteger(id))
      throw redirect({ to: '/finance', search: { tab: 'payables' } })
    await queryClient.query(supplierDetailQuery(id))
  },
  errorComponent: SupplierNotFound,
  component: SupplierDetailPage,
})

function BackButton() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/finance" search={{ tab: 'payables' }}>
        <ArrowLeft className="size-4" />
        Về công nợ nhà cung cấp
      </Link>
    </Button>
  )
}

function SupplierNotFound() {
  const { user } = Route.useRouteContext()
  return (
    <AppLayout user={user}>
      <div className="py-16 text-center space-y-3">
        <p className="text-slate-600">Không tìm thấy nhà cung cấp này.</p>
        <BackButton />
      </div>
    </AppLayout>
  )
}

/** Supplier page: just the name and the image */
function SupplierDetailPage() {
  const { user } = Route.useRouteContext()
  const { supplierId } = Route.useParams()
  const {
    data: { supplier },
  } = useSuspenseQuery(supplierDetailQuery(Number(supplierId)))

  return (
    <AppLayout user={user}>
      <div className="space-y-5">
        <BackButton />
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="flex flex-col items-center gap-5 py-10">
            <SupplierLogo
              key={supplier.image ?? ''}
              src={supplier.image}
              name={supplier.name}
              className="h-40 w-64"
            />
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {supplier.name}
              </h1>
              <p className="flex items-start justify-center gap-1.5 text-sm text-slate-500">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span className="max-w-xl whitespace-pre-line">
                  {supplier.address || 'Chưa có địa chỉ'}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
