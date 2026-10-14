import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import {
  BadgeDollarSign,
  Calculator,
  Loader2,
  Lock,
  LogIn,
  ShieldCheck,
  User,
  Warehouse,
} from 'lucide-react'
import * as React from 'react'

import { AuthAlert, AuthShell } from '#/components/layout/AuthShell.tsx'
import { Button } from '#/components/ui/button.tsx'
import { CardContent, CardFooter } from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { currentUserQuery } from '#/lib/queries.ts'
import { loginFn } from '#/server/fns/auth.ts'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    // Use the router's redirect() (a raw Response cannot be serialized during SSR)
    if (user) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const [login, setLogin] = React.useState('admin')
  const [password, setPassword] = React.useState('Admin@123')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await loginFn({ data: { login, password } })
      window.location.href = '/'
    } catch (err: unknown) {
      setError((err as Error).message || 'Đăng nhập không thành công')
    } finally {
      setLoading(false)
    }
  }

  const fillQuick = (u: string, p: string) => {
    setLogin(u)
    setPassword(p)
    setError(null)
  }

  return (
    <AuthShell
      title="Đăng nhập"
      description="Dùng tài khoản nội bộ được cấp để tiếp tục"
      showBackLink={false}
    >
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <AuthAlert tone="error">{error}</AuthAlert>}

          <div className="space-y-1.5">
            <Label htmlFor="login" className="text-xs font-semibold">
              Tên đăng nhập hoặc email
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                id="login"
                type="text"
                required
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="admin hoặc email..."
                className="pl-9 h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold">
                Mật khẩu
              </Label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 h-10"
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

          <p className="text-center text-sm text-slate-500">
            Chưa có tài khoản?{' '}
            <Link
              to="/register"
              className="font-semibold text-emerald-700 hover:underline"
            >
              Đăng ký
            </Link>
          </p>
        </CardContent>

        {/* Demo accounts picker */}
        <CardFooter className="flex-col items-stretch gap-2 border-t bg-slate-50/70">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Tài khoản dùng thử
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.login}
                type="button"
                onClick={() => fillQuick(a.login, a.password)}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                  login === a.login
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-border bg-card text-slate-700 hover:bg-slate-50'
                }`}
              >
                <a.icon className="size-3.5 shrink-0 text-emerald-700" />
                <span className="font-medium truncate">{a.label}</span>
              </button>
            ))}
          </div>
        </CardFooter>
      </form>
    </AuthShell>
  )
}

const DEMO_ACCOUNTS = [
  {
    login: 'admin',
    password: 'Admin@123',
    label: 'Quản trị',
    icon: ShieldCheck,
  },
  {
    login: 'ketoan',
    password: 'Ktp@12345',
    label: 'Kế toán',
    icon: Calculator,
  },
  {
    login: 'kinhdoanh',
    password: 'Sale@12345',
    label: 'Kinh doanh',
    icon: BadgeDollarSign,
  },
  { login: 'kho', password: 'Kho@12345', label: 'Thủ kho', icon: Warehouse },
]
