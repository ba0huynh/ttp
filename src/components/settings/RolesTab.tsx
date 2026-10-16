import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { Checkbox } from '#/components/ui/checkbox.tsx'
import {
  confirmDialog,
  showErrorDialog,
} from '#/components/ui/confirm-dialog.tsx'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx'
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '#/lib/permissions.ts'
import { reportDeleteFailure } from '#/lib/usage.ts'
import { deleteRoleFn, saveRoleFn } from '#/server/fns/system.ts'

export interface RoleRow {
  id: number
  name: string
  description: string | null
  isAdmin: boolean
  userCount: number
  permissions: string[]
}

/** Settings tab: create roles and choose which permissions each role holds */
export function RolesTab({ roles }: { roles: RoleRow[] }) {
  const queryClient = useQueryClient()
  // Roles change what users may do, and user lists show role names
  const refresh = () => queryClient.invalidateQueries()
  const saveRole = useMutation({ mutationFn: saveRoleFn, onSuccess: refresh })
  const deleteRole = useMutation({
    mutationFn: deleteRoleFn,
    onSuccess: refresh,
  })

  const [open, setOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<number | undefined>(undefined)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  const openNew = () => {
    setEditId(undefined)
    setName('')
    setDescription('')
    setSelected(new Set())
    setOpen(true)
  }
  const openEdit = (r: RoleRow) => {
    setEditId(r.id)
    setName(r.name)
    setDescription(r.description ?? '')
    setSelected(new Set(r.permissions))
    setOpen(true)
  }

  const toggle = (key: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  const toggleGroup = (keys: readonly string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const k of keys) {
        if (on) next.add(k)
        else next.delete(k)
      }
      return next
    })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveRole.mutateAsync({
        data: {
          id: editId,
          name,
          description: description.trim() || null,
          permissions: ALL_PERMISSIONS.filter((k) => selected.has(k)),
        },
      })
      setOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu vai trò')
    }
  }

  const handleDelete = async (r: RoleRow) => {
    const ok = await confirmDialog({
      title: `Xóa vai trò "${r.name}"?`,
      description: 'Chỉ xóa được khi chưa có người dùng nào giữ vai trò này.',
      confirmLabel: 'Xóa',
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteRole.mutateAsync({ data: { id: r.id } })
    } catch (err: unknown) {
      await reportDeleteFailure(
        err,
        { entity: 'roles', id: r.id, name: r.name },
        'Không thể xóa vai trò',
      )
    }
  }

  return (
    <>
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800">
            Danh Sách Vai Trò ({roles.length})
          </CardTitle>
          <Button
            size="sm"
            onClick={openNew}
            className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
          >
            <Plus className="size-3.5" />
            Thêm Vai Trò
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs bg-slate-50">
                <TableHead>Tên Vai Trò</TableHead>
                <TableHead>Mô Tả</TableHead>
                <TableHead className="text-center">Quyền</TableHead>
                <TableHead className="text-center">Người Dùng</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-slate-900">
                    {r.name}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {r.description || '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.isAdmin ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-800 border-emerald-300 gap-1 text-[11px]"
                      >
                        <ShieldCheck className="size-3" />
                        Toàn quyền
                      </Badge>
                    ) : (
                      <span className="font-medium">
                        {r.permissions.length}/{ALL_PERMISSIONS.length}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{r.userCount}</TableCell>
                  <TableCell>
                    {!r.isAdmin && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(r)}
                          className="size-7 text-slate-400 hover:text-emerald-700"
                          aria-label="Sửa"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(r)}
                          className="size-7 text-slate-400 hover:text-rose-600"
                          aria-label="Xóa"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editId ? 'Sửa Vai Trò' : 'Thêm Vai Trò'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tên Vai Trò *</Label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Ví dụ: Trưởng kho"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Mô Tả</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={255}
                  rows={2}
                  className="min-h-16 text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Quyền Của Vai Trò ({selected.size}/{ALL_PERMISSIONS.length})
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PERMISSION_GROUPS.map((g) => {
                  const keys: readonly string[] = g.items.map((i) => i.key)
                  const all = keys.every((k) => selected.has(k))
                  return (
                    <div
                      key={g.key}
                      className="rounded-lg border border-slate-200 p-3 space-y-2"
                    >
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                        <Checkbox
                          checked={all}
                          onCheckedChange={(v) => toggleGroup(keys, v === true)}
                        />
                        {g.label}
                      </label>
                      <div className="space-y-1.5 pl-6">
                        {g.items.map((i) => (
                          <label
                            key={i.key}
                            className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                          >
                            <Checkbox
                              checked={selected.has(i.key)}
                              onCheckedChange={(v) => toggle(i.key, v === true)}
                            />
                            {i.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={saveRole.isPending}
                size="sm"
                className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                {saveRole.isPending ? 'Đang lưu...' : 'Lưu Vai Trò'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
