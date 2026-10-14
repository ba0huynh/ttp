import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/mysql2/migrator'

import { db } from './index.ts'

/**
 * Chạy migration bằng migrator của drizzle-orm (thay cho `drizzle-kit migrate`
 * vì drizzle-kit nuốt mất lỗi). Cấu hình phải khớp với drizzle.config.ts.
 */
const MIGRATIONS_FOLDER = './src/db/migrations'
const MIGRATIONS_TABLE = 'migrations'

interface JournalEntry {
  tag: string
  when: number
}

/**
 * Database tạo trước khi có bảng theo dõi (bằng db:push hoặc script cũ) đã có
 * sẵn bảng của migration đầu tiên, nên chạy lại sẽ lỗi "already exists". Nếu
 * bảng theo dõi còn trống mà bảng nghiệp vụ đã tồn tại thì tự ghi nhận
 * migration đầu tiên là đã áp dụng.
 */
async function baselineIfNeeded() {
  await db.execute(
    sql.raw(
      `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
    ),
  )

  const [applied] = await db.execute(
    sql.raw(`SELECT COUNT(*) AS n FROM \`${MIGRATIONS_TABLE}\``),
  )
  if (Number((applied as unknown as { n: number }[])[0]?.n) > 0) return

  const [tableRows] = await db.execute(
    sql`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name <> ${MIGRATIONS_TABLE}`,
  )
  const existingTables = Number((tableRows as unknown as { n: number }[])[0]?.n)
  if (existingTables === 0) return // database trống: chạy migration bình thường

  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf-8'),
  ) as { entries: JournalEntry[] }
  const first = journal.entries[0]
  if (!first) return

  const script = readFileSync(
    join(MIGRATIONS_FOLDER, `${first.tag}.sql`),
    'utf-8',
  )

  // Chỉ baseline khi database đã có ĐỦ bảng và khóa ngoại của migration đầu
  // tiên; nếu một lần migrate trước đó chạy dở (MySQL không rollback DDL) thì
  // đánh dấu "đã áp dụng" sẽ làm mất các phần còn thiếu.
  const expectedTables = (script.match(/CREATE TABLE/g) ?? []).length
  const expectedFks = (script.match(/FOREIGN KEY/g) ?? []).length
  const [fkRows] = await db.execute(
    sql`SELECT COUNT(*) AS n FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND constraint_type = 'FOREIGN KEY'`,
  )
  const existingFks = Number((fkRows as unknown as { n: number }[])[0]?.n)
  if (existingTables < expectedTables || existingFks < expectedFks) {
    throw new Error(
      `Database có ${existingTables}/${expectedTables} bảng và ${existingFks}/${expectedFks} khóa ngoại nhưng chưa có lịch sử migration (có thể một lần chạy trước bị lỗi giữa chừng). Hãy xóa toàn bộ bảng (hoặc tạo lại database) rồi chạy lại npm run migration:run.`,
    )
  }

  const hash = createHash('sha256').update(script).digest('hex')
  await db.execute(
    sql.raw(
      `INSERT INTO \`${MIGRATIONS_TABLE}\` (hash, created_at) VALUES ('${hash}', ${first.when})`,
    ),
  )
  console.log(
    `Database đã có sẵn bảng: ghi nhận ${first.tag} là đã áp dụng (baseline).`,
  )
}

async function run() {
  console.log('Đang áp dụng migration...')
  await baselineIfNeeded()
  await migrate(db, {
    migrationsFolder: MIGRATIONS_FOLDER,
    migrationsTable: MIGRATIONS_TABLE,
  })
  console.log('Migration hoàn tất.')
}

run()
  .catch((err) => {
    console.error('❌ Migration thất bại:', err)
    process.exitCode = 1
  })
  .finally(() => db.$client.end())
