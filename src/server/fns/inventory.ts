import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getInventorySummary, listVehicles } from '#/server/services/reports.ts'
import { authMiddleware } from './middleware.ts'

export const getInventorySummaryFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    return getInventorySummary()
  })

export const listVehiclesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      batchId: z.number().int().optional(),
      modelId: z.number().int().optional(),
      stock: z.enum(['all', 'physical', 'invoiced', 'available']).optional(),
      q: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    return listVehicles(data)
  })

export const getAvailableVehiclesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    return listVehicles({ stock: 'available' })
  })
