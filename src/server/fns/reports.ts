import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getReports } from '#/server/services/reports.ts'
import { requirePermission } from './middleware.ts'

export const getReportsFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('reports.view')])
  .validator(
    z.object({
      from: z.string().min(10),
      to: z.string().min(10),
    }),
  )
  .handler(async ({ data }) => {
    return getReports(data.from, data.to)
  })
