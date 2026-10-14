import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'

import { db } from './index.ts'

/**
 * Runs migrations and prints per-statement progress (replaces
 * `drizzle-kit migrate`, which hides progress and swallows errors). The
 * tracking table format matches drizzle's (hash = sha256 of the .sql file,
 * created_at = `when` from _journal.json), so it stays compatible with
 * drizzle-kit / the drizzle-orm migrator.
 * Settings must match drizzle.config.ts.
 */
const MIGRATIONS_FOLDER = './src/db/migrations'
const MIGRATIONS_TABLE = 'migrations'
const STATEMENT_BREAKPOINT = '--> statement-breakpoint'

interface JournalEntry {
  tag: string
  when: number
}

interface Migration {
  tag: string
  when: number
  hash: string
  statements: string[]
}

const count = (rows: unknown) => Number((rows as { n: number }[])[0]?.n)
const run = (query: string) => db.execute(sql.raw(query))

function loadMigrations(): Migration[] {
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf-8'),
  ) as { entries: JournalEntry[] }

  return journal.entries.map(({ tag, when }) => {
    const script = readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf-8')
    return {
      tag,
      when,
      hash: createHash('sha256').update(script).digest('hex'),
      statements: script
        .split(STATEMENT_BREAKPOINT)
        .map((s) => s.trim())
        .filter(Boolean),
    }
  })
}

/** First line of a statement: enough to tell which table/constraint it touches */
function describe(statement: string) {
  return (statement.split('\n')[0] ?? '').slice(0, 90)
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
    `INSERT INTO \`${MIGRATIONS_TABLE}\` (hash, created_at) VALUES ('${first.hash}', ${first.when})`,
  )
  console.log(
    `↺ Database already has all tables: recording ${first.tag} as applied (baseline).`,
  )
}

async function migrate() {
  const migrations = loadMigrations()
  console.log(`Found ${migrations.length} migration(s) in ${MIGRATIONS_FOLDER}`)

  await run(
    `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
  )

  const [appliedRows] = await run(
    `SELECT COUNT(*) AS n FROM \`${MIGRATIONS_TABLE}\``,
  )
  if (count(appliedRows) === 0 && migrations[0]) {
    await baselineIfNeeded(migrations[0])
  }

  const [lastRows] = await run(
    `SELECT COALESCE(MAX(created_at), 0) AS n FROM \`${MIGRATIONS_TABLE}\``,
  )
  const lastApplied = count(lastRows)
  const pending = migrations.filter((m) => m.when > lastApplied)

  if (pending.length === 0) {
    console.log('✓ Database is up to date, nothing to apply.')
    return
  }

  for (const migration of pending) {
    const total = migration.statements.length
    console.log(`\n▶ ${migration.tag} (${total} statements)`)
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
      `INSERT INTO \`${MIGRATIONS_TABLE}\` (hash, created_at) VALUES ('${migration.hash}', ${migration.when})`,
    )
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1)
    console.log(`✔ ${migration.tag} done in ${seconds}s`)
  }

  console.log(`\nMigration complete (${pending.length} applied).`)
}

migrate()
  .catch((err) => {
    console.error('\n❌ Migration failed:', err)
    process.exitCode = 1
  })
  .finally(() => db.$client.end())
