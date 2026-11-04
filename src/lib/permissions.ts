/**
 * Role & permission model (shared by the server and the browser).
 *
 * A user has ONE role; a role has a set of permission keys; a role flagged
 * `isAdmin` implicitly has every permission. The catalogue of permissions is
 * fixed in code (it follows the features of the app); which role holds which
 * permission is data, edited by admins in /settings → "Vai trò & Phân quyền".
 */

export const PERMISSION_GROUPS = [
  {
    key: 'overview',
    label: 'Điều hành',
    items: [
      { key: 'dashboard.view', label: 'Xem tổng quan' },
      { key: 'reports.view', label: 'Xem báo cáo & phân tích' },
    ],
  },
  {
    key: 'batches',
    label: 'Nhập lô & Giá vốn',
    items: [
      { key: 'batches.view', label: 'Xem lô xe nhập' },
      { key: 'batches.manage', label: 'Tạo & chỉnh sửa lô, chi phí, giá bán' },
    ],
  },
  {
    key: 'inventory',
    label: 'Kho xe',
    items: [{ key: 'inventory.view', label: 'Xem kho xe (2 kho)' }],
  },
  {
    key: 'sales',
    label: 'Bán hàng & Xuất xe',
    items: [
      { key: 'sales.view', label: 'Xem phiếu bán' },
      { key: 'sales.create', label: 'Lập & hủy phiếu bán' },
      { key: 'sales.deliver', label: 'Giao xe thực tế' },
      { key: 'sales.invoice', label: 'Xuất hóa đơn nội bộ' },
    ],
  },
  {
    key: 'loans',
    label: 'Khế ước vay ngân hàng',
    items: [
      { key: 'loans.view', label: 'Xem khế ước vay & tính lãi' },
      { key: 'loans.manage', label: 'Tạo khế ước & ghi nhận trả nợ' },
    ],
  },
  {
    key: 'finance',
    label: 'Thu chi & Công nợ',
    items: [
      { key: 'finance.view', label: 'Xem công nợ, phiếu thu, phiếu chi' },
      { key: 'finance.manage', label: 'Lập phiếu thu & phiếu chi' },
    ],
  },
  {
    key: 'reconcile',
    label: 'Đối chiếu sao kê',
    items: [
      { key: 'reconcile.view', label: 'Xem sao kê & đối chiếu' },
      { key: 'reconcile.manage', label: 'Nhập sao kê & khớp giao dịch' },
    ],
  },
  {
    key: 'customers',
    label: 'Khách hàng & Điểm bán',
    items: [
      { key: 'customers.view', label: 'Xem khách hàng & điểm bán' },
      { key: 'customers.manage', label: 'Thêm & sửa khách hàng, điểm bán' },
    ],
  },
  {
    key: 'master-data',
    label: 'Dữ liệu chung',
    items: [
      { key: 'master-data.view', label: 'Xem danh mục' },
      { key: 'master-data.manage', label: 'Thêm, sửa, xóa danh mục' },
    ],
  },
  {
    key: 'settings',
    label: 'Cài đặt',
    items: [
      { key: 'company.manage', label: 'Sửa thông tin công ty' },
      { key: 'users.manage', label: 'Quản lý người dùng' },
      { key: 'roles.manage', label: 'Quản lý vai trò & phân quyền' },
    ],
  },
] as const

export type PermissionKey =
  (typeof PERMISSION_GROUPS)[number]['items'][number]['key']

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
)

export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])),
)

/**
 * Maps each module's view permission to its dependent action permissions.
 */
export const VIEW_TO_ACTIONS_MAP: Record<string, string[]> = {
  'batches.view': ['batches.manage'],
  'sales.view': ['sales.create', 'sales.deliver', 'sales.invoice'],
  'loans.view': ['loans.manage'],
  'finance.view': ['finance.manage'],
  'reconcile.view': ['reconcile.manage'],
  'customers.view': ['customers.manage'],
  'master-data.view': ['master-data.manage'],
}

/**
 * Maps each action permission to its parent view permission.
 */
export const ACTION_TO_VIEW_MAP: Record<string, string> = Object.entries(
  VIEW_TO_ACTIONS_MAP,
).reduce(
  (acc, [viewKey, actionKeys]) => {
    for (const actionKey of actionKeys) {
      acc[actionKey] = viewKey
    }
    return acc
  },
  {} as Record<string, string>,
)

/**
 * Normalizes permissions so that any action permission automatically guarantees its module view permission.
 */
export function normalizePermissions(
  permissions: Iterable<string>,
): PermissionKey[] {
  const set = new Set<string>(permissions)
  for (const perm of [...set]) {
    const viewKey = ACTION_TO_VIEW_MAP[perm]
    if (viewKey) {
      set.add(viewKey)
    }
  }
  return ALL_PERMISSIONS.filter((k) => set.has(k))
}

/**
 * Toggles a permission following the business dependency rules:
 * - When checking any action permission, auto-checks the module's view permission.
 * - When unchecking a view permission, auto-unchecks all dependent action permissions in that module.
 */
export function togglePermissionWithRules(
  current: ReadonlySet<string>,
  key: string,
  on: boolean,
): Set<string> {
  const next = new Set(current)
  if (on) {
    next.add(key)
    const viewKey = ACTION_TO_VIEW_MAP[key]
    if (viewKey) {
      next.add(viewKey)
    }
  } else {
    next.delete(key)
    const actionKeys = VIEW_TO_ACTIONS_MAP[key]
    if (actionKeys) {
      for (const actionKey of actionKeys) {
        next.delete(actionKey)
      }
    }
  }
  return next
}

export interface PermissionHolder {
  isAdmin: boolean
  permissions: readonly string[]
}

/** True when the user's role is an admin role or lists the permission */
export function hasPermission(
  user: PermissionHolder | null | undefined,
  key: PermissionKey,
): boolean {
  if (!user) return false
  if (user.isAdmin || user.permissions.includes(key)) return true
  const actions = VIEW_TO_ACTIONS_MAP[key]
  if (actions && actions.some((act) => user.permissions.includes(act))) {
    return true
  }
  return false
}

/** True when the user holds at least one of the permissions */
export function hasAnyPermission(
  user: PermissionHolder | null | undefined,
  keys: readonly PermissionKey[],
): boolean {
  return keys.some((k) => hasPermission(user, k))
}

/** Page → permission needed to open it (also drives the sidebar) */
export const PAGE_PERMISSIONS: { href: string; permission: PermissionKey }[] = [
  { href: '/', permission: 'dashboard.view' },
  { href: '/reports', permission: 'reports.view' },
  { href: '/batches', permission: 'batches.view' },
  { href: '/inventory', permission: 'inventory.view' },
  { href: '/sales', permission: 'sales.view' },
  { href: '/loans', permission: 'loans.view' },
  { href: '/finance', permission: 'finance.view' },
  { href: '/reconcile', permission: 'reconcile.view' },
  { href: '/customers', permission: 'customers.view' },
  { href: '/master-data', permission: 'master-data.view' },
]

/** First page the user may open (login / "no permission" redirects go here) */
export function landingPath(user: PermissionHolder | null | undefined): string {
  const page = PAGE_PERMISSIONS.find((p) => hasPermission(user, p.permission))
  // /settings is open to everyone (change own password)
  return page?.href ?? '/settings'
}

/**
 * Permissions given to the default roles created by the migration / seed.
 * "Quản trị" is an admin role and needs no list.
 */
export const DEFAULT_ROLES: {
  name: string
  description: string
  isAdmin: boolean
  permissions: PermissionKey[]
}[] = [
  {
    name: 'Quản trị',
    description: 'Toàn quyền hệ thống',
    isAdmin: true,
    permissions: [],
  },
  {
    name: 'Kế toán',
    description: 'Công nợ, thu chi, khế ước vay, đối chiếu sao kê',
    isAdmin: false,
    permissions: [
      'dashboard.view',
      'reports.view',
      'batches.view',
      'inventory.view',
      'sales.view',
      'sales.invoice',
      'loans.view',
      'loans.manage',
      'finance.view',
      'finance.manage',
      'reconcile.view',
      'reconcile.manage',
      'customers.view',
      'master-data.view',
    ],
  },
  {
    name: 'Kinh doanh',
    description: 'Lập phiếu bán, quản lý khách hàng',
    isAdmin: false,
    permissions: [
      'dashboard.view',
      'reports.view',
      'batches.view',
      'inventory.view',
      'sales.view',
      'sales.create',
      'customers.view',
      'customers.manage',
    ],
  },
  {
    name: 'Thủ kho',
    description: 'Nhập lô, kho xe, giao xe thực tế',
    isAdmin: false,
    permissions: [
      'dashboard.view',
      'batches.view',
      'batches.manage',
      'inventory.view',
      'sales.view',
      'sales.deliver',
    ],
  },
]
