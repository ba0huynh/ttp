import { formatErrorMessage } from '#/components/ui/confirm-dialog.tsx'
import { useMutation } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { KeyRound } from 'lucide-react'
import * as React from 'react'
import { z } from 'zod'

import { AuthAlert, AuthShell } from '#/components/layout/AuthShell.tsx'
import { Button } from '#/components/ui/button.tsx'
import { CardContent, CardFooter } from '#/components/ui/card.tsx'
import { PasswordInput } from '#/components/ui/password-input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { resetPasswordFn } from '#/server/fns/auth.ts'

export const Route = createFileRoute('/reset-password')({
  validateSearch: z.object({ token: z.string().catch('') }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const reset = useMutation({ mutationFn: resetPasswordFn })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) return setError('Mật khẩu nhập lại không khớp')
    try {
      await reset.mutateAsync({ data: { token, password } })
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Không đặt lại được mật khẩu'))
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="Liên kết không hợp lệ"
        description="Thiếu mã đặt lại mật khẩu"
      >
        <CardContent>
          <AuthAlert tone="error">
            Liên kết đặt lại mật khẩu không hợp lệ. Vui lòng{' '}
            <Link to="/forgot-password" className="font-semibold underline">
              yêu cầu liên kết mới
            </Link>
            .
          </AuthAlert>
        </CardContent>
      </AuthShell>
    )
  }

  if (reset.isSuccess) {
    return (
      <AuthShell
        title="Đã đặt lại mật khẩu"
        description="Bạn có thể đăng nhập bằng mật khẩu mới"
      >
        <CardContent>
          <Button
            asChild
            className="w-full bg-emerald-700 hover:bg-emerald-800"
          >
            <Link to="/login">Đến trang đăng nhập</Link>
          </Button>
        </CardContent>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Đặt lại mật khẩu"
      description="Nhập mật khẩu mới cho tài khoản của bạn"
    >
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3">
          {error && <AuthAlert tone="error">{error}</AuthAlert>}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold">
              Mật khẩu mới (tối thiểu 8 ký tự) *
            </Label>
            <PasswordInput
              id="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-sm h-11 px-4 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-xs font-semibold">
              Nhập lại mật khẩu mới *
            </Label>
            <PasswordInput
              id="confirm"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="text-sm h-11 px-4 rounded-lg"
            />
          </div>
        </CardContent>
        <CardFooter className="pt-2">
          <Button
            type="submit"
            disabled={reset.isPending}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold h-10"
          >
            <KeyRound className="size-4 mr-2" />
            {reset.isPending ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
          </Button>
        </CardFooter>
      </form>
    </AuthShell>
  )
}
