import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const ADMIN_SESSION_COOKIE = 'sg_admin_session'
export const ADMIN_SESSION_MAX_AGE = 8 * 60 * 60

function getAdminConfig() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const secret = process.env.ADMIN_SESSION_SECRET

  if (!email || !password || password.length < 12 || !secret || Buffer.byteLength(secret, 'utf8') < 32) return null
  return { email, password, secret }
}

function constantTimeEqual(left, right) {
  const leftHash = createHash('sha256').update(String(left)).digest()
  const rightHash = createHash('sha256').update(String(right)).digest()
  return timingSafeEqual(leftHash, rightHash)
}

export function isAdminAuthConfigured() {
  return getAdminConfig() !== null
}

export function verifyAdminCredentials(email, password) {
  const config = getAdminConfig()
  if (!config) return false

  const emailMatches = constantTimeEqual(String(email).trim().toLowerCase(), config.email)
  const passwordMatches = constantTimeEqual(password, config.password)
  return emailMatches && passwordMatches
}

export function createAdminSession() {
  const config = getAdminConfig()
  if (!config) throw new Error('Admin authentication is not configured.')

  const payload = Buffer.from(JSON.stringify({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE })).toString('base64url')
  const signature = createHmac('sha256', config.secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function isValidAdminSession(token) {
  const config = getAdminConfig()
  if (!config || typeof token !== 'string') return false

  const [payload, signature, ...extra] = token.split('.')
  if (!payload || !signature || extra.length) return false

  const expectedSignature = createHmac('sha256', config.secret).update(payload).digest('base64url')
  if (!constantTimeEqual(signature, expectedSignature)) return false

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return session.sub === 'admin' && Number.isInteger(session.exp) && session.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

export async function hasAdminSession() {
  const cookieStore = await cookies()
  return isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
}
