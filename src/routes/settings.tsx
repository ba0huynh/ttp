import { useBusyKeys } from '#/lib/use-busy.ts'
import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import * as React from 'react'
import { z } from 'zod'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { RolesTab } from '#/components/settings/RolesTab.tsx'
import { SearchBox } from '#/components/ui/search-box.tsx'
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import {
  alertDialog,
  showErrorDialog,
} from '#/components/ui/confirm-dialog.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Input } from '#/components/ui/input.tsx'
import { PasswordInput } from '#/components/ui/password-input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { Textarea } from '#/components/ui/textarea.tsx'
import {
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
import { Switch } from '#/components/ui/switch.tsx'
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
import { Tabs, TabsContent } from '#/components/ui/tabs.tsx'
import { parseFieldErrors } from '#/lib/form-errors.ts'
import type { FieldErrors } from '#/lib/form-errors.ts'
import { hasPermission } from '#/lib/permissions.ts'
import { matchesSearch } from '#/lib/text.ts'
import { confirmDelete, reportDeleteFailure } from '#/lib/usage.ts'
import { useUrlText } from '#/lib/use-url-text.ts'
import {
  companyProfileQuery,
  currentUserQuery,
  rolesQuery,
  usersQuery,
} from '#/lib/queries.ts'
import {
  LAST_ADMIN_MESSAGE,
  deleteUserFn,
  saveUserFn,
  updateCompanyProfileFn,
} from '#/server/fns/system.ts'

export const Route = createFileRoute('/settings')({
  // The active tab lives in the URL (?tab=...) so a reload stays on it
  validateSearch: z.object({
    tab: z.enum(['company', 'users', 'roles']).catch('company'),
    // search text of the users / roles list (cleared when the tab changes)
    q: z.string().optional().catch(undefined),
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async ({ context: { queryClient, user } }) => {
    const canUsers = hasPermission(user, 'users.manage')
    const canRoles = hasPermission(user, 'roles.manage')
    await Promise.all([
      queryClient.query(companyProfileQuery()),
      canUsers && queryClient.query(usersQuery()),
      (canUsers || canRoles) && queryClient.query(rolesQuery()),
    ])
  },
  component: SettingsPage,
})

const PAGE_TITLES = {
  company: {
    title: 'Cài Đặt',
    description: 'Thông tin pháp nhân Công ty Trường Thịnh Phát.',
  },
  users: {
    title: 'Quản Lý Người Dùng',
    description: 'Tạo tài khoản, gán vai trò và khóa hoặc xóa người dùng.',
  },
  roles: {
    title: 'Vai Trò & Phân Quyền',
    description:
      'Quy định mỗi vai trò được xem và thao tác những chức năng nào.',
  },
} as const

function SettingsPage() {
  const { user } = Route.useRouteContext()
  const { tab, q } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: company } = useSuspenseQuery(companyProfileQuery())
  const canCompany = hasPermission(user, 'company.manage')
  const canUsers = hasPermission(user, 'users.manage')
  const canRoles = hasPermission(user, 'roles.manage')
  // A tab the role cannot see (e.g. a stale ?tab=users) falls back to company
  const activeTab =
    (tab === 'users' && !canUsers) || (tab === 'roles' && !canRoles)
      ? 'company'
      : tab
  const { data: usersList = [] } = useQuery({
    ...usersQuery(),
    enabled: canUsers,
  })
  const { data: rolesList = [] } = useQuery({
    ...rolesQuery(),
    enabled: canUsers || canRoles,
  })
  // Typing filters at once; the URL (?q=) follows when typing pauses
  const [search, setSearch] = useUrlText(q ?? '', (v) =>
    navigate({
      search: (prev) => ({ ...prev, q: v || undefined }),
      replace: true,
    }),
  )
  const filteredUsers = usersList.filter((u) =>
    matchesSearch(search, u.fullName, u.username, u.email),
  )
  const filteredRoles = rolesList.filter((r) =>
    matchesSearch(search, r.name, r.description),
  )
  const usersPg = usePagination(filteredUsers, search)
  const queryClient = useQueryClient()
  const updateCompany = useMutation({
    mutationFn: updateCompanyProfileFn,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: companyProfileQuery().queryKey,
      }),
  })
  const deleteUser = useMutation({
    mutationFn: deleteUserFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const saveUser = useMutation({
    mutationFn: saveUserFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: usersQuery().queryKey }),
  })

  // Company information form
  const [cName, setCName] = React.useState(
    company?.name ?? 'CÔNG TY TNHH KINH DOANH DỊCH VỤ TRƯỜNG THỊNH PHÁT',
  )
  const [cTax, setCTax] = React.useState(company?.taxCode ?? '0316513248')
  const [cAddress, setCAddress] = React.useState(
    company?.address ?? '229 Lê Văn Sỹ, Phường 13, Quận 3, TP.HCM',
  )
  const [cPhone, setCPhone] = React.useState(company?.phone ?? '028 3991 6688')
  const [cEmail, setCEmail] = React.useState(
    company?.email ?? 'contact@truongthinhphat-motor.vn',
  )
  const [cRep, setCRep] = React.useState(
    company?.representative ?? 'Huỳnh Văn Thịnh',
  )
  const [companySuccess, setCompanySuccess] = React.useState(false)

  // Create/Edit User modal
  const [userModalOpen, setUserModalOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<number | undefined>(undefined)
  const [uUsername, setUUsername] = React.useState('')
  const [uEmail, setUEmail] = React.useState('')
  const [uFullName, setUFullName] = React.useState('')
  const [uPhone, setUPhone] = React.useState('')
  const [uRoleId, setURoleId] = React.useState<number | null>(null)
  const [uActive, setUActive] = React.useState(true)
  const [uPassword, setUPassword] = React.useState('')
  // Inline validation: per-field messages plus a banner for other server errors
  const [uErrors, setUErrors] = React.useState<FieldErrors>({})
  const [uFormError, setUFormError] = React.useState<string | null>(null)

  // Start every open of the modal with a clean slate
  React.useEffect(() => {
    if (userModalOpen) {
      setUErrors({})
      setUFormError(null)
    }
  }, [userModalOpen])

  const clearUError = (field: string) =>
    setUErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })

  const fieldError = (field: string) =>
    uErrors[field] ? (
      <p className="text-[11px] font-medium text-rose-600">{uErrors[field]}</p>
    ) : null

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setCompanySuccess(false)
    try {
      await updateCompany.mutateAsync({
        data: {
          name: cName,
          taxCode: cTax,
          address: cAddress,
          phone: cPhone,
          email: cEmail,
          representative: cRep,
          website: null,
        },
      })
      setCompanySuccess(true)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi cập nhật công ty')
    }
  }

  const adminRoleIds = new Set(
    rolesList.filter((r) => r.isAdmin).map((r) => r.id),
  )

  const { isBusy, setBusy } = useBusyKeys()

  const handleDeleteUser = async (u: {
    id: number
    username: string
    roleId: number
  }) => {
    // The last active administrator is never deleted: say so before asking
    const otherAdmins = usersList.filter(
      (x) => x.id !== u.id && x.isActive && adminRoleIds.has(x.roleId),
    )
    if (adminRoleIds.has(u.roleId) && otherAdmins.length === 0) {
      await alertDialog({
        title: 'Không thể xóa tài khoản',
        description: LAST_ADMIN_MESSAGE,
        destructive: true,
        buttonLabel: 'Đã hiểu',
      })
      return
    }
    const ok = await confirmDelete(
      { entity: 'users', id: u.id, name: u.username },
      {
        title: `Xóa tài khoản "${u.username}"?`,
        description:
          u.id === user.id
            ? 'Đây là tài khoản của bạn: bạn sẽ bị đăng xuất. Hành động này không thể hoàn tác.'
            : 'Hành động này không thể hoàn tác.',
      },
      (checking) => setBusy(`users:${u.id}`, checking),
    )
    if (!ok) return
    setBusy(`users:${u.id}`, true)
    try {
      await deleteUser.mutateAsync({ data: { id: u.id } })
    } catch (err: unknown) {
      await reportDeleteFailure(
        err,
        { entity: 'users', id: u.id, name: u.username },
        'Không thể xóa tài khoản',
      )
    } finally {
      setBusy(`users:${u.id}`, false)
    }
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setUFormError(null)

    // Client-side checks so the user sees the problem right under the input
    const errors: FieldErrors = {}
    if (!uUsername.trim()) errors.username = 'Vui lòng nhập tên đăng nhập'
    if (!uFullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên'
    if (!uEmail.trim()) errors.email = 'Vui lòng nhập email'
    else if (!/^\S+@\S+\.\S+$/.test(uEmail.trim()))
      errors.email = 'Email không hợp lệ'
    if (!uRoleId) errors.roleId = 'Vui lòng chọn vai trò phân quyền'
    if (!editId && !uPassword)
      errors.password = 'Vui lòng nhập mật khẩu khởi tạo'
    else if (uPassword && uPassword.length < 8)
      errors.password = 'Mật khẩu phải có tối thiểu 8 ký tự'
    setUErrors(errors)
    if (Object.keys(errors).length > 0 || !uRoleId) return

    try {
      await saveUser.mutateAsync({
        data: {
          id: editId,
          username: uUsername,
          email: uEmail,
          fullName: uFullName,
          phone: uPhone || null,
          roleId: uRoleId,
          isActive: uActive,
          password: uPassword,
        },
      })
      setUserModalOpen(false)
    } catch (err: unknown) {
      // Validation errors map to fields; anything else goes in the banner
      const fieldErrors = parseFieldErrors(err)
      if (Object.keys(fieldErrors).length > 0) {
        setUErrors(fieldErrors)
      } else {
        setUFormError((err as Error).message || 'Lỗi khi lưu người dùng')
      }
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {PAGE_TITLES[activeTab].title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {PAGE_TITLES[activeTab].description}
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) =>
            navigate({ search: { tab: v as typeof tab }, replace: true })
          }
          className="space-y-4"
        >
          {/* Tab 1: Company Profile */}
          <TabsContent value="company">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Pháp Nhân Doanh Nghiệp
                </CardTitle>
                <CardDescription className="text-xs">
                  Hiển thị trên tiêu đề chứng từ xuất bán, phiếu thu, phiếu chi
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleUpdateCompany}>
                <CardContent className="p-4 space-y-3 text-xs">
                  {companySuccess && (
                    <Alert className="bg-emerald-50 text-emerald-900 border-emerald-300 py-2 text-xs">
                      <AlertDescription>
                        Đã cập nhật thông tin công ty thành công!
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Tên Doanh Nghiệp *
                    </Label>
                    <Input
                      disabled={!canCompany}
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      className="h-11 rounded-lg px-4 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Mã Số Thuế *
                      </Label>
                      <Input
                        disabled={!canCompany}
                        value={cTax}
                        onChange={(e) => setCTax(e.target.value)}
                        className="h-11 rounded-lg px-4 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Người Đại Diện Pháp Luật
                      </Label>
                      <Input
                        disabled={!canCompany}
                        value={cRep}
                        onChange={(e) => setCRep(e.target.value)}
                        className="h-11 rounded-lg px-4 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Địa Chỉ Trụ Sở *
                    </Label>
                    <Textarea
                      disabled={!canCompany}
                      value={cAddress}
                      onChange={(e) => setCAddress(e.target.value)}
                      rows={2}
                      className="min-h-24 rounded-lg px-4 py-3 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Số Điện Thoại
                      </Label>
                      <Input
                        disabled={!canCompany}
                        value={cPhone}
                        onChange={(e) => setCPhone(e.target.value)}
                        className="h-11 rounded-lg px-4 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Email Liên Hệ
                      </Label>
                      <Input
                        disabled={!canCompany}
                        value={cEmail}
                        onChange={(e) => setCEmail(e.target.value)}
                        className="h-11 rounded-lg px-4 text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
                {canCompany && (
                  <CardFooter className="py-3 px-4 border-t border-slate-100 flex justify-end">
                    <Button
                      type="submit"
                      disabled={updateCompany.isPending}
                      size="sm"
                      className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                    >
                      {updateCompany.isPending ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                    </Button>
                  </CardFooter>
                )}
              </form>
            </Card>
          </TabsContent>

          {/* Tab 2: User Management */}
          {canUsers && (
            <TabsContent value="users">
              <Card className="border-slate-200 shadow-xs">
                <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-800">
                    Danh Sách Tài Khoản Nhân Viên Nội Bộ
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <SearchBox
                      value={search}
                      onChange={setSearch}
                      placeholder="Tìm tên, tên đăng nhập, email..."
                      className="w-72"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditId(undefined)
                        setUUsername('')
                        setUEmail('')
                        setUFullName('')
                        setUPhone('')
                        setURoleId(rolesList[0]?.id ?? null)
                        setUActive(true)
                        setUPassword('')
                        setUserModalOpen(true)
                      }}
                      className="h-9 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                    >
                      <Plus className="size-3.5" />
                      Thêm Người Dùng
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs bg-slate-50">
                        <TableHead>Tên Đăng Nhập</TableHead>
                        <TableHead>Họ Và Tên</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Vai Trò (Phân Quyền)</TableHead>
                        <TableHead className="text-center">
                          Trạng Thái
                        </TableHead>
                        <TableHead className="text-center">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {usersPg.total === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-8 text-center text-slate-500"
                          >
                            Không tìm thấy người dùng nào
                          </TableCell>
                        </TableRow>
                      )}
                      {usersPg.pageItems.map((u: any) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium text-slate-900">
                            {u.username}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {u.fullName}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {u.email}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px]">
                              {u.roleName}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                u.isActive
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 text-[11px]'
                                  : 'bg-rose-50 text-rose-800 border-rose-300 text-[11px]'
                              }
                            >
                              {u.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-emerald-800"
                              onClick={() => {
                                setEditId(u.id)
                                setUUsername(u.username)
                                setUEmail(u.email)
                                setUFullName(u.fullName)
                                setUPhone(u.phone ?? '')
                                setURoleId(u.roleId)
                                setUActive(u.isActive)
                                setUPassword('')
                                setUserModalOpen(true)
                              }}
                            >
                              Chỉnh sửa
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUser(u)}
                              disabled={isBusy(`users:${u.id}`)}
                              className="size-7 text-slate-400 hover:text-rose-600"
                              aria-label="Xóa tài khoản"
                              title="Xóa tài khoản"
                            >
                              <BusyTrash busy={isBusy(`users:${u.id}`)} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination pagination={usersPg} />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Roles & permissions */}
          {canRoles && (
            <TabsContent value="roles">
              <RolesTab
                roles={filteredRoles}
                search={search}
                onSearchChange={setSearch}
              />
            </TabsContent>
          )}
        </Tabs>

        {/* Create/Edit User modal */}
        <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {editId ? 'Chỉnh Sửa Tài Khoản' : 'Thêm Người Dùng Mới'}
              </DialogTitle>
            </DialogHeader>

            <form
              onSubmit={handleSaveUser}
              noValidate
              className="space-y-3 pt-2"
            >
              {uFormError && (
                <Alert variant="destructive" className="py-2 text-xs">
                  <AlertDescription>{uFormError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tên Đăng Nhập *</Label>
                <Input
                  disabled={Boolean(editId)}
                  value={uUsername}
                  aria-invalid={Boolean(uErrors.username)}
                  onChange={(e) => {
                    setUUsername(e.target.value)
                    clearUError('username')
                  }}
                  className="h-11 rounded-lg px-4 text-sm"
                />
                {fieldError('username')}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Họ Và Tên *</Label>
                <Input
                  value={uFullName}
                  aria-invalid={Boolean(uErrors.fullName)}
                  onChange={(e) => {
                    setUFullName(e.target.value)
                    clearUError('fullName')
                  }}
                  className="h-11 rounded-lg px-4 text-sm"
                />
                {fieldError('fullName')}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Email *</Label>
                <Input
                  type="email"
                  value={uEmail}
                  aria-invalid={Boolean(uErrors.email)}
                  onChange={(e) => {
                    setUEmail(e.target.value)
                    clearUError('email')
                  }}
                  className="h-11 rounded-lg px-4 text-sm"
                />
                {fieldError('email')}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Vai Trò Phân Quyền *
                </Label>
                <SearchSelect
                  value={uRoleId ? String(uRoleId) : ''}
                  onValueChange={(v) => {
                    setURoleId(Number(v))
                    clearUError('roleId')
                  }}
                  className={`h-11 w-full rounded-lg text-sm ${
                    uErrors.roleId ? 'border-rose-500' : ''
                  }`}
                  placeholder="Chọn vai trò"
                >
                  {rolesList.map((r) => (
                    <SearchSelectItem
                      key={r.id}
                      value={String(r.id)}
                      className="text-sm"
                    >
                      {r.name}
                    </SearchSelectItem>
                  ))}
                </SearchSelect>
                {fieldError('roleId')}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  {editId
                    ? 'Mật Khẩu Mới (Bỏ trống nếu không đổi)'
                    : 'Mật Khẩu Khởi Tạo *'}
                </Label>
                <PasswordInput
                  value={uPassword}
                  aria-invalid={Boolean(uErrors.password)}
                  onChange={(e) => {
                    setUPassword(e.target.value)
                    clearUError('password')
                  }}
                  placeholder={
                    editId
                      ? 'Để trống nếu không đổi mật khẩu'
                      : 'Tối thiểu 8 ký tự'
                  }
                  className="h-11 rounded-lg px-4 text-sm"
                />
                {fieldError('password')}
              </div>

              <div className="flex items-center justify-between pt-1">
                <Label className="text-xs font-semibold">
                  Trạng Thái Kích Hoạt
                </Label>
                <Switch checked={uActive} onCheckedChange={setUActive} />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUserModalOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={saveUser.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {saveUser.isPending ? 'Đang lưu...' : 'Lưu Tài Khoản'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
