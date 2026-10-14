import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Lock, LogIn, User } from 'lucide-react'
import * as React from 'react'

import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { currentUserQuery } from '#/lib/queries.ts'
import { loginFn } from '#/server/fns/auth.ts'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    // redirect() của router (không phải Response thô, vốn không serialize được khi SSR)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex size-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 items-center justify-center text-white shadow-lg shadow-emerald-900/40 font-black text-2xl">
            T
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            TRƯỜNG THỊNH PHÁT
          </h1>
          <p className="text-xs text-emerald-300 font-medium tracking-wide uppercase">
            Hệ thống Quản lý Bán sỉ Xe máy Nhập khẩu
          </p>
        </div>

        {/* Card form */}
        <Card className="border-slate-800 bg-white/95 backdrop-blur-sm shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-slate-900">
              Đăng nhập hệ thống
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Nhập thông tin tài khoản nội bộ để tiếp tục
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert
                  variant="destructive"
                  className="bg-rose-50 text-rose-900 border-rose-200 text-xs py-2"
                >
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="login" className="text-xs font-semibold">
                  Tên đăng nhập / Email
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 size-4 text-slate-400" />
                  <Input
                    id="login"
                    type="text"
                    required
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="admin hoặc email..."
                    className="pl-9 text-sm h-9"
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
                    className="text-[11px] text-emerald-700 hover:underline"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 size-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 text-sm h-9"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold h-10 shadow-sm"
              >
                {loading ? (
                  'Đang xử lý...'
                ) : (
                  <>
                    <LogIn className="size-4 mr-2" />
                    Đăng nhập
                  </>
                )}
              </Button>

              <p className="text-xs text-slate-500">
                Chưa có tài khoản?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  Đăng ký
                </Link>
              </p>

              {/* Demo accounts picker */}
              <div className="w-full pt-3 border-t border-slate-100 space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 text-center uppercase tracking-wider">
                  Tài khoản dùng thử (Click chọn nhanh):
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] justify-start px-2 font-medium"
                    onClick={() => fillQuick('admin', 'Admin@123')}
                  >
                    👑 Admin (Quản trị)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] justify-start px-2 font-medium"
                    onClick={() => fillQuick('ketoan', 'Ktp@12345')}
                  >
                    💼 Kế toán
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] justify-start px-2 font-medium"
                    onClick={() => fillQuick('kinhdoanh', 'Sale@12345')}
                  >
                    🏷️ Kinh doanh
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] justify-start px-2 font-medium"
                    onClick={() => fillQuick('kho', 'Kho@12345')}
                  >
                    📦 Thủ kho
                  </Button>
                </div>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400">
          Công ty TNHH Kinh doanh Dịch vụ Trường Thịnh Phát &bull; MST
          0316513248
        </p>
      </div>
    </div>
  )
}
