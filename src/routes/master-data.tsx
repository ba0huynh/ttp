import { useBusyKeys } from '#/lib/use-busy.ts'
import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Pencil, Plus, Upload } from 'lucide-react'
import * as React from 'react'
import { z } from 'zod'

import { BankLabel, BankLogo } from '#/components/finance/BankLabel.tsx'
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
import {
  EMPTY_LOGO,
  LogoField,
  uploadImage,
} from '#/components/ui/logo-field.tsx'
import type { LogoValue } from '#/components/ui/logo-field.tsx'
import { SupplierLogo } from '#/components/ui/supplier-logo.tsx'
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
import { Tabs, TabsContent } from '#/components/ui/tabs.tsx'
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

const TAB_TITLES = {
  models: {
    title: 'Dòng Xe',
    description: 'Dòng xe, đời xe và thông tin chi tiết.',
  },
  suppliers: {
    title: 'Nhà Cung Cấp',
    description: 'Đơn vị cung cấp xe nhập khẩu.',
  },
  banks: {
    title: 'Ngân Hàng',
    description: 'Danh mục ngân hàng (tên và logo).',
  },
  accounts: {
    title: 'Tài Khoản Ngân Hàng',
    description: 'Tài khoản ngân hàng của công ty dùng cho thu chi và vay.',
  },
  colors: {
    title: 'Màu Sắc',
    description: 'Bảng màu xe chuẩn hóa toàn hệ thống.',
  },
  expenseTypes: {
    title: 'Loại Chi Phí',
    description:
      'Các loại chi phí của lô nhập (thuế, vận chuyển, hải quan...).',
  },
} as const

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
    master.models.filter((m) =>
      matchesSearch(search, m.brand, m.name, m.modelYear),
    ),
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
  const [mBrand, setMBrand] = React.useState('')
  const [mYear, setMYear] = React.useState('')
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
  const [sLogo, setSLogo] = React.useState<LogoValue>(EMPTY_LOGO)
  const [supplierSaving, setSupplierSaving] = React.useState(false)

  // Modal Bank
  const [bankOpen, setBankOpen] = React.useState(false)
  const [bName, setBName] = React.useState('')
  const [bImage, setBImage] = React.useState('')
  // A picked logo stays in the browser (preview only) until the bank is saved
  const [bFile, setBFile] = React.useState<File | null>(null)
  const [bPreview, setBPreview] = React.useState('')
  const [bankSaving, setBankSaving] = React.useState(false)
  const logoInput = React.useRef<HTMLInputElement>(null)

  const clearLogoFile = () => {
    if (bPreview) URL.revokeObjectURL(bPreview)
    setBFile(null)
    setBPreview('')
  }

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      await alertDialog('Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      await alertDialog('Ảnh tối đa 2MB')
      return
    }
    clearLogoFile()
    setBFile(file)
    setBPreview(URL.createObjectURL(file))
  }

  // Sends the picked file to /api/uploads; returns its key path
  const uploadLogo = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', 'banks')
    const res = await fetch('/api/uploads', { method: 'POST', body: form })
    const body = (await res.json()) as { key?: string; error?: string }
    if (!res.ok || !body.key)
      throw new Error(body.error ?? 'Không tải được ảnh')
    return body.key
  }

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
        data: {
          id: mId ?? undefined,
          brand: mBrand || null,
          name: mName,
          modelYear: mYear || null,
        },
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
    setSupplierSaving(true)
    try {
      // The file only reaches the server now, when the supplier is saved
      const image = sLogo.file
        ? await uploadImage(sLogo.file, 'suppliers')
        : sLogo.image || null
      await saveSupplier.mutateAsync({
        data: { id: sId ?? undefined, name: sName, image },
      })
      setSupplierOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu nhà cung cấp')
    } finally {
      setSupplierSaving(false)
    }
  }

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    setBankSaving(true)
    try {
      // The file only reaches the server now, when the bank is saved
      const image = bFile ? await uploadLogo(bFile) : bImage || null
      await saveBank.mutateAsync({
        data: { id: bId ?? undefined, name: bName, image },
      })
      clearLogoFile()
      setBankOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu ngân hàng')
    } finally {
      setBankSaving(false)
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

  const { isBusy, setBusy } = useBusyKeys()

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
    const key = `${entity}:${id}`
    if (
      !(await confirmDelete(
        { entity, id, name },
        {
          title: `Xóa "${name}"?`,
          description: 'Hành động này không thể hoàn tác.',
        },
        (checking) => setBusy(key, checking),
      ))
    )
      return
    setBusy(key, true)
    try {
      await deleteItem.mutateAsync({ data: { entity, id } })
    } catch (err: unknown) {
      await reportDeleteFailure(
        err,
        { entity, id, name },
        'Không thể xóa mục đang được sử dụng',
      )
    } finally {
      setBusy(key, false)
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {TAB_TITLES[tab].title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {TAB_TITLES[tab].description}
          </p>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) =>
            navigate({ search: { tab: v as typeof tab }, replace: true })
          }
          className="space-y-4"
        >
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
                      setMBrand('')
                      setMYear('')
                      setModelOpen(true)
                    }}
                    className="h-9 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
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
                      <TableHead>Dòng Xe</TableHead>
                      <TableHead>Đời Xe</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {modelsPg.pageItems.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium text-slate-900">
                          {m.name}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {m.modelYear}
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
                                  setMBrand(m.brand ?? '')
                                  setMYear(m.modelYear ?? '')
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
                                disabled={isBusy('motorcycleModels:' + m.id)}
                                className="size-7 text-slate-400 hover:text-rose-600"
                              >
                                <BusyTrash
                                  busy={isBusy('motorcycleModels:' + m.id)}
                                />
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
                    className="h-9 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
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
                                disabled={isBusy('expenseTypes:' + m.id)}
                                className="size-7 text-slate-400 hover:text-rose-600"
                              >
                                <BusyTrash
                                  busy={isBusy('expenseTypes:' + m.id)}
                                />
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
                      setSLogo(EMPTY_LOGO)
                      setSupplierOpen(true)
                    }}
                    className="h-9 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
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
                          <span className="inline-flex max-w-full min-w-0 items-center gap-2">
                            <SupplierLogo src={s.image} name={s.name} />
                            <span className="truncate">{s.name}</span>
                          </span>
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
                                  setSLogo({ image: s.image ?? '', file: null })
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
                                disabled={isBusy('suppliers:' + s.id)}
                                className="size-7 text-slate-400 hover:text-rose-600"
                              >
                                <BusyTrash busy={isBusy('suppliers:' + s.id)} />
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
                      setBImage('')
                      clearLogoFile()
                      setBankOpen(true)
                    }}
                    className="h-9 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
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
                                  setBImage(b.image ?? '')
                                  clearLogoFile()
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
                                disabled={isBusy('banks:' + b.id)}
                                className="size-7 text-slate-400 hover:text-rose-600"
                              >
                                <BusyTrash busy={isBusy('banks:' + b.id)} />
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
                    className="h-9 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
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
                                disabled={isBusy('companyBankAccounts:' + a.id)}
                                className="size-7 text-slate-400 hover:text-rose-600"
                                aria-label="Xóa"
                              >
                                <BusyTrash
                                  busy={isBusy('companyBankAccounts:' + a.id)}
                                />
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
                    className="h-9 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
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
                                disabled={isBusy('colors:' + c.id)}
                                className="size-7 text-slate-400 hover:text-rose-600"
                              >
                                <BusyTrash busy={isBusy('colors:' + c.id)} />
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
                <Label className="text-xs font-semibold">Dòng Xe *</Label>
                <Input
                  required
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                  placeholder="SH 150i ABS"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Đời Xe</Label>
                <Input
                  value={mYear}
                  onChange={(e) => setMYear(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                  placeholder="2025"
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
                  className="h-11 text-sm px-4 rounded-lg"
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
                  className="h-11 text-sm px-4 rounded-lg"
                  placeholder="Thai Honda Co., Ltd"
                />
              </div>
              <LogoField
                value={sLogo}
                onChange={setSLogo}
                name={sName}
                label="Hình Ảnh"
              />
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
                  disabled={saveSupplier.isPending || supplierSaving}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {saveSupplier.isPending || supplierSaving
                    ? 'Đang lưu...'
                    : 'Lưu Nhà Cung Cấp'}
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
                  className="h-11 text-sm px-4 rounded-lg"
                  placeholder="Ngân hàng TMCP Ngoại thương Việt Nam"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Logo</Label>
                <div className="flex items-stretch gap-3">
                  <div className="flex h-32 w-1/2 items-center justify-center rounded-lg border border-border bg-white p-2">
                    <BankLogo
                      key={bPreview || bImage}
                      src={bPreview || bImage}
                      name={bName}
                      className="h-full w-full"
                    />
                  </div>
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleLogoFile}
                  />
                  <div className="flex w-1/2 flex-col items-start justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoInput.current?.click()}
                      className="h-8 text-xs gap-1"
                    >
                      <Upload className="size-3.5" />
                      Chọn ảnh
                    </Button>
                    {(bImage || bFile) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBImage('')
                          clearLogoFile()
                        }}
                        className="h-8 text-xs text-slate-500"
                      >
                        Xóa ảnh
                      </Button>
                    )}
                  </div>
                </div>
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
                  disabled={saveBank.isPending || bankSaving}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {saveBank.isPending || bankSaving
                    ? 'Đang lưu...'
                    : 'Lưu Ngân Hàng'}
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
                  className="h-11 text-sm px-4 rounded-lg"
                  placeholder="CÔNG TY TNHH TM DV TRƯỜNG THỊNH PHÁT"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ngân Hàng *</Label>
                <SearchSelect
                  className="h-11 w-full text-sm rounded-lg"
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
                  className="h-11 text-sm px-4 rounded-lg"
                  placeholder="0071001234567"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Chi Nhánh</Label>
                <Input
                  value={accBranch}
                  onChange={(e) => setAccBranch(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
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
                  className="h-11 text-sm px-4 rounded-lg"
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
