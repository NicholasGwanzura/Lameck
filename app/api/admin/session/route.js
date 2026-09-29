import { NextResponse } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
  isAdminAuthConfigured,
  verifyAdminCredentials,
} from '../../../../lib/admin-auth'

export async function POST(request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: 'Admin sign-in is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD (at least 12 characters), and ADMIN_SESSION_SECRET (at least 32 characters).' }, { status: 503 })
  }

  let credentials
  try {
    credentials = await request.json()
  } catch {
    return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 })
  }

  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 })
  }

  const email = typeof credentials.email === 'string' && credentials.email.length <= 254 ? credentials.email : ''
  const password = typeof credentials.password === 'string' && credentials.password.length <= 1024 ? credentials.password : ''
  if (!verifyAdminCredentials(email, password)) {
    return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
