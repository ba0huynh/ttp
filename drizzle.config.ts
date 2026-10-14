import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: ['.env.local', '.env'] })

export default defineConfig({
  out: './src/db/migrations',
  schema: './src/db/schema.ts',
  dialect: 'mysql',
  // Bảng theo dõi migration đã chạy (mặc định là __drizzle_migrations)
  migrations: { table: 'migrations' },
  dbCredentials: {
    host: process.env.DB_HOST || '152.53.205.236',
    port: Number(process.env.DB_PORT) || 10146,
    user: process.env.DB_USER || 'mysql',
    password: process.env.DB_PASSWORD || 'dkqtlylo9lmgzyta',
    database: process.env.DB_NAME || 'mysql',
  },
})
