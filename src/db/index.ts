import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/mysql2'

import * as schema from './schema.ts'

config({ path: ['.env.local', '.env'] })

export const db = drizzle({
  connection: {
    host: process.env.DB_HOST || '152.53.205.236',
    port: Number(process.env.DB_PORT) || 10146,
    user: process.env.DB_USER || 'mysql',
    password: process.env.DB_PASSWORD || 'dkqtlylo9lmgzyta',
    database: process.env.DB_NAME || 'mysql',
  },
  schema,
  mode: 'default',
})
