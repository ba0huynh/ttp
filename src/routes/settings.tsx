import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Building2, Lock, Plus, Users } from 'lucide-react'
import * as React from 'react'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
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
import { ROLE_LABELS } from '#/lib/business.ts'
import { changePasswordFn } from '#/server/fns/auth.ts'
import {
  companyProfileQuery,
  usersQuery,
  currentUserQuery,
} from '#/lib/queries.ts'
import { saveUserFn, updateCompanyProfileFn } from '#/server/fns/system.ts'

export const Route = createFileRoute('/settings')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.query(companyProfileQuery()),
      queryClient.query(usersQuery()),
    ])
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { user } = Route.useRouteContext()
  const { data: company } = useSuspenseQuery(companyProfileQuery())
  const { data: usersList } = useSuspenseQuery(usersQuery())
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
  const [uRole, setURole] = React.useState<any>('sales')
  const [uActive, setUActive] = React.useState(true)
  const [uPassword, setUPassword] = React.useState('')

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
      alert((err as Error).message || 'Lỗi khi cập nhật công ty')
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
    try {
      await saveUser.mutateAsync({
        data: {
          id: editId,
          username: uUsername,
          email: uEmail,
          fullName: uFullName,
          phone: uPhone || null,
          role: uRole,
          isActive: uActive,
          password: uPassword,
        },
      })
      setUserModalOpen(false)
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi lưu người dùng')
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

        <Tabs defaultValue="company" className="space-y-4">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger
              value="company"
              className="text-xs font-semibold gap-1.5"
            >
              <Building2 className="size-3.5" />
              Thông Tin Công Ty
            </TabsTrigger>
            {user.role === 'admin' && (
              <TabsTrigger
                value="users"
                className="text-xs font-semibold gap-1.5"
              >
                <Users className="size-3.5" />
                Quản Lý Người Dùng ({usersList.length})
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
            <Card className="border-slate-200 shadow-xs max-w-2xl">
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
                      disabled={user.role !== 'admin'}
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      className="h-8 text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Mã Số Thuế *
                      </Label>
                      <Input
                        disabled={user.role !== 'admin'}
                        value={cTax}
                        onChange={(e) => setCTax(e.target.value)}
                        className="h-8 text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Người Đại Diện Pháp Luật
                      </Label>
                      <Input
                        disabled={user.role !== 'admin'}
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
                    <Input
                      disabled={user.role !== 'admin'}
                      value={cAddress}
                      onChange={(e) => setCAddress(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Số Điện Thoại
                      </Label>
                      <Input
                        disabled={user.role !== 'admin'}
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
                        disabled={user.role !== 'admin'}
                        value={cEmail}
                        onChange={(e) => setCEmail(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </CardContent>
                {user.role === 'admin' && (
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
          {user.role === 'admin' && (
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
                      setURole('sales')
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
                          <TableCell className="font-mono font-bold text-slate-900">
                            {u.username}
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900">
                            {u.fullName}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {u.email}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-[11px] font-semibold"
                            >
                              {ROLE_LABELS[u.role] ?? u.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                u.isActive
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-rose-50 text-rose-800 border-rose-300'
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
                                setURole(u.role)
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

          {/* Tab 3: Change Password */}
          <TabsContent value="password">
            <Card className="border-slate-200 shadow-xs max-w-md">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Đổi Mật Khẩu Cá Nhân
                </CardTitle>
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

            <form onSubmit={handleSaveUser} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tên Đăng Nhập *</Label>
                <Input
                  required
                  disabled={Boolean(editId)}
                  value={uUsername}
                  onChange={(e) => setUUsername(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Họ Và Tên *</Label>
                <Input
                  required
                  value={uFullName}
                  onChange={(e) => setUFullName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Email *</Label>
                <Input
                  type="email"
                  required
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Vai Trò Phân Quyền *
                </Label>
                <Select
                  value={uRole}
                  onValueChange={(val: any) => setURole(val)}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin" className="text-xs">
                      👑 Quản trị viên (Admin)
                    </SelectItem>
                    <SelectItem value="accountant" className="text-xs">
                      💼 Kế toán (Công nợ & HĐ)
                    </SelectItem>
                    <SelectItem value="sales" className="text-xs">
                      🏷️ Nhân viên Kinh doanh
                    </SelectItem>
                    <SelectItem value="warehouse" className="text-xs">
                      📦 Thủ kho (Giao xe vật lý)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  {editId
                    ? 'Mật Khẩu Mới (Bỏ trống nếu không đổi)'
                    : 'Mật Khẩu Khởi Tạo *'}
                </Label>
                <Input
                  type="password"
                  required={!editId}
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  placeholder={editId ? '••••••••' : 'Tối thiểu 8 ký tự'}
                  className="h-8 text-xs"
                />
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
