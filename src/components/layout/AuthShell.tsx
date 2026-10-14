import { Link } from '@tanstack/react-router'
import * as React from 'react'

import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'

/** Shared branded frame for the public auth pages (register / forgot / reset password) */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
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

        <Card className="border-slate-800 bg-white/95 backdrop-blur-sm shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-slate-900">
              {title}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {description}
            </CardDescription>
          </CardHeader>
          {children}
        </Card>

        <p className="text-center text-xs text-slate-400">
          <Link to="/login" className="text-emerald-300 hover:underline">
            ← Quay lại đăng nhập
          </Link>
        </p>
      </div>
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
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
