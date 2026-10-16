import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  Boxes,
  CreditCard,
  Landmark,
  Palette,
  Receipt,
  Pencil,
  Plus,
  Trash2,
  Truck,
} from 'lucide-react'
import * as React from 'react'
import { z } from 'zod'

import { BankLabel } from '#/components/finance/BankLabel.tsx'
import { ColorPicker, normalizeHex } from '#/components/ui/color-picker.tsx'
import { Can } from '#/components/auth/Can.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  alertDialog,
  showErrorDialog,
} from '#/components/ui/confirm-dialog.tsx'
import {
  Card,
  CardContent,
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
import { SearchBox } from '#/components/ui/search-box.tsx'
import { Label } from '#/components/ui/label.tsx'
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
import { masterDataQuery, currentUserQuery } from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import { matchesSearch } from '#/lib/text.ts'
import { useUrlText } from '#/lib/use-url-text.ts'
import { confirmDelete, reportDeleteFailure } from '#/lib/usage.ts'
import {
  deleteMasterDataFn,
  saveBankAccountFn,
  saveBankFn,
  saveColorFn,
  saveExpenseTypeFn,
  saveModelFn,
  saveSupplierFn,
} from '#/server/fns/master-data.ts'

export const Route = createFileRoute('/master-data')({
  // The active tab lives in the URL (?tab=...) so a reload stays on it
  validateSearch: z.object({
    tab: z
      .enum([
        'models',
        'suppliers',
        'banks',
        'accounts',
        'colors',
        'expenseTypes',
      ])
      .catch('models'),
    // search text of the active tab (dropped when the tab changes)
    q: z.string().optional().catch(undefined),
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'master-data.view')
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.query(masterDataQuery())
  },
  component: MasterDataPage,
})

function MasterDataPage() {
  const { user } = Route.useRouteContext()
  const { tab, q } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: master } = useSuspenseQuery(masterDataQuery())
  // Typing filters at once; the URL (?q=) follows when typing pauses
  const [search, setSearch] = useUrlText(q ?? '', (v) =>
    navigate({
      search: (prev) => ({ ...prev, q: v || undefined }),
      replace: true,
    }),
  )
  const modelsPg = usePagination(
    master.models.filter((m) => matchesSearch(search, m.name)),
    search,
  )
  const suppliersPg = usePagination(
    master.suppliers.filter((x) => matchesSearch(search, x.name)),
    search,
  )
  const banksPg = usePagination(
    master.banks.filter((b) =>
      matchesSearch(search, b.name, b.code, b.shortName),
    ),
    search,
  )
  const accountsPg = usePagination(
    master.bankAccounts.filter((a) =>
      matchesSearch(
        search,
        a.accountName,
        a.accountNumber,
        a.bankName,
        a.bankCode,
        a.bankShortName,
        a.branch,
      ),
    ),
    search,
  )
  const expenseTypesPg = usePagination(
    master.expenseTypes.filter((x) => matchesSearch(search, x.name)),
    search,
  )
  const colorsPg = usePagination(
    master.colors.filter((c) => matchesSearch(search, c.name)),
    search,
  )
  const queryClient = useQueryClient()
  // Danh mục được dùng ở lô nhập, vay, thu chi... nên làm mới toàn bộ cache
  const refresh = () => queryClient.invalidateQueries()
  const saveModel = useMutation({ mutationFn: saveModelFn, onSuccess: refresh })
  const saveExpenseType = useMutation({
    mutationFn: saveExpenseTypeFn,
    onSuccess: refresh,
  })
  const saveSupplier = useMutation({
    mutationFn: saveSupplierFn,
    onSuccess: refresh,
  })
  const saveBank = useMutation({ mutationFn: saveBankFn, onSuccess: refresh })
  const saveColor = useMutation({ mutationFn: saveColorFn, onSuccess: refresh })
  const saveAccount = useMutation({
    mutationFn: saveBankAccountFn,
    onSuccess: refresh,
  })
  const deleteItem = useMutation({
    mutationFn: deleteMasterDataFn,
    onSuccess: refresh,
  })

  // Modal Model
  const [mId, setMId] = React.useState<number | null>(null)
  const [xId, setXId] = React.useState<number | null>(null)
  const [expenseTypeOpen, setExpenseTypeOpen] = React.useState(false)
  const [xName, setXName] = React.useState('')
  const [sId, setSId] = React.useState<number | null>(null)
  const [bId, setBId] = React.useState<number | null>(null)
  const [cId, setCId] = React.useState<number | null>(null)
  const [modelOpen, setModelOpen] = React.useState(false)
  const [mName, setMName] = React.useState('')

  // Modal Supplier
  const [supplierOpen, setSupplierOpen] = React.useState(false)
  const [sName, setSName] = React.useState('')

  // Modal Bank
  const [bankOpen, setBankOpen] = React.useState(false)
  const [bName, setBName] = React.useState('')

  // Modal Company Bank Account (create / edit)
  const [accountOpen, setAccountOpen] = React.useState(false)
  const [accId, setAccId] = React.useState<number | null>(null)
  const [accBankId, setAccBankId] = React.useState<number | null>(null)
  const [accName, setAccName] = React.useState('')
  const [accNumber, setAccNumber] = React.useState('')
  const [accBranch, setAccBranch] = React.useState('')
  const [accActive, setAccActive] = React.useState(true)

  const openNewAccount = () => {
    setAccId(null)
    setAccBankId(master.banks[0]?.id ?? null)
    setAccName('')
    setAccNumber('')
    setAccBranch('')
    setAccActive(true)
    setAccountOpen(true)
  }
  const openEditAccount = (a: (typeof master.bankAccounts)[number]) => {
    setAccId(a.id)
    setAccBankId(a.bankId)
    setAccName(a.accountName)
    setAccNumber(a.accountNumber)
    setAccBranch(a.branch ?? '')
    setAccActive(a.isActive)
    setAccountOpen(true)
  }

  // Modal Color
  const [colorOpen, setColorOpen] = React.useState(false)
  const [cName, setCName] = React.useState('')
  const [cHex, setCHex] = React.useState('#18181b')

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveModel.mutateAsync({
        data: { id: mId ?? undefined, name: mName },
      })
      setModelOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu loại xe')
    }
  }

  const handleSaveExpenseType = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveExpenseType.mutateAsync({
        data: { id: xId ?? undefined, name: xName },
      })
      setExpenseTypeOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu loại chi phí')
    }
  }

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveSupplier.mutateAsync({
        data: { id: sId ?? undefined, name: sName },
      })
      setSupplierOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu nhà cung cấp')
    }
  }

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveBank.mutateAsync({
        data: { id: bId ?? undefined, name: bName },
      })
      setBankOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu ngân hàng')
    }
  }

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accBankId) {
      await alertDialog('Chưa chọn ngân hàng cho tài khoản')
      return
    }
    try {
      await saveAccount.mutateAsync({
        data: {
          id: accId ?? undefined,
          bankId: accBankId,
          accountName: accName,
          accountNumber: accNumber,
          branch: accBranch.trim() || null,
          isActive: accActive,
        },
      })
      setAccountOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu tài khoản ngân hàng')
    }
  }

  const handleSaveColor = async (e: React.FormEvent) => {
    e.preventDefault()
    const hex = cHex.trim() ? normalizeHex(cHex) : null
    if (cHex.trim() && !hex) {
      await alertDialog('Mã màu hex không hợp lệ. Ví dụ: #990000')
      return
    }
    try {
      await saveColor.mutateAsync({
        data: { id: cId ?? undefined, name: cName, hex },
      })
      setColorOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu màu sắc')
    }
  }

  const handleDelete = async (
    entity:
      | 'motorcycleModels'
      | 'suppliers'
      | 'banks'
      | 'companyBankAccounts'
      | 'colors'
      | 'expenseTypes',
    id: number,
    name: string,
  ) => {
    // Used rows show what uses them; unused rows ask for confirmation
    if (
      !(await confirmDelete(
        { entity, id, name },
        {
          title: `Xóa "${name}"?`,
          description: 'Hành động này không thể hoàn tác.',
        },
      ))
    )
      return
    try {
      await deleteItem.mutateAsync({ data: { entity, id } })
    } catch (err: unknown) {
      await reportDeleteFailure(
        err,
        { entity, id, name },
        'Không thể xóa mục đang được sử dụng',
      )
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Danh Mục Dữ Liệu Cốt Lõi (Master Data)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý Dòng xe, Nhà cung cấp nhập khẩu, Ngân hàng, Tài khoản ngân
            hàng của công ty và Bảng màu chuẩn hóa toàn hệ thống.
          </p>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) =>
            navigate({ search: { tab: v as typeof tab }, replace: true })
          }
          className="space-y-4"
        >
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger
              value="models"
              className="text-xs font-semibold gap-1.5"
            >
              <Boxes className="size-3.5" />
              Dòng Xe ({master.models.length})
            </TabsTrigger>
            <TabsTrigger
              value="suppliers"
              className="text-xs font-semibold gap-1.5"
            >
              <Truck className="size-3.5" />
              Nhà Cung Cấp ({master.suppliers.length})
            </TabsTrigger>
            <TabsTrigger
              value="banks"
              className="text-xs font-semibold gap-1.5"
            >
              <Landmark className="size-3.5" />
              Ngân Hàng ({master.banks.length})
            </TabsTrigger>
            <TabsTrigger
              value="accounts"
              className="text-xs font-semibold gap-1.5"
            >
              <CreditCard className="size-3.5" />
              Tài Khoản Ngân Hàng ({master.bankAccounts.length})
            </TabsTrigger>
            <TabsTrigger
              value="colors"
              className="text-xs font-semibold gap-1.5"
            >
              <Palette className="size-3.5" />
              Màu Sắc ({master.colors.length})
            </TabsTrigger>
            <TabsTrigger
              value="expenseTypes"
              className="text-xs font-semibold gap-1.5"
            >
              <Receipt className="size-3.5" />
              Loại Chi Phí ({master.expenseTypes.length})
            </TabsTrigger>
          </TabsList>

          {/* Motorcycle models */}
          <TabsContent value="models">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Danh Sách Dòng Xe Máy Nhập Khẩu
                </CardTitle>
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Tìm dòng xe..."
                  className="ml-auto mr-3 w-72"
                />
                <Can permission="master-data.manage">
                  <Button
                    size="sm"
                    onClick={() => {
                      setMId(null)
                      setMName('')
                      setModelOpen(true)
                    }}
                    className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                  >
                    <Plus className="size-3.5" />
                    Thêm Dòng Xe
                  </Button>
                </Can>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Tên Xe</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {modelsPg.pageItems.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium text-slate-900">
                          {m.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Can permission="master-data.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setMId(m.id)
                                  setMName(m.name)
                                  setModelOpen(true)
                                }}
                                className="size-7 text-slate-400 hover:text-emerald-700"
                                aria-label="Sửa"
                                title="Sửa"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </Can>
                            <Can permission="master-data.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDelete('motorcycleModels', m.id, m.name)
                                }
                                className="size-7 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </Can>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={modelsPg} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expense types */}
          <TabsContent value="expenseTypes">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Danh Sách Loại Chi Phí Lô Xe
                </CardTitle>
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Tìm loại chi phí..."
                  className="ml-auto mr-3 w-72"
                />
                <Can permission="master-data.manage">
                  <Button
                    size="sm"
                    onClick={() => {
                      setXId(null)
                      setXName('')
                      setExpenseTypeOpen(true)
                    }}
                    className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                  >
                    <Plus className="size-3.5" />
                    Thêm Loại Chi Phí
                  </Button>
                </Can>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Tên Loại Chi Phí</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {expenseTypesPg.pageItems.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium text-slate-900">
                          {m.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Can permission="master-data.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setXId(m.id)
                                  setXName(m.name)
                                  setExpenseTypeOpen(true)
                                }}
                                className="size-7 text-slate-400 hover:text-emerald-700"
                                aria-label="Sửa"
                                title="Sửa"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </Can>
                            <Can permission="master-data.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDelete('expenseTypes', m.id, m.name)
                                }
                                className="size-7 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </Can>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={expenseTypesPg} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suppliers */}
          <TabsContent value="suppliers">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Danh Sách Nhà Cung Cấp
                </CardTitle>
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Tìm nhà cung cấp..."
                  className="ml-auto mr-3 w-72"
                />
                <Can permission="master-data.manage">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSId(null)
                      setSName('')
                      setSupplierOpen(true)
                    }}
                    className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                  >
                    <Plus className="size-3.5" />
                    Thêm Nhà Cung Cấp
                  </Button>
                </Can>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Tên Công Ty Cung Cấp</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {suppliersPg.pageItems.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-slate-900">
                          {s.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Can permission="master-data.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSId(s.id)
                                  setSName(s.name)
                                  setSupplierOpen(true)
                                }}
                                className="size-7 text-slate-400 hover:text-emerald-700"
                                aria-label="Sửa"
                                title="Sửa"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </Can>
                            <Can permission="master-data.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDelete('suppliers', s.id, s.name)
                                }
                                className="size-7 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </Can>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={suppliersPg} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Banks */}
          <TabsContent value="banks">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Danh Sách Ngân Hàng Cho Vay & Tài Khoản Công Ty
                </CardTitle>
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Tìm tên, mã hoặc tên viết tắt ngân hàng..."
                  className="ml-auto mr-3 w-72"
                />
                <Can permission="master-data.manage">
                  <Button
                    size="sm"
                    onClick={() => {
                      setBId(null)
                      setBName('')
                      setBankOpen(true)
                    }}
                    className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                  >
                    <Plus className="size-3.5" />
                    Thêm Ngân Hàng
                  </Button>
                </Can>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Tên Ngân Hàng</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {banksPg.pageItems.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium text-slate-900">
                          <BankLabel image={b.image} name={b.name}>
                            {b.name}
                          </BankLabel>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Can permission="master-data.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setBId(b.id)
                                  setBName(b.name)
                                  setBankOpen(true)
                                }}
                                className="size-7 text-slate-400 hover:text-emerald-700"
                                aria-label="Sửa"
                                title="Sửa"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </Can>
                            <Can permission="master-data.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDelete('banks', b.id, b.name)
                                }
                                className="size-7 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </Can>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={banksPg} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Company bank accounts */}
          <TabsContent value="accounts">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Danh Sách Tài Khoản Ngân Hàng Của Công Ty
                </CardTitle>
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Tìm tên tài khoản, số tài khoản, ngân hàng..."
                  className="ml-auto mr-3 w-72"
                />
                <Can permission="master-data.manage">
                  <Button
                    size="sm"
                    onClick={openNewAccount}
                    className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                  >
                    <Plus className="size-3.5" />
                    Thêm Tài Khoản
                  </Button>
                </Can>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Tên Tài Khoản</TableHead>
                      <TableHead>Ngân Hàng</TableHead>
                      <TableHead>Số Tài Khoản</TableHead>
                      <TableHead>Chi Nhánh</TableHead>
                      <TableHead className="text-center">Trạng Thái</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {accountsPg.pageItems.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-slate-900">
                          {a.accountName}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          <BankLabel image={a.bankImage} name={a.bankName}>
                            {a.bankName}
                          </BankLabel>
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {a.accountNumber}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {a.branch || '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={
                              a.isActive
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-slate-100 text-slate-600'
                            }
                          >
                            {a.isActive ? 'Đang dùng' : 'Ngừng dùng'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Can permission="master-data.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditAccount(a)}
                                className="size-7 text-slate-400 hover:text-emerald-700"
                                aria-label="Sửa"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </Can>
                            <Can permission="master-data.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDelete(
                                    'companyBankAccounts',
                                    a.id,
                                    a.accountNumber,
                                  )
                                }
                                className="size-7 text-slate-400 hover:text-rose-600"
                                aria-label="Xóa"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </Can>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={accountsPg} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Colors */}
          <TabsContent value="colors">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Bảng Màu Sắc Xe Chuẩn Hóa
                </CardTitle>
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Tìm màu sắc..."
                  className="ml-auto mr-3 w-72"
                />
                <Can permission="master-data.manage">
                  <Button
                    size="sm"
                    onClick={() => {
                      setCId(null)
                      setCName('')
                      setCHex('#18181b')
                      setColorOpen(true)
                    }}
                    className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                  >
                    <Plus className="size-3.5" />
                    Thêm Màu
                  </Button>
                </Can>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Tên Màu Sắc</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {colorsPg.pageItems.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 font-medium text-slate-900">
                            {c.hex && (
                              <span
                                className="size-3.5 rounded-full inline-block border border-slate-300"
                                style={{ backgroundColor: c.hex }}
                              />
                            )}
                            {c.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Can permission="master-data.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setCId(c.id)
                                  setCName(c.name)
                                  setCHex(c.hex ?? '#18181b')
                                  setColorOpen(true)
                                }}
                                className="size-7 text-slate-400 hover:text-emerald-700"
                                aria-label="Sửa"
                                title="Sửa"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </Can>
                            <Can permission="master-data.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDelete('colors', c.id, c.name)
                                }
                                className="size-7 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </Can>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={colorsPg} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Motorcycle Model Modal */}
        <Dialog open={modelOpen} onOpenChange={setModelOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {mId ? 'Sửa Dòng Xe' : 'Thêm Dòng Xe Mới'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveModel} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tên Xe *</Label>
                <Input
                  required
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Honda SH 150i ABS"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModelOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={saveModel.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {saveModel.isPending ? 'Đang lưu...' : 'Lưu Dòng Xe'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Expense Type Modal */}
        <Dialog open={expenseTypeOpen} onOpenChange={setExpenseTypeOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {xId ? 'Sửa Loại Chi Phí' : 'Thêm Loại Chi Phí'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveExpenseType} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Tên Loại Chi Phí *
                </Label>
                <Input
                  required
                  value={xName}
                  onChange={(e) => setXName(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Thuế nhập khẩu"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExpenseTypeOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={saveExpenseType.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {saveExpenseType.isPending
                    ? 'Đang lưu...'
                    : 'Lưu Loại Chi Phí'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Supplier Modal */}
        <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {sId ? 'Sửa Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveSupplier} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Tên Doanh Nghiệp Cung Cấp *
                </Label>
                <Input
                  required
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Thai Honda Co., Ltd"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSupplierOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={saveSupplier.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {saveSupplier.isPending ? 'Đang lưu...' : 'Lưu Nhà Cung Cấp'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Bank Modal */}
        <Dialog open={bankOpen} onOpenChange={setBankOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {bId ? 'Sửa Ngân Hàng' : 'Thêm Ngân Hàng'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveBank} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tên Đầy Đủ *</Label>
                <Input
                  required
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Ngân hàng TMCP Ngoại thương Việt Nam"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBankOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={saveBank.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {saveBank.isPending ? 'Đang lưu...' : 'Lưu Ngân Hàng'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Company Bank Account Modal */}
        <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {accId ? 'Sửa Tài Khoản Ngân Hàng' : 'Thêm Tài Khoản Ngân Hàng'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveAccount} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tên Tài Khoản *</Label>
                <Input
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="CÔNG TY TNHH TM DV TRƯỜNG THỊNH PHÁT"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ngân Hàng *</Label>
                <SearchSelect
                  className="h-8 w-full text-xs"
                  placeholder="Chọn ngân hàng"
                  value={accBankId ? String(accBankId) : ''}
                  onValueChange={(v) => setAccBankId(Number(v))}
                >
                  {master.banks.map((b) => (
                    <SearchSelectItem
                      key={b.id}
                      value={String(b.id)}
                      keywords={`${b.code ?? ''} ${b.shortName ?? ''}`}
                      className="text-xs"
                    >
                      <BankLabel image={b.image} name={b.name}>
                        {b.name}
                      </BankLabel>
                    </SearchSelectItem>
                  ))}
                </SearchSelect>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Số Tài Khoản *</Label>
                <Input
                  required
                  value={accNumber}
                  onChange={(e) => setAccNumber(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="0071001234567"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Chi Nhánh</Label>
                <Input
                  value={accBranch}
                  onChange={(e) => setAccBranch(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Chi nhánh TP. Hồ Chí Minh"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Đang sử dụng</Label>
                <Switch checked={accActive} onCheckedChange={setAccActive} />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAccountOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={saveAccount.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {saveAccount.isPending ? 'Đang lưu...' : 'Lưu Tài Khoản'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Color Modal */}
        <Dialog open={colorOpen} onOpenChange={setColorOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {cId ? 'Sửa Màu Sắc' : 'Thêm Màu Sắc Chuẩn'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveColor} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tên Màu *</Label>
                <Input
                  required
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Đỏ Đô"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Mã Màu Hex</Label>
                <ColorPicker value={cHex} onChange={setCHex} />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setColorOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={saveColor.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {saveColor.isPending ? 'Đang lưu...' : 'Lưu Màu Sắc'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
