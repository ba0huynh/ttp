import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/mysql2'

import * as schema from './schema.ts'

config({ path: ['.env.local', '.env'] })

function createDb() {
  return drizzle({
    connection: {
      host: process.env.DB_HOST || '152.53.205.236',
      port: Number(process.env.DB_PORT) || 10146,
      user: process.env.DB_USER || 'mysql',
      password: process.env.DB_PASSWORD || 'dkqtlylo9lmgzyta',
      database: process.env.DB_NAME || 'mysql',
      // Keep the pool small and let idle connections go: the MySQL server only
      // allows ~150 connections in total, shared by every dev server and script
      connectionLimit: 5,
      maxIdle: 2,
      idleTimeout: 60_000,
    },
    schema,
    mode: 'default',
  })
}

type Db = ReturnType<typeof createDb>

/**
 * Vite re-evaluates server modules on every hot reload, which used to create a
 * new connection pool each time and leave the old one open until the MySQL
 * server timed out (8 h), eventually causing "Too many connections".
 * Keeping the instance on `globalThis` makes every reload reuse the same pool.
 */
const globalForDb = globalThis as typeof globalThis & { __ttpDb?: Db }

export const db: Db = (globalForDb.__ttpDb ??= createDb())
