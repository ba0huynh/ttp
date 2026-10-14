import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'

import { db } from '../../db/index.ts'
import { passwordResetTokens, sessions, users } from '../../db/schema.ts'

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>

export const SESSION_COOKIE = 'ttp_session'
export const SESSION_TTL_DAYS = 7

/** Format: scrypt$<salt>$<hash hex> */
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scryptAsync(password, salt, 64)
  return `scrypt$${salt}$${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, salt, hex] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !hex) return false
  const expected = Buffer.from(hex, 'hex')
  const actual = await scryptAsync(password, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export async function createSession(userId: number) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000)
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt })
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId))
  return { token, expiresAt }
}

export type SessionUser = {
  id: number
  username: string
  email: string
  fullName: string
  role: (typeof users.$inferSelect)['role']
}

export async function getUserBySessionToken(
  token: string,
): Promise<SessionUser | null> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, sql`NOW()`)),
    )
    .limit(1)
  if (!row || !row.isActive) return null
  const { isActive: _ignored, ...user } = row
  return user
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, sha256(token)))
}

export async function authenticate(login: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`${users.username} = ${login} OR ${users.email} = ${login}`)
    .limit(1)
  if (!user || !user.isActive) return null
  if (!(await verifyPassword(password, user.passwordHash))) return null
  return user
}

/** Creates a password reset token (expires in 30 minutes). Returns raw token. */
export async function createPasswordResetToken(email: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  if (!user) return null
  const token = randomBytes(24).toString('base64url')
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 30 * 60_000),
  })
  return token
}

export async function resetPasswordWithToken(token: string, password: string) {
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, sha256(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, sql`NOW()`),
      ),
    )
    .limit(1)
  if (!row) return false
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.id, row.userId))
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, row.id))
    await tx.delete(sessions).where(eq(sessions.userId, row.userId))
  })
  return true
}
