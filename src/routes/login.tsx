import { formatErrorMessage } from '#/components/ui/confirm-dialog.tsx'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Loader2, Lock, LogIn, User } from 'lucide-react'
import * as React from 'react'
import { z } from 'zod'

import { AuthAlert, AuthShell } from '#/components/layout/AuthShell.tsx'
import { Button } from '#/components/ui/button.tsx'
import { CardContent } from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { PasswordInput } from '#/components/ui/password-input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { currentUserQuery } from '#/lib/queries.ts'
import { loginFn } from '#/server/fns/auth.ts'
import {
  ACCOUNT_LOCKED_MESSAGE,
  isAccountLockedError,
} from '#/lib/auth-errors.ts'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    locked: z.string().optional().catch(undefined),
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    try {
      const user = await queryClient.query(currentUserQuery())
      // Use the router's redirect() (a raw Response cannot be serialized during SSR)
      if (user) throw redirect({ to: '/' })
    } catch (err) {
      if (isAccountLockedError(err)) {
        return
      }
      throw err
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const { locked } = Route.useSearch()
  const [login, setLogin] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(() =>
    locked ? ACCOUNT_LOCKED_MESSAGE : null,
  )
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await loginFn({ data: { login, password } })
      window.location.href = '/'
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Đăng nhập không thành công'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Đăng nhập" showBackLink={false}>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pb-6">
          {error && <AuthAlert tone="error">{error}</AuthAlert>}

          <div className="space-y-1.5">
            <Label htmlFor="login" className="text-xs font-semibold">
              Tên đăng nhập hoặc email *
            </Label>
            <div className="relative" data-field-wrap>
              <User className="absolute z-10 left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                id="login"
                type="text"
                required
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="admin hoặc email..."
                className="pl-9 h-11 rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold">
                Mật khẩu *
              </Label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative" data-field-wrap>
              <Lock className="absolute z-10 left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <PasswordInput
                id="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="pl-9 h-11 rounded-lg"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 font-semibold"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogIn className="size-4" />
            )}
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </CardContent>
      </form>
    </AuthShell>
  )
}
