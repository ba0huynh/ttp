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

/**
 * Drizzle wraps driver errors as "Failed query: ..." and keeps the mysql2 error
 * in `cause`, so look through the whole cause chain.
 */
function mysqlCodes(e: unknown): { code?: string; errno?: number }[] {
  const out: { code?: string; errno?: number }[] = []
  let cur: unknown = e
  for (let i = 0; i < 5 && cur && typeof cur === 'object'; i++) {
    const err = cur as { code?: string; errno?: number; cause?: unknown }
    out.push({ code: err.code, errno: err.errno })
    cur = err.cause
  }
  return out
}

/** A value longer than its column allows (MySQL 1406) */
export function isTooLongError(e: unknown) {
  return mysqlCodes(e).some(
    (c) => c.errno === 1406 || c.code === 'ER_DATA_TOO_LONG',
  )
}

/** Deleting / changing a row that other rows still point to (MySQL 1451) */
export function isReferencedError(e: unknown) {
  return mysqlCodes(e).some(
    (c) =>
      c.errno === 1451 ||
      c.code === 'ER_ROW_IS_REFERENCED' ||
      c.code === 'ER_ROW_IS_REFERENCED_2',
  )
}

export const num = (v: unknown) => Number(v ?? 0)
