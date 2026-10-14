import { useMutation } from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { UserPlus } from 'lucide-react'
import * as React from 'react'

import { AuthAlert, AuthShell } from '#/components/layout/AuthShell.tsx'
import { Button } from '#/components/ui/button.tsx'
import { CardContent, CardFooter } from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { currentUserQuery } from '#/lib/queries.ts'
import { registerFn } from '#/server/fns/auth.ts'

export const Route = createFileRoute('/register')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (user) throw redirect({ to: '/' })
  },
  component: RegisterPage,
})

function RegisterPage() {
  const [form, setForm] = React.useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    confirm: '',
  })
  const [error, setError] = React.useState<string | null>(null)
  const register = useMutation({ mutationFn: registerFn })

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.password !== form.confirm)
      return setError('Mật khẩu nhập lại không khớp')
    try {
      await register.mutateAsync({
        data: {
          username: form.username,
          email: form.email,
          fullName: form.fullName,
          password: form.password,
        },
      })
    } catch (err: unknown) {
      setError((err as Error).message || 'Đăng ký không thành công')
    }
  }

  if (register.isSuccess) {
    return (
      <AuthShell
        title="Đăng ký thành công"
        description="Tài khoản của bạn đã được tạo"
      >
        <CardContent className="space-y-4">
          <AuthAlert tone="success">
            {register.data.pendingApproval
              ? 'Tài khoản đang chờ quản trị viên kích hoạt. Bạn có thể đăng nhập sau khi được duyệt.'
              : 'Bạn là người dùng đầu tiên nên đã được cấp quyền Quản trị. Hãy đăng nhập để bắt đầu.'}
          </AuthAlert>
          <Button asChild className="w-full bg-emerald-700 hover:bg-emerald-800">
            <Link to="/login">Đến trang đăng nhập</Link>
          </Button>
        </CardContent>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Đăng ký tài khoản"
      description="Tài khoản mới cần quản trị viên kích hoạt trước khi sử dụng"
    >
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3">
          {error && <AuthAlert tone="error">{error}</AuthAlert>}
          <Field label="Họ và tên" id="fullName">
            <Input
              id="fullName"
              required
              value={form.fullName}
              onChange={set('fullName')}
              className="text-sm h-9"
            />
          </Field>
          <Field label="Tên đăng nhập" id="username">
            <Input
              id="username"
              required
              autoComplete="username"
              value={form.username}
              onChange={set('username')}
              className="text-sm h-9"
            />
          </Field>
          <Field label="Email" id="email">
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              className="text-sm h-9"
            />
          </Field>
          <Field label="Mật khẩu (tối thiểu 8 ký tự)" id="password">
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
              className="text-sm h-9"
            />
          </Field>
          <Field label="Nhập lại mật khẩu" id="confirm">
            <Input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={form.confirm}
              onChange={set('confirm')}
              className="text-sm h-9"
            />
          </Field>
        </CardContent>
        <CardFooter className="pt-2">
          <Button
            type="submit"
            disabled={register.isPending}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold h-10"
          >
            <UserPlus className="size-4 mr-2" />
            {register.isPending ? 'Đang xử lý...' : 'Đăng ký'}
          </Button>
        </CardFooter>
      </form>
    </AuthShell>
  )
}

function Field({
  label,
  id,
  children,
}: {
  label: string
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold">
        {label}
      </Label>
      {children}
    </div>
  )
}
