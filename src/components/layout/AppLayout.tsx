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
  Menu,
  PackagePlus,
  PieChart,
  Plus,
  Settings,
  Warehouse,
} from 'lucide-react'
import * as React from 'react'

import { BrandMark } from '#/components/layout/BrandMark.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { hasPermission } from '#/lib/permissions.ts'
import type { PermissionKey } from '#/lib/permissions.ts'
import { logoutFn } from '#/server/fns/auth.ts'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  /** Hidden from the sidebar when the user lacks it (no value = everyone) */
  permission?: PermissionKey
}

const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: 'Điều hành',
    items: [
      {
        title: 'Bàn làm việc',
        href: '/',
        icon: LayoutDashboard,
        permission: 'dashboard.view',
      },
      {
        title: 'Báo cáo & Phân tích',
        href: '/reports',
        icon: PieChart,
        permission: 'reports.view',
      },
    ],
  },
  {
    group: 'Kho & Xe máy',
    items: [
      {
        title: 'Nhập lô & Giá vốn',
        href: '/batches',
        icon: PackagePlus,
        permission: 'batches.view',
      },
      {
        title: 'Kho xe (2 Kho)',
        href: '/inventory',
        icon: Warehouse,
        permission: 'inventory.view',
      },
      {
        title: 'Bán hàng & Xuất xe',
        href: '/sales',
        icon: FileText,
        permission: 'sales.view',
      },
    ],
  },
  {
    group: 'Tài chính & Đối soát',
    items: [
      {
        title: 'Khế ước vay ngân hàng',
        href: '/loans',
        icon: Landmark,
        permission: 'loans.view',
      },
      {
        title: 'Thu chi & Công nợ',
        href: '/finance',
        icon: Banknote,
        permission: 'finance.view',
      },
      {
        title: 'Đối chiếu sao kê',
        href: '/reconcile',
        icon: ArrowRightLeft,
        permission: 'reconcile.view',
      },
    ],
  },
  {
    group: 'Đối tác & Thiết lập',
    items: [
      {
        title: 'Khách hàng & Điểm bán',
        href: '/customers',
        icon: Building2,
        permission: 'customers.view',
      },
      {
        title: 'Danh mục hệ thống',
        href: '/master-data',
        icon: Boxes,
        permission: 'master-data.view',
      },
      { title: 'Cài đặt công ty & User', href: '/settings', icon: Settings },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

const matches = (href: string, path: string) =>
  href === '/' ? path === '/' : path.startsWith(href)

interface AppLayoutProps {
  children: React.ReactNode
  user?: {
    id: number
    username: string
    fullName: string
    roleName: string
    isAdmin: boolean
    permissions: string[]
  } | null
}

export function AppLayout({ children, user }: AppLayoutProps) {
  const routerState = useRouterState()
  const currentPath =
    routerState.resolvedLocation?.pathname ?? routerState.location.pathname
  const targetPath = routerState.location.pathname
  // Only a change of PAGE shows the loading skeleton. A search-only change
  // (switching a tab: ?tab=...) stays on the same page, so the page and its
  // tab bar remain on screen instead of being swapped for the skeleton.
  const isLoading = routerState.isLoading && currentPath !== targetPath
  const [mobileOpen, setMobileOpen] = React.useState(false)

  // Close the mobile drawer once navigation starts
  React.useEffect(() => setMobileOpen(false), [targetPath])

  const current = ALL_ITEMS.find((i) => matches(i.href, currentPath))
  const currentGroup = NAV_GROUPS.find((g) =>
    g.items.some((i) => i === current),
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 fixed inset-y-0 left-0 z-30">
        <SidebarBody
          currentPath={currentPath}
          targetPath={targetPath}
          isLoading={isLoading}
          user={user}
        />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-72 max-w-[85vw] p-0 gap-0 border-0 bg-ink-900"
        >
          <SheetTitle className="sr-only">Điều hướng</SheetTitle>
          <SheetDescription className="sr-only">
            Danh sách chức năng của hệ thống
          </SheetDescription>
          <SidebarBody
            currentPath={currentPath}
            targetPath={targetPath}
            isLoading={isLoading}
            user={user}
          />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64 flex flex-col min-w-0 min-h-screen">
        {/* Top bar */}
        <header className="h-14 sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3">
          {isLoading && (
            <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 via-brass-400 to-emerald-600 animate-top-loading-bar" />
            </div>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden -ml-1 text-slate-600"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu"
            >
              <Menu className="size-5" />
            </Button>
            <nav className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline truncate">
                {currentGroup?.group ?? 'Trường Thịnh Phát'}
              </span>
              {current && (
                <>
                  <span className="text-slate-300 hidden sm:inline">/</span>
                  <span className="font-semibold text-slate-800 truncate">
                    {current.title}
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasPermission(user, 'inventory.view') && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden md:inline-flex text-xs"
              >
                <Link to="/inventory" preload="intent">
                  <Warehouse className="size-3.5 text-emerald-700" />
                  Tra cứu 2 kho
                </Link>
              </Button>
            )}
            {hasPermission(user, 'sales.create') && (
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link to="/sales/new" preload="intent">
                  <Plus className="size-3.5 text-emerald-700" />
                  <span className="hidden sm:inline">Phiếu bán</span>
                </Link>
              </Button>
            )}
            {hasPermission(user, 'batches.manage') && (
              <Button asChild size="sm" className="text-xs">
                <Link to="/batches/new" preload="intent">
                  <PackagePlus className="size-3.5" />
                  <span className="hidden sm:inline">Nhập lô mới</span>
                </Link>
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px] w-full mx-auto">
          {isLoading ? <PageSkeleton /> : children}
        </main>
      </div>
    </div>
  )
}

function SidebarBody({
  currentPath,
  targetPath,
  isLoading,
  user,
}: {
  currentPath: string
  targetPath: string
  isLoading: boolean
  user: AppLayoutProps['user']
}) {
  const handleLogout = async () => {
    await logoutFn()
    window.location.href = '/login'
  }

  // Only the pages the user's role may open
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(
      (i) => !i.permission || hasPermission(user, i.permission),
    ),
  })).filter((g) => g.items.length > 0)

  const initials = (user?.fullName ?? 'U')
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  return (
    <div className="flex flex-col w-full h-full bg-ink-900 text-slate-300">
      <div className="h-14 flex items-center gap-3 px-4 border-b border-white/[0.06]">
        <BrandMark className="size-8" />
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="font-bold text-[13px] tracking-wide text-white truncate">
            TRƯỜNG THỊNH PHÁT
          </span>
          <span className="text-[10.5px] font-medium text-brass-300/90 uppercase tracking-[0.14em]">
            Xe máy nhập khẩu
          </span>
        </div>
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {visibleGroups.map((grp) => (
          <div key={grp.group}>
            <div className="px-3 pb-1.5 text-[10.5px] font-semibold text-slate-500 uppercase tracking-[0.12em]">
              {grp.group}
            </div>
            <div className="space-y-0.5">
              {grp.items.map((item) => {
                const Icon = item.icon
                const isActive = matches(item.href, currentPath)
                const isPending = isLoading && matches(item.href, targetPath)
                const on = isActive || isPending
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    preload="intent"
                    className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      on
                        ? 'bg-white/[0.08] text-white'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                    }`}
                  >
                    {on && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-brass-400" />
                    )}
                    <Icon
                      className={`size-4 shrink-0 ${
                        on
                          ? 'text-emerald-300'
                          : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    />
                    <span className="truncate">{item.title}</span>
                    {isPending && (
                      <Loader2 className="size-3.5 animate-spin text-emerald-300 ml-auto shrink-0" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 bg-white/[0.03]">
          <div className="size-8 shrink-0 rounded-full bg-emerald-800 ring-1 ring-emerald-500/40 flex items-center justify-center text-[11px] font-bold text-emerald-100">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-100 truncate">
              {user?.fullName ?? 'Người dùng'}
            </div>
            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full bg-emerald-400" />
              {user?.roleName ?? '—'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-500 hover:text-rose-300 hover:bg-white/[0.06]"
            onClick={handleLogout}
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-60 bg-slate-200/80 rounded-md animate-pulse" />
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
              <Loader2 className="size-3 animate-spin" />
              Đang tải trang...
            </span>
          </div>
          <div className="h-4 w-80 bg-slate-200/60 rounded-md animate-pulse" />
        </div>
        <div className="h-8 w-28 bg-slate-200/80 rounded-lg animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-card p-5 space-y-3"
          >
            <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
            <div className="h-7 w-32 bg-slate-200/80 rounded animate-pulse" />
            <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="px-5 py-3.5 border-b">
          <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-border/70">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="px-5 py-3.5 flex items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="h-3.5 w-48 bg-slate-200 rounded animate-pulse" />
                <div className="h-2.5 w-28 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-3.5 w-28 bg-slate-100 rounded animate-pulse" />
              <div className="h-5 w-20 bg-emerald-50 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
