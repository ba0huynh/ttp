import { QueryClient } from '@tanstack/react-query'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Dữ liệu nội bộ thay đổi chậm: tránh gọi lại server mỗi lần chuyển trang
      queries: { staleTime: 30_000 },
    },
  })

  return {
    queryClient,
  }
}
export default function TanstackQueryProvider() {}
