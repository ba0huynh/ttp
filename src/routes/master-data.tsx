import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Boxes, Landmark, Palette, Plus, Trash2, Truck } from 'lucide-react'
import * as React from 'react'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Button } from '#/components/ui/button.tsx'
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
import { Label } from '#/components/ui/label.tsx'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui/tabs.tsx'
import { masterDataQuery, currentUserQuery } from '#/lib/queries.ts'
import {
  deleteMasterDataFn,
  saveBankFn,
  saveColorFn,
  saveModelFn,
  saveSupplierFn,
} from '#/server/fns/master-data.ts'

export const Route = createFileRoute('/master-data')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.query(masterDataQuery())
  },
  component: MasterDataPage,
})

function MasterDataPage() {
  const { user } = Route.useRouteContext()
  const { data: master } = useSuspenseQuery(masterDataQuery())
  const queryClient = useQueryClient()
  // Danh mục được dùng ở lô nhập, vay, thu chi... nên làm mới toàn bộ cache
  const refresh = () => queryClient.invalidateQueries()
  const saveModel = useMutation({ mutationFn: saveModelFn, onSuccess: refresh })
  const saveSupplier = useMutation({
    mutationFn: saveSupplierFn,
    onSuccess: refresh,
  })
  const saveBank = useMutation({ mutationFn: saveBankFn, onSuccess: refresh })
  const saveColor = useMutation({ mutationFn: saveColorFn, onSuccess: refresh })
  const deleteItem = useMutation({
    mutationFn: deleteMasterDataFn,
    onSuccess: refresh,
  })

  // Modal Model
  const [modelOpen, setModelOpen] = React.useState(false)
  const [mCode, setMCode] = React.useState('')
  const [mName, setMName] = React.useState('')
  const [mBrand, setMBrand] = React.useState('Honda')
  const [mCc, setMCc] = React.useState(150)

  // Modal Supplier
  const [supplierOpen, setSupplierOpen] = React.useState(false)
  const [sCode, setSCode] = React.useState('')
  const [sName, setSName] = React.useState('')
  const [sCountry, setSCountry] = React.useState('Thái Lan')

  // Modal Bank
  const [bankOpen, setBankOpen] = React.useState(false)
  const [bCode, setBCode] = React.useState('')
  const [bName, setBName] = React.useState('')
  const [bShort, setBShort] = React.useState('')

  // Modal Color
  const [colorOpen, setColorOpen] = React.useState(false)
  const [cCode, setCCode] = React.useState('')
  const [cName, setCName] = React.useState('')
  const [cHex, setCHex] = React.useState('#18181b')

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveModel.mutateAsync({
        data: { code: mCode, name: mName, brand: mBrand, engineCapacity: mCc },
      })
      setModelOpen(false)
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi lưu loại xe')
    }
  }

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveSupplier.mutateAsync({
        data: { code: sCode, name: sName, country: sCountry },
      })
      setSupplierOpen(false)
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi lưu nhà cung cấp')
    }
  }

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveBank.mutateAsync({
        data: { code: bCode, name: bName, shortName: bShort },
      })
      setBankOpen(false)
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi lưu ngân hàng')
    }
  }

  const handleSaveColor = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveColor.mutateAsync({
        data: { code: cCode, name: cName, hex: cHex },
      })
      setColorOpen(false)
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi lưu màu sắc')
    }
  }

  const handleDelete = async (entity: any, id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa mục danh mục này?')) return
    try {
      await deleteItem.mutateAsync({ data: { entity, id } })
    } catch (err: unknown) {
      alert((err as Error).message || 'Không thể xóa mục đang được sử dụng')
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
            Quản lý Dòng xe, Nhà cung cấp nhập khẩu, Ngân hàng và Bảng màu chuẩn
            hóa toàn hệ thống.
          </p>
        </div>

        <Tabs defaultValue="models" className="space-y-4">
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
              value="colors"
              className="text-xs font-semibold gap-1.5"
            >
              <Palette className="size-3.5" />
              Màu Sắc ({master.colors.length})
            </TabsTrigger>
          </TabsList>

          {/* Motorcycle models */}
          <TabsContent value="models">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Danh Sách Dòng Xe Máy Nhập Khẩu
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setMCode('')
                    setMName('')
                    setModelOpen(true)
                  }}
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                >
                  <Plus className="size-3.5" />
                  Thêm Dòng Xe
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Mã Dòng Xe</TableHead>
                      <TableHead>Tên Thương Mại</TableHead>
                      <TableHead>Hãng Xe</TableHead>
                      <TableHead className="text-center">
                        Dung Tích Động Cơ
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {master.models.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono font-bold text-slate-900">
                          {m.code}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800">
                          {m.name}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {m.brand}
                        </TableCell>
                        <TableCell className="text-center">
                          {m.engineCapacity ? `${m.engineCapacity}cc` : '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleDelete('motorcycleModels', m.id)
                            }
                            className="size-7 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suppliers */}
          <TabsContent value="suppliers">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Danh Sách Nhà Cung Cấp Nước Ngoài
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setSCode('')
                    setSName('')
                    setSupplierOpen(true)
                  }}
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                >
                  <Plus className="size-3.5" />
                  Thêm Nhà Cung Cấp
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Mã NCC</TableHead>
                      <TableHead>Tên Công Ty Cung Cấp</TableHead>
                      <TableHead>Quốc Gia</TableHead>
                      <TableHead>Liên Hệ / Điện Thoại</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {master.suppliers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono font-bold text-slate-900">
                          {s.code}
                        </TableCell>
                        <TableCell className="font-bold text-slate-900">
                          {s.name}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {s.country ?? '—'}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {s.contactPerson ?? s.phone ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete('suppliers', s.id)}
                            className="size-7 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <Button
                  size="sm"
                  onClick={() => {
                    setBCode('')
                    setBName('')
                    setBShort('')
                    setBankOpen(true)
                  }}
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                >
                  <Plus className="size-3.5" />
                  Thêm Ngân Hàng
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Mã</TableHead>
                      <TableHead>Tên Ngân Hàng</TableHead>
                      <TableHead>Tên Viết Tắt</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {master.banks.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono font-bold text-slate-900">
                          {b.code}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900">
                          {b.name}
                        </TableCell>
                        <TableCell className="font-bold text-emerald-800">
                          {b.shortName}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete('banks', b.id)}
                            className="size-7 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <Button
                  size="sm"
                  onClick={() => {
                    setCCode('')
                    setCName('')
                    setColorOpen(true)
                  }}
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                >
                  <Plus className="size-3.5" />
                  Thêm Màu
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Mã Màu</TableHead>
                      <TableHead>Tên Màu Sắc</TableHead>
                      <TableHead>Mã Hex</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {master.colors.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono font-bold text-slate-900">
                          {c.code}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-semibold text-slate-800">
                            {c.hex && (
                              <span
                                className="size-3.5 rounded-full inline-block border border-slate-300"
                                style={{ backgroundColor: c.hex }}
                              />
                            )}
                            {c.name}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-slate-500">
                          {c.hex ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete('colors', c.id)}
                            className="size-7 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Motorcycle Model Modal */}
        <Dialog open={modelOpen} onOpenChange={setModelOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Thêm Dòng Xe Mới
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveModel} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Mã Dòng Xe *</Label>
                <Input
                  required
                  value={mCode}
                  onChange={(e) => setMCode(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="SH150-ABS"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Tên Thương Mại *
                </Label>
                <Input
                  required
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Honda SH 150i ABS"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Hãng Xe</Label>
                  <Input
                    value={mBrand}
                    onChange={(e) => setMBrand(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Dung Tích (cc)
                  </Label>
                  <Input
                    type="number"
                    value={mCc}
                    onChange={(e) => setMCc(Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>
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

        {/* Add Supplier Modal */}
        <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Thêm Nhà Cung Cấp
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveSupplier} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Mã Nhà Cung Cấp *
                </Label>
                <Input
                  required
                  value={sCode}
                  onChange={(e) => setSCode(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="THAI-HONDA"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Tên Doanh Nghiệp Cung Cấp *
                </Label>
                <Input
                  required
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  className="h-8 text-xs font-semibold"
                  placeholder="Thai Honda Co., Ltd"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Quốc Gia</Label>
                <Input
                  value={sCountry}
                  onChange={(e) => setSCountry(e.target.value)}
                  className="h-8 text-xs"
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
                Thêm Ngân Hàng
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveBank} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Mã Ngân Hàng *</Label>
                <Input
                  required
                  value={bCode}
                  onChange={(e) => setBCode(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="VCB"
                />
              </div>
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
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tên Viết Tắt *</Label>
                <Input
                  required
                  value={bShort}
                  onChange={(e) => setBShort(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Vietcombank"
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

        {/* Add Color Modal */}
        <Dialog open={colorOpen} onOpenChange={setColorOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Thêm Màu Sắc Chuẩn
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveColor} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Mã Màu *</Label>
                <Input
                  required
                  value={cCode}
                  onChange={(e) => setCCode(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="RED"
                />
              </div>
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
                <Input
                  value={cHex}
                  onChange={(e) => setCHex(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="#990000"
                />
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
