import { Link, useRouterState } from '@tanstack/react-router'
import {
  ArrowRightLeft,
  Banknote,
  Bike,
  Boxes,
  Building2,
  ChevronDown,
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PackagePlus,
  PieChart,
  Receipt,
  Settings,
  ShieldCheck,
  UserCog,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'
import * as React from 'react'

import { BrandMark } from '#/components/layout/BrandMark.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'
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
  /** Tab of a tabbed page (`?tab=`) when several items share one path */
  tab?: string
  /** Sub menu: the item becomes a heading and its children are the links */
  children?: NavItem[]
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
        title: 'Dữ liệu chung',
        href: '/master-data',
        icon: Boxes,
        children: [
          {
            title: 'Dòng xe',
            href: '/master-data',
            tab: 'models',
            icon: Bike,
            permission: 'master-data.view',
          },
          {
            title: 'Nhà cung cấp',
            href: '/master-data',
            tab: 'suppliers',
            icon: Truck,
            permission: 'master-data.view',
          },
          {
            title: 'Ngân hàng',
            href: '/master-data',
            tab: 'banks',
            icon: Landmark,
            permission: 'master-data.view',
          },
          {
            title: 'Tài khoản ngân hàng',
            href: '/master-data',
            tab: 'accounts',
            icon: CreditCard,
            permission: 'master-data.view',
          },
          {
            title: 'Màu sắc',
            href: '/master-data',
            tab: 'colors',
            icon: Palette,
            permission: 'master-data.view',
          },
          {
            title: 'Loại chi phí',
            href: '/master-data',
            tab: 'expenseTypes',
            icon: Receipt,
            permission: 'master-data.view',
          },
        ],
      },
    ],
  },
  {
    group: 'Hệ thống',
    items: [
      {
        title: 'Người dùng & Phân quyền',
        href: '/settings',
        icon: UserCog,
        children: [
          {
            title: 'Quản lý người dùng',
            href: '/settings',
            tab: 'users',
            icon: Users,
            permission: 'users.manage',
          },
          {
            title: 'Vai trò & phân quyền',
            href: '/settings',
            tab: 'roles',
            icon: ShieldCheck,
            permission: 'roles.manage',
          },
        ],
      },
      {
        title: 'Cài đặt',
        href: '/settings',
        tab: 'company',
        icon: Settings,
      },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) =>
  g.items.flatMap((i) => i.children ?? [i]),
)

/** Tab a tabbed page shows when the URL has no `?tab=` */
const DEFAULT_TABS: Record<string, string> = {
  '/settings': 'company',
  '/master-data': 'models',
}

/** `tab` is the current `?tab=` value */
const matches = (item: NavItem, path: string, tab?: string) =>
  item.href === '/'
    ? path === '/'
    : path.startsWith(item.href) &&
      (!item.tab || item.tab === (tab ?? DEFAULT_TABS[item.href]))

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
  const tabOf = (search: unknown) =>
    (search as { tab?: string } | undefined)?.tab
  const currentTab = tabOf(
    routerState.resolvedLocation?.search ?? routerState.location.search,
  )
  const targetTab = tabOf(routerState.location.search)
  // Only a change of PAGE shows the loading skeleton. A search-only change
  // (switching a tab: ?tab=...) stays on the same page, so the page and its
  // tab bar remain on screen instead of being swapped for the skeleton.
  const isLoading = routerState.isLoading && currentPath !== targetPath
  const [mobileOpen, setMobileOpen] = React.useState(false)
  // Desktop sidebar: expanded (labels) or hidden completely; remembered per browser
  const [collapsed, setCollapsed] = React.useState(false)
  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('sidebar-collapsed') === '1')
    } catch {
      /* storage unavailable: stay expanded */
    }
  }, [])
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('sidebar-collapsed', c ? '0' : '1')
      } catch {
        /* ignore */
      }
      return !c
    })

  // Close the mobile drawer once navigation starts
  React.useEffect(() => setMobileOpen(false), [targetPath])

  const current = ALL_ITEMS.find((i) => matches(i, currentPath, currentTab))
  const currentGroup = NAV_GROUPS.find((g) =>
    g.items.some((i) => i === current || i.children?.includes(current!)),
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-30 transition-[width] duration-200 ${
          collapsed ? 'w-0 overflow-hidden' : 'w-64'
        }`}
      >
        <SidebarBody
          currentPath={currentPath}
          targetPath={targetPath}
          currentTab={currentTab}
          targetTab={targetTab}
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
            currentTab={currentTab}
            targetTab={targetTab}
            isLoading={isLoading}
            user={user}
          />
        </SheetContent>
      </Sheet>

      <div
        className={`flex flex-col min-w-0 min-h-screen transition-[padding] duration-200 ${
          collapsed ? 'lg:pl-0' : 'lg:pl-64'
        }`}
      >
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
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden lg:inline-flex -ml-1 text-slate-600"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
              title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-5" />
              ) : (
                <PanelLeftClose className="size-5" />
              )}
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

          <ProfileMenu user={user} />
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
  currentTab,
  targetTab,
  isLoading,
  user,
}: {
  currentPath: string
  targetPath: string
  currentTab?: string
  targetTab?: string
  isLoading: boolean
  user: AppLayoutProps['user']
}) {
  // Only the pages the user's role may open
  const allowed = (i: NavItem) =>
    !i.permission || hasPermission(user, i.permission)
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items
      .map((i) =>
        i.children ? { ...i, children: i.children.filter(allowed) } : i,
      )
      .filter((i) => (i.children ? i.children.length > 0 : allowed(i))),
  })).filter((g) => g.items.length > 0)

  // Sub menus fold: the user's choice wins, otherwise a menu is open while the
  // current page is one of its children
  const [folded, setFolded] = React.useState<Record<string, boolean>>({})

  const isOpen = (item: NavItem) =>
    folded[item.title] ??
    (item.children ?? []).some(
      (c) =>
        matches(c, currentPath, currentTab) ||
        (isLoading && matches(c, targetPath, targetTab)),
    )

  const renderLink = (item: NavItem, sub = false) => {
    const Icon = item.icon
    const isActive = matches(item, currentPath, currentTab)
    const isPending = isLoading && matches(item, targetPath, targetTab)
    const on = isActive || isPending
    return (
      <Link
        key={item.title}
        to={item.href}
        search={(item.tab ? { tab: item.tab } : undefined) as never}
        preload="intent"
        className={`group relative flex items-center gap-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
          sub ? 'pl-9 pr-3' : 'px-3'
        } ${
          on
            ? 'bg-white/[0.08] text-white'
            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
        }`}
      >
        {on && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-brass-400" />
        )}
        {!sub && (
          <Icon
            className={`size-4 shrink-0 ${
              on
                ? 'text-emerald-300'
                : 'text-slate-500 group-hover:text-slate-300'
            }`}
          />
        )}
        <span className="truncate">{item.title}</span>
        {isPending && (
          <Loader2 className="size-3.5 animate-spin text-emerald-300 ml-auto shrink-0" />
        )}
      </Link>
    )
  }

  return (
    <div className="flex flex-col w-full h-full bg-ink-900 text-slate-300">
      <div
        className={`h-14 flex items-center gap-3 border-b border-white/[0.06] ${'px-4'}`}
      >
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

      <nav
        className={`sidebar-scroll flex-1 overflow-y-auto py-4 space-y-5 ${'px-3'}`}
      >
        {visibleGroups.map((grp) => (
          <div key={grp.group}>
            <div className="px-3 pb-1.5 text-[10.5px] font-semibold text-slate-500 uppercase tracking-[0.12em]">
              {grp.group}
            </div>
            <div className="space-y-0.5">
              {grp.items.map((item) =>
                item.children ? (
                  <div key={item.title} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setFolded((f) => ({
                          ...f,
                          [item.title]: !isOpen(item),
                        }))
                      }
                      aria-expanded={isOpen(item)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
                    >
                      <item.icon className="size-4 shrink-0 text-slate-500" />
                      <span className="truncate">{item.title}</span>
                      <ChevronDown
                        className={`ml-auto size-3.5 shrink-0 text-slate-500 transition-transform ${
                          isOpen(item) ? '' : '-rotate-90'
                        }`}
                      />
                    </button>
                    {/* grid rows 0fr -> 1fr animates the height without measuring it */}
                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                        isOpen(item)
                          ? 'grid-rows-[1fr] opacity-100'
                          : 'grid-rows-[0fr] opacity-0'
                      }`}
                      inert={!isOpen(item)}
                    >
                      <div className="min-h-0 space-y-0.5 overflow-hidden">
                        {item.children.map((c) => renderLink(c, true))}
                      </div>
                    </div>
                  </div>
                ) : (
                  renderLink(item)
                ),
              )}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}

/** Top-right account menu: who is signed in, and logout */
function ProfileMenu({ user }: { user: AppLayoutProps['user'] }) {
  const handleLogout = async () => {
    await logoutFn()
    window.location.href = '/login'
  }
  const initials = (user?.fullName ?? 'U')
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 text-left transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
          aria-label="Tài khoản"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-emerald-800 text-[11px] font-bold text-emerald-100 ring-1 ring-emerald-500/40">
            {initials}
          </span>
          <span className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="max-w-40 truncate text-xs font-semibold text-slate-800">
              {user?.fullName ?? 'Người dùng'}
            </span>
            <span className="max-w-40 truncate text-[11px] text-slate-500">
              {user?.roleName ?? '—'}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <div className="truncate text-sm font-semibold text-slate-900">
            {user?.fullName ?? 'Người dùng'}
          </div>
          <div className="truncate text-xs font-normal text-slate-500">
            {user?.username} · {user?.roleName}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-rose-600 focus:text-rose-700"
        >
          <LogOut className="size-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
