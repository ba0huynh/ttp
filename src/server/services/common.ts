import { like, sql } from 'drizzle-orm'
import type { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core'

import type { db } from '../../db/index.ts'

export type Db = typeof db
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type Exec = Db | Tx

/** Domain/business error — message displayed directly to user */
export class BusinessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BusinessError'
  }
}

/**
 * Generates sequential document numbers by date: PREFIX-YYMMDD-001
 * (sufficient for internal systems; UNIQUE constraint prevents race conditions)
 */
export async function nextDocNumber(
  exec: Exec,
  table: MySqlTable,
  column: MySqlColumn,
  prefix: string,
  date: string,
) {
  const stamp = date.slice(2, 10).replaceAll('-', '')
  const head = `${prefix}-${stamp}-`
  const [row] = await exec
    .select({ n: sql<number>`count(*)` })
    .from(table)
    .where(like(column, `${head}%`))
  return `${head}${String(Number(row?.n ?? 0) + 1).padStart(3, '0')}`
}

/** mysql2 throws ER_DUP_ENTRY upon UNIQUE constraint violation */
export function isDuplicateError(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } }
  return err.code === 'ER_DUP_ENTRY' || err.cause?.code === 'ER_DUP_ENTRY'
}

export const num = (v: unknown) => Number(v ?? 0)
