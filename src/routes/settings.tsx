import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Building2, Lock, Plus, ShieldCheck, Users } from 'lucide-react'
import * as React from 'react'
import { z } from 'zod'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { RolesTab } from '#/components/settings/RolesTab.tsx'
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import { showErrorDialog } from '#/components/ui/confirm-dialog.tsx'
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui/tabs.tsx'
import { parseFieldErrors } from '#/lib/form-errors.ts'
import type { FieldErrors } from '#/lib/form-errors.ts'
import { hasPermission } from '#/lib/permissions.ts'
import { changePasswordFn } from '#/server/fns/auth.ts'
import {
  companyProfileQuery,
  currentUserQuery,
  rolesQuery,
  usersQuery,
} from '#/lib/queries.ts'
import { saveUserFn, updateCompanyProfileFn } from '#/server/fns/system.ts'

export const Route = createFileRoute('/settings')({
  // The active tab lives in the URL (?tab=...) so a reload stays on it
  validateSearch: z.object({
    tab: z.enum(['company', 'users', 'roles', 'password']).catch('company'),
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

function SettingsPage() {
  const { user } = Route.useRouteContext()
  const { tab } = Route.useSearch()
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
  const usersPg = usePagination(usersList)
  const queryClient = useQueryClient()
  const updateCompany = useMutation({
    mutationFn: updateCompanyProfileFn,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: companyProfileQuery().queryKey,
      }),
  })
  const changePassword = useMutation({ mutationFn: changePasswordFn })
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

  // Change password form
  const [currPass, setCurrPass] = React.useState('')
  const [newPass, setNewPass] = React.useState('')
  const [passError, setPassError] = React.useState<string | null>(null)
  const [passSuccess, setPassSuccess] = React.useState(false)

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassError(null)
    setPassSuccess(false)
    try {
      await changePassword.mutateAsync({
        data: {
          currentPassword: currPass,
          newPassword: newPass,
        },
      })
      setPassSuccess(true)
      setCurrPass('')
      setNewPass('')
    } catch (err: unknown) {
      setPassError((err as Error).message || 'Lỗi khi đổi mật khẩu')
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
            Cài Đặt Hệ Thống & Tài Khoản
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Thông tin pháp nhân Công ty Trường Thịnh Phát, phân quyền tài khoản
            và mật khẩu bảo mật.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) =>
            navigate({ search: { tab: v as typeof tab }, replace: true })
          }
          className="space-y-4"
        >
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger
              value="company"
              className="text-xs font-semibold gap-1.5"
            >
              <Building2 className="size-3.5" />
              Thông Tin Công Ty
            </TabsTrigger>
            {canUsers && (
              <TabsTrigger
                value="users"
                className="text-xs font-semibold gap-1.5"
              >
                <Users className="size-3.5" />
                Quản Lý Người Dùng ({usersList.length})
              </TabsTrigger>
            )}
            {canRoles && (
              <TabsTrigger
                value="roles"
                className="text-xs font-semibold gap-1.5"
              >
                <ShieldCheck className="size-3.5" />
                Vai Trò & Phân Quyền ({rolesList.length})
              </TabsTrigger>
            )}
            <TabsTrigger
              value="password"
              className="text-xs font-semibold gap-1.5"
            >
              <Lock className="size-3.5" />
              Đổi Mật Khẩu
            </TabsTrigger>
          </TabsList>

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
                      className="h-8 text-xs"
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
                        className="h-8 text-xs"
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
                        className="h-8 text-xs"
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
                      className="min-h-16 text-xs"
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
                        className="h-8 text-xs"
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
                        className="h-8 text-xs"
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
                    className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                  >
                    <Plus className="size-3.5" />
                    Thêm Người Dùng
                  </Button>
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
                      {usersPg.pageItems.map((u: any) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-mono font-medium text-slate-800">
                            {u.username}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {u.fullName}
                          </TableCell>
                          <TableCell className="text-slate-600">
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
              <RolesTab roles={rolesList} />
            </TabsContent>
          )}

          {/* Tab 3: Change Password */}
          <TabsContent value="password">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Đổi Mật Khẩu Cá Nhân
                </CardTitle>
                <CardDescription className="text-xs">
                  Cập nhật mật khẩu định kỳ để tăng cường an toàn và bảo mật tài
                  khoản
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleChangePassword}>
                <CardContent className="p-4 space-y-3 text-xs">
                  {passError && (
                    <Alert variant="destructive" className="py-2 text-xs">
                      <AlertDescription>{passError}</AlertDescription>
                    </Alert>
                  )}
                  {passSuccess && (
                    <Alert className="bg-emerald-50 text-emerald-900 border-emerald-300 py-2 text-xs">
                      <AlertDescription>
                        Đổi mật khẩu thành công!
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Mật Khẩu Hiện Tại *
                      </Label>
                      <Input
                        type="password"
                        required
                        value={currPass}
                        onChange={(e) => setCurrPass(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Mật Khẩu Mới (Tối thiểu 8 ký tự) *
                      </Label>
                      <Input
                        type="password"
                        required
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="py-3 px-4 border-t border-slate-100 flex justify-end">
                  <Button
                    type="submit"
                    disabled={changePassword.isPending}
                    size="sm"
                    className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                  >
                    {changePassword.isPending
                      ? 'Đang lưu...'
                      : 'Cập Nhật Mật Khẩu'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
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
                  className="h-8 text-xs"
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
                  className="h-8 text-xs"
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
                  className="h-8 text-xs"
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
                  className={`h-8 w-full text-xs ${
                    uErrors.roleId ? 'border-rose-500' : ''
                  }`}
                  placeholder="Chọn vai trò"
                >
                  {rolesList.map((r) => (
                    <SearchSelectItem
                      key={r.id}
                      value={String(r.id)}
                      className="text-xs"
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
                <Input
                  type="password"
                  value={uPassword}
                  aria-invalid={Boolean(uErrors.password)}
                  onChange={(e) => {
                    setUPassword(e.target.value)
                    clearUError('password')
                  }}
                  placeholder={editId ? '••••••••' : 'Tối thiểu 8 ký tự'}
                  className="h-8 text-xs"
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
