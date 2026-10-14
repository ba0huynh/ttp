import { config } from 'dotenv'
import fs from 'node:fs'
import mysql from 'mysql2/promise'

config({ path: ['.env.local', '.env'] })

async function run() {
  console.log(
    'Connecting to MySQL at',
    process.env.DB_HOST,
    'port',
    process.env.DB_PORT,
  )
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '152.53.205.236',
    port: Number(process.env.DB_PORT) || 10146,
    user: process.env.DB_USER || 'mysql',
    password: process.env.DB_PASSWORD || 'dkqtlylo9lmgzyta',
    database: process.env.DB_NAME || 'mysql',
    multipleStatements: true,
  })

  console.log('Connected successfully! Applying migration statements...')
  const sql = fs.readFileSync(
    './drizzle/0000_ambitious_eddie_brock.sql',
    'utf-8',
  )
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    if (!stmt) continue
    try {
      await connection.query(stmt)
      console.log(`[${i + 1}/${statements.length}] Applied statement`)
    } catch (err: unknown) {
      const msg = (err as Error).message
      if (msg.includes('already exists')) {
        console.log(
          `[${i + 1}/${statements.length}] Table already exists, skipping`,
        )
      } else {
        console.error(`[${i + 1}/${statements.length}] Error:`, msg)
      }
    }
  }

  console.log('Schema migration complete!')
  await connection.end()
}

run().catch(console.error)
