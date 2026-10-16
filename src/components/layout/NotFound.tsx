import { Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Home } from 'lucide-react'

import { BrandMark } from '#/components/layout/BrandMark.tsx'
import { Button } from '#/components/ui/button.tsx'

/** Shown for any address that matches no page (router `defaultNotFoundComponent`) */
export function NotFound() {
  const router = useRouter()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <BrandMark className="size-12" />
      <div className="mt-8 bg-gradient-to-br from-emerald-700 to-emerald-950 bg-clip-text text-8xl font-black tracking-tight text-transparent sm:text-9xl">
        404
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        Không tìm thấy trang
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Địa chỉ bạn mở không tồn tại hoặc đã bị xóa. Hãy kiểm tra lại đường dẫn
        hoặc quay về trang chủ.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.history.back()}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Quay lại
        </Button>
        <Button asChild className="gap-2">
          <Link to="/">
            <Home className="size-4" />
            Về trang chủ
          </Link>
        </Button>
      </div>
    </div>
  )
}
