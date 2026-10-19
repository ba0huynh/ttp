import { Link } from '@tanstack/react-router'
import { FileCheck2, Landmark, Warehouse } from 'lucide-react'
import * as React from 'react'

import { BrandMark } from '#/components/layout/BrandMark.tsx'
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'

const HIGHLIGHTS = [
  {
    icon: Warehouse,
    title: 'Hai kho độc lập',
    text: 'Tồn thực tế và tồn hóa đơn theo dõi riêng trên từng số khung.',
  },
  {
    icon: FileCheck2,
    title: 'Giá vốn chính xác',
    text: 'Chi phí lô phân bổ theo tỉ trọng đơn giá vào giá vốn từng xe.',
  },
  {
    icon: Landmark,
    title: 'Khế ước & công nợ',
    text: 'Lãi vay dư nợ giảm dần, đối chiếu sao kê với phiếu thu chi.',
  },
]

/** Branded split frame for every public auth page (login / forgot / reset) */
export function AuthShell({
  title,
  description,
  children,
  showBackLink = true,
}: {
  title: string
  description?: string
  children: React.ReactNode
  showBackLink?: boolean
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] bg-background">
      {/* Brand panel (desktop) */}
      <aside className="hidden lg:flex relative overflow-hidden bg-ink-900 text-white/90 flex-col justify-between p-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgb(255_255_255/0.35)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(160deg,black,transparent_70%)]"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -right-32 size-[520px] rounded-full bg-white/15 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <BrandMark className="size-11" />
          <div className="leading-tight">
            <div className="text-white font-bold tracking-wide">
              TRƯỜNG THỊNH PHÁT
            </div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/80">
              Xe máy nhập khẩu · Bán sỉ
            </div>
          </div>
        </div>

        <div className="relative space-y-8 max-w-md">
          <h2 className="text-3xl font-bold leading-tight text-white text-balance">
            Một nơi duy nhất cho lô xe, kho, công nợ và khoản vay.
          </h2>
          <ul className="space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-3.5">
                <span className="size-9 shrink-0 rounded-lg bg-white/[0.15] ring-1 ring-white/25 flex items-center justify-center">
                  <Icon className="size-4 text-emerald-400" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-white">
                    {t}
                  </div>
                  <div className="text-sm text-white/80">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/70">
          Công ty TNHH Kinh doanh Dịch vụ Trường Thịnh Phát · MST 0316513248
        </p>
      </aside>

      {/* Form column */}
      <main className="flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex lg:hidden items-center gap-3">
            <BrandMark className="size-10" />
            <div className="leading-tight">
              <div className="font-bold tracking-wide text-slate-900">
                TRƯỜNG THỊNH PHÁT
              </div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-700">
                Xe máy nhập khẩu · Bán sỉ
              </div>
            </div>
          </div>

          <Card className="shadow-[0_1px_2px_oklch(0.22_0.015_255/0.04),0_12px_32px_-12px_oklch(0.22_0.015_255/0.18)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-slate-900">
                {title}
              </CardTitle>
              {description && (
                <CardDescription className="text-sm text-slate-500">
                  {description}
                </CardDescription>
              )}
            </CardHeader>
            {children}
          </Card>

          {showBackLink && (
            <p className="text-center text-sm">
              <Link
                to="/login"
                className="font-medium text-emerald-700 hover:underline"
              >
                ← Quay lại đăng nhập
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

export function AuthAlert({
  tone,
  children,
}: {
  tone: 'error' | 'success'
  children: React.ReactNode
}) {
  return (
    <Alert
      variant={tone === 'error' ? 'destructive' : 'default'}
      className={
        tone === 'error'
          ? 'bg-rose-50 text-rose-900 border-rose-200 text-xs py-2'
          : 'bg-emerald-50 text-emerald-900 border-emerald-200 text-xs py-2'
      }
    >
      <AlertDescription className="text-inherit">{children}</AlertDescription>
    </Alert>
  )
}
