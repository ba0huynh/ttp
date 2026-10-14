import { Link, useRouterState } from '@tanstack/react-router'
import {
  ArrowRightLeft,
  Banknote,
  Boxes,
  Building2,
  FileText,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogOut,
  PackagePlus,
  PieChart,
  Settings,
  Warehouse,
} from 'lucide-react'
import * as React from 'react'

import { Avatar, AvatarFallback } from '#/components/ui/avatar.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Card, CardContent, CardHeader } from '#/components/ui/card.tsx'

import { ROLE_LABELS } from '#/lib/business.ts'
import { logoutFn } from '#/server/fns/auth.ts'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: 'Điều hành',
    items: [
      { title: 'Bàn làm việc', href: '/', icon: LayoutDashboard },
      { title: 'Báo cáo & Phân tích', href: '/reports', icon: PieChart },
    ],
  },
  {
    group: 'Kho & Xe máy',
    items: [
      { title: 'Nhập lô & Giá vốn', href: '/batches', icon: PackagePlus },
      { title: 'Kho xe (2 Kho)', href: '/inventory', icon: Warehouse },
      { title: 'Bán hàng & Xuất xe', href: '/sales', icon: FileText },
    ],
  },
  {
    group: 'Tài chính & Đối soát',
    items: [
      { title: 'Khế ước vay ngân hàng', href: '/loans', icon: Landmark },
      { title: 'Thu chi & Công nợ', href: '/finance', icon: Banknote },
      { title: 'Đối chiếu sao kê', href: '/reconcile', icon: ArrowRightLeft },
    ],
  },
  {
    group: 'Đối tác & Thiết lập',
    items: [
      { title: 'Khách hàng & Điểm bán', href: '/customers', icon: Building2 },
      { title: 'Danh mục hệ thống', href: '/master-data', icon: Boxes },
      { title: 'Cài đặt công ty & User', href: '/settings', icon: Settings },
    ],
  },
]

interface AppLayoutProps {
  children: React.ReactNode
  user?: {
    id: number
    username: string
    fullName: string
    role: string
  } | null
}

export function AppLayout({ children, user }: AppLayoutProps) {
  const routerState = useRouterState()
  const isLoading = routerState.isLoading
  const currentPath =
    routerState.resolvedLocation?.pathname ?? routerState.location.pathname
  const targetPath = routerState.location.pathname

  const handleLogout = async () => {
    await logoutFn()
    window.location.href = '/login'
  }

  const userInitial = user?.fullName
    ? (user.fullName.split(' ').slice(-1)[0]?.[0]?.toUpperCase() ?? 'U')
    : 'U'

  return (
    <div className="min-h-screen bg-slate-50/50 flex">
      {/* Fixed left sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col fixed inset-y-0 z-30 shadow-xs">
        {/* Brand header */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100">
          <div className="size-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm font-black text-lg">
            T
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm tracking-tight text-slate-900 truncate">
              TRƯỜNG THỊNH PHÁT
            </span>
            <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">
              Quản lý xe máy sỉ
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_GROUPS.map((grp) => (
            <div key={grp.group} className="space-y-1">
              <div className="px-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                {grp.group}
              </div>
              <div className="space-y-0.5 pt-1">
                {grp.items.map((item) => {
                  const Icon = item.icon
                  const isActive =
                    item.href === '/'
                      ? currentPath === '/'
                      : currentPath.startsWith(item.href)

                  const isPending =
                    isLoading &&
                    (item.href === '/'
                      ? targetPath === '/'
                      : targetPath.startsWith(item.href))

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      preload="intent"
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive || isPending
                          ? 'bg-emerald-50 text-emerald-900 font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon
                        className={`size-4.5 shrink-0 ${
                          isActive || isPending
                            ? 'text-emerald-700'
                            : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.title}</span>
                      {isPending ? (
                        <Loader2 className="size-3.5 animate-spin text-emerald-600 ml-auto shrink-0" />
                      ) : (
                        item.badge && (
                          <Badge
                            variant="secondary"
                            className="ml-auto text-[10px] py-0 px-1.5 font-semibold bg-emerald-100 text-emerald-800"
                          >
                            {item.badge}
                          </Badge>
                        )
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <Avatar className="size-8.5 bg-emerald-600 text-white font-bold text-xs">
              <AvatarFallback className="bg-emerald-600 text-white font-bold">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {user?.fullName ?? 'Người dùng'}
              </div>
              <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                {ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? 'Sales'}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-slate-400 hover:text-rose-600"
              onClick={handleLogout}
              title="Đăng xuất"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="pl-64 flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-xs sticky top-0 z-20 px-6 flex items-center justify-between">
          {/* Top progress bar when loading */}
          {isLoading && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-100/70 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-top-loading-bar" />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs py-0.5"
            >
              MST: 0316513248
            </Badge>
            <span className="text-xs text-slate-600 hidden md:inline">
              Hệ thống vận hành bán buôn xe máy nhập khẩu
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/inventory" preload="intent">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 h-8 border-slate-200"
              >
                <Warehouse className="size-3.5 text-emerald-600" />
                <span>Tra cứu 2 Kho</span>
              </Button>
            </Link>

            <Link to="/batches/new" preload="intent">
              <Button
                size="sm"
                className="text-xs gap-1.5 h-8 bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
              >
                <PackagePlus className="size-3.5" />
                <span>Nhập Lô Mới</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {isLoading ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header skeleton */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-60 bg-slate-200/80 rounded-md animate-pulse" />
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[11px] font-semibold gap-1.5 py-0.5 animate-pulse"
                    >
                      <Loader2 className="size-3 animate-spin text-emerald-600" />
                      Đang tải trang...
                    </Badge>
                  </div>
                  <div className="h-4 w-80 bg-slate-100 rounded-md animate-pulse" />
                </div>
                <div className="h-8 w-28 bg-slate-200/80 rounded-lg animate-pulse" />
              </div>

              {/* KPI cards skeleton */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card
                    key={i}
                    className="border-slate-200 shadow-xs p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-3.5 w-24 bg-slate-200 rounded animate-pulse" />
                      <div className="size-7 rounded-lg bg-slate-100 animate-pulse" />
                    </div>
                    <div className="h-7 w-32 bg-slate-200/80 rounded animate-pulse" />
                    <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                  </Card>
                ))}
              </div>

              {/* Main table skeleton */}
              <Card className="border-slate-200 shadow-xs">
                <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                  <div className="h-7 w-24 bg-slate-100 rounded animate-pulse" />
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {[1, 2, 3, 4, 5].map((row) => (
                      <div
                        key={row}
                        className="px-4 py-3.5 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded bg-slate-100 animate-pulse" />
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-48 bg-slate-200 rounded animate-pulse" />
                            <div className="h-2.5 w-28 bg-slate-100 rounded animate-pulse" />
                          </div>
                        </div>
                        <div className="h-3.5 w-28 bg-slate-100 rounded animate-pulse" />
                        <div className="h-6 w-20 bg-emerald-50 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}
