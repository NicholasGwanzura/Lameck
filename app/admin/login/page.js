'use client'

import { useState } from 'react'

export default function AdminLogin() {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result.error || 'Unable to sign in.')
        return
      }
      window.location.assign('/admin')
    } catch {
      setError('Unable to reach the sign-in service. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="admin-login-page">
    <div className="admin-login-card">
      <p className="kicker">South Grant / Admin</p>
      <h1>Sign in</h1>
      <p>Sign in to manage the South Grant store.</p>
      <form className="contact-form" onSubmit={submit}>
        <label htmlFor="admin-email">Email</label><input id="admin-email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="admin-password">Password</label><input id="admin-password" name="password" type="password" autoComplete="current-password" required />
        <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        {error && <p className="form-status error" role="alert">{error}</p>}
      </form>
    </div>
  </main>
}
