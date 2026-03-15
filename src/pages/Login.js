import React, { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.logo}>AF</div>
          <h1 style={s.title}>Arnett Family App</h1>
          <p style={s.subtitle}>Household inventory &amp; recipes</p>
        </div>

        <form onSubmit={handleLogin} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input
              style={s.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button style={s.button} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p style={s.footer}>
          Access is by invitation only. Contact Gavin to request an account.
        </p>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#F8FAFC', padding: '24px'
  },
  card: {
    background: '#FFFFFF', borderRadius: '16px',
    border: '0.5px solid #CBD5E1', padding: '40px',
    width: '100%', maxWidth: '400px'
  },
  header: { textAlign: 'center', marginBottom: '32px' },
  logo: {
    width: '56px', height: '56px', borderRadius: '14px',
    background: '#1A252F', color: '#FFFFFF', fontSize: '20px',
    fontWeight: '700', display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '0 auto 16px', letterSpacing: '0.05em'
  },
  title: { fontSize: '22px', fontWeight: '600', color: '#1A252F', marginBottom: '6px' },
  subtitle: { fontSize: '14px', color: '#64748B' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '500', color: '#374151' },
  input: {
    padding: '10px 14px', borderRadius: '8px', fontSize: '15px',
    border: '1px solid #CBD5E1', outline: 'none', color: '#1A252F',
    transition: 'border-color 0.15s',
  },
  error: {
    background: '#FEE2E2', color: '#7F1D1D', padding: '10px 14px',
    borderRadius: '8px', fontSize: '13px', border: '1px solid #FCA5A5'
  },
  button: {
    padding: '12px', borderRadius: '8px', fontSize: '15px', fontWeight: '600',
    background: '#1A252F', color: '#FFFFFF', border: 'none',
    transition: 'opacity 0.15s', opacity: 1
  },
  footer: {
    marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#94A3B8'
  }
}
