import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'

import { db } from './index.ts'

/**
 * Runs migrations and prints per-statement progress (replaces
 * `drizzle-kit migrate`, which hides progress and swallows errors).
 *
 * Applied migrations are tracked by file name in the `migrations` table, so it
 * is NOT compatible with drizzle-kit's / drizzle-orm's own migrator (they expect
 * hash + created_at columns). Keep using `npm run migration:run`.
 * Migration files and the journal come from drizzle.config.ts (`out`).
 */
const MIGRATIONS_FOLDER = './src/db/migrations'
const MIGRATIONS_TABLE = 'migrations'
const STATEMENT_BREAKPOINT = '--> statement-breakpoint'

interface Migration {
  /** File name without extension, e.g. 0000_wet_sentinel */
  name: string
  statements: string[]
}

const count = (rows: unknown) => Number((rows as { n: number }[])[0]?.n)
const run = (query: string) => db.execute(sql.raw(query))

function loadMigrations(): Migration[] {
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf-8'),
  ) as { entries: { tag: string }[] }

  return journal.entries.map(({ tag }) => {
    const script = readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf-8')
    return {
      name: tag,
      statements: script
        .split(STATEMENT_BREAKPOINT)
        .map((s) => s.trim())
        .filter(Boolean),
    }
  })
}

/**
 * Creates the tracking table. A table left over from the old hash/created_at
 * format is replaced if empty; if it already holds rows we stop, so history is
 * never dropped silently.
 */
async function ensureTrackingTable() {
  const [tableRows] = await run(
    `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '${MIGRATIONS_TABLE}'`,
  )
  const [nameColRows] = await run(
    `SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '${MIGRATIONS_TABLE}' AND column_name = 'name'`,
  )

  if (count(tableRows) > 0 && count(nameColRows) === 0) {
    const [rows] = await run(
      `SELECT COUNT(*) AS n FROM \`${MIGRATIONS_TABLE}\``,
    )
    if (count(rows) > 0) {
      throw new Error(
        `Table ${MIGRATIONS_TABLE} uses the old hash/created_at format and has rows. Convert it manually or drop it, then run again.`,
      )
    }
    await run(`DROP TABLE \`${MIGRATIONS_TABLE}\``)
  }

  await run(
    `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  )
}

/** Full statement collapsed to one line, so nothing is truncated in the log */
function describe(statement: string) {
  return statement.replace(/\s+/g, ' ').trim()
}

/**
 * A database created before the tracking table existed (via db:push or the old
 * script) already has the first migration's tables, so re-running it would fail
 * with "already exists". If the tracking table is empty but the business
 * tables exist, record the first migration as applied. Only do so when the
 * database has ALL the tables and foreign keys: if an earlier run stopped
 * halfway (MySQL cannot roll back DDL), marking it "applied" would hide the
 * missing parts.
 */
async function baselineIfNeeded(first: Migration) {
  const [tableRows] = await run(
    `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name <> '${MIGRATIONS_TABLE}'`,
  )
  const existingTables = count(tableRows)
  if (existingTables === 0) return // empty database: run migrations normally

  const script = first.statements.join('\n')
  const expectedTables = (script.match(/CREATE TABLE/g) ?? []).length
  const expectedFks = (script.match(/FOREIGN KEY/g) ?? []).length
  const [fkRows] = await run(
    `SELECT COUNT(*) AS n FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND constraint_type = 'FOREIGN KEY'`,
  )
  const existingFks = count(fkRows)
  if (existingTables < expectedTables || existingFks < expectedFks) {
    throw new Error(
      `The database has ${existingTables}/${expectedTables} tables and ${existingFks}/${expectedFks} foreign keys but no migration history (a previous run may have failed halfway). Drop all tables (or recreate the database) and run npm run migration:run again.`,
    )
  }

  await run(
    `INSERT INTO \`${MIGRATIONS_TABLE}\` (name) VALUES ('${first.name}')`,
  )
  console.log(
    `↺ Database already has all tables: recording ${first.name} as applied (baseline).`,
  )
}

async function migrate() {
  const migrations = loadMigrations()
  console.log(`Found ${migrations.length} migration(s) in ${MIGRATIONS_FOLDER}`)

  await ensureTrackingTable()

  const [appliedRows] = await run(
    `SELECT COUNT(*) AS n FROM \`${MIGRATIONS_TABLE}\``,
  )
  if (count(appliedRows) === 0 && migrations[0]) {
    await baselineIfNeeded(migrations[0])
  }

  const [nameRows] = await run(`SELECT name FROM \`${MIGRATIONS_TABLE}\``)
  const applied = new Set(
    (nameRows as unknown as { name: string }[]).map((r) => r.name),
  )
  const pending = migrations.filter((m) => !applied.has(m.name))

  if (pending.length === 0) {
    console.log('✓ Database is up to date, nothing to apply.')
    return
  }

  for (const migration of pending) {
    const total = migration.statements.length
    console.log(`\n▶ ${migration.name} (${total} statements)`)
    const startedAt = performance.now()

    for (const [i, statement] of migration.statements.entries()) {
      const label = `[${i + 1}/${total}] ${describe(statement)}`
      try {
        await run(statement)
        console.log(`  ✓ ${label}`)
      } catch (err) {
        console.error(`  ✗ ${label}`)
        throw err
      }
    }

    await run(
      `INSERT INTO \`${MIGRATIONS_TABLE}\` (name) VALUES ('${migration.name}')`,
    )
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1)
    console.log(`✔ ${migration.name} done in ${seconds}s`)
  }

  console.log(`\nMigration complete (${pending.length} applied).`)
}

migrate()
  .catch((err) => {
    console.error('\n❌ Migration failed:', err)
    process.exitCode = 1
  })
  .finally(() => db.$client.end())
