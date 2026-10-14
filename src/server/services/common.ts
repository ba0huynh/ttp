import { like, sql } from 'drizzle-orm'
import type { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core'

import type { db } from '../../db/index.ts'

export type Db = typeof db
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type Exec = Db | Tx

/** Lỗi nghiệp vụ — message hiển thị thẳng cho người dùng (tiếng Việt) */
export class BusinessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BusinessError'
  }
}

/**
 * Sinh số chứng từ tuần tự theo ngày: PREFIX-YYMMDD-001
 * (đủ dùng cho hệ thống nội bộ; UNIQUE ở DB chặn trùng nếu có race)
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

/** mysql2 ném ER_DUP_ENTRY khi vi phạm UNIQUE */
export function isDuplicateError(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } }
  return err.code === 'ER_DUP_ENTRY' || err.cause?.code === 'ER_DUP_ENTRY'
}

export const num = (v: unknown) => Number(v ?? 0)
