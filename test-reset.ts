import { db } from './src/db/index.ts'
import { sql } from 'drizzle-orm'
import { createPasswordResetToken, resetPasswordWithToken } from './src/server/services/auth.ts'

async function fullTest() {
  await db.execute(sql`SET time_zone = '+07:00'`)

  const token = await createPasswordResetToken('admin@truongthinhphat.vn')
  console.log('Created token:', token)

  const ok = await resetPasswordWithToken(token!, 'Admin123456@')
  console.log('Reset succeeded?', ok)

  process.exit(0)
}
fullTest()
