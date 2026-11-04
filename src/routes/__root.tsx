import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import { getLocale } from '#/paraglide/runtime'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

import { TooltipProvider } from '#/components/ui/tooltip.tsx'
import { Toaster } from '#/components/ui/sonner.tsx'
import { ConfirmDialogHost } from '#/components/ui/confirm-dialog.tsx'
import { FieldValidationHost } from '#/components/ui/field-validation.tsx'

import {
  isAccountLockedError,
  isUnauthenticatedError,
} from '#/lib/auth-errors.ts'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  errorComponent: ({ error }) => {
    if (typeof window !== 'undefined') {
      if (isAccountLockedError(error)) {
        window.location.href = '/login?locked=1'
        return null
      }
      if (isUnauthenticatedError(error)) {
        window.location.href = '/login'
        return null
      }
    }
    return (
      <div className="p-8 text-center text-sm text-slate-700">
        <p className="font-semibold text-rose-600 mb-2">Đã xảy ra lỗi</p>
        <p className="text-slate-500 mb-4">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <a
          href="/"
          className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
        >
          Quay lại trang chủ
        </a>
      </div>
    )
  },
  beforeLoad: async () => {
    // Other redirect strategies are possible; see
    // https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide#offline-redirect
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', getLocale())
    }
  },

  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Trường Thịnh Phát — Quản Lý Xe Máy Nhập Khẩu',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        // Bump ?v= when the icon changes; browsers cache favicons aggressively
        href: '/favicon.svg?v=3',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const routerState = useRouterState()
  const isLoading = routerState.isLoading

  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {isLoading && (
          <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-emerald-100/80 overflow-hidden pointer-events-none">
            <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-top-loading-bar" />
          </div>
        )}
        <TooltipProvider>
          {children}
          <Toaster richColors position="top-right" />
          <ConfirmDialogHost />
          <FieldValidationHost />
        </TooltipProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
