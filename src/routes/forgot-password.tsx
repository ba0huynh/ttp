import { formatErrorMessage } from '#/components/ui/confirm-dialog.tsx'
import { useMutation } from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Mail } from 'lucide-react'
import * as React from 'react'

import { AuthAlert, AuthShell } from '#/components/layout/AuthShell.tsx'
import { Button } from '#/components/ui/button.tsx'
import { CardContent, CardFooter } from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { currentUserQuery } from '#/lib/queries.ts'
import { forgotPasswordFn } from '#/server/fns/auth.ts'

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (user) throw redirect({ to: '/' })
  },
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const forgot = useMutation({ mutationFn: forgotPasswordFn })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await forgot.mutateAsync({ data: { email } })
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Không gửi được yêu cầu'))
    }
  }

  return (
    <AuthShell
      title="Quên mật khẩu"
      description="Nhập email của tài khoản để nhận liên kết đặt lại mật khẩu"
    >
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3">
          {error && <AuthAlert tone="error">{error}</AuthAlert>}
          {forgot.isSuccess && (
            <AuthAlert tone="success">
              Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã
              được tạo. Vui lòng liên hệ quản trị viên để nhận liên kết.
              {/* Email delivery is not integrated yet; dev builds return the link directly */}
              {forgot.data.devLink && (
                <div className="mt-2">
                  <Link
                    to="/reset-password"
                    search={{
                      token:
                        new URL(
                          forgot.data.devLink,
                          'http://x',
                        ).searchParams.get('token') ?? '',
                    }}
                    className="font-semibold underline"
                  >
                    [Dev] Mở liên kết đặt lại mật khẩu
                  </Link>
                </div>
              )}
            </AuthAlert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-sm h-9"
            />
          </div>
        </CardContent>
        <CardFooter className="pt-2">
          <Button
            type="submit"
            disabled={forgot.isPending}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold h-10"
          >
            <Mail className="size-4 mr-2" />
            {forgot.isPending ? 'Đang xử lý...' : 'Gửi yêu cầu đặt lại'}
          </Button>
        </CardFooter>
      </form>
    </AuthShell>
  )
}
