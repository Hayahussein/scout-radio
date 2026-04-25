import React, { useState } from 'react'
import { setToken } from '../auth.js'


export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')

      setToken(data.token)
      onLogin({ role: data.role, profileComplete: data.role === 'admin' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.logo}>📻</div>
      <div style={s.card}>
        <h2 style={s.title}></h2>
        <p style={s.sub}>Connectez-vous pour continuer</p>

        <input style={s.input} placeholder="Nom d'utilisateur" value={username}
          onChange={e => { setUsername(e.target.value); setError('') }} autoFocus />
        <input style={s.input} type="password" placeholder="Mot de passe" value={password}
          onChange={e => { setPassword(e.target.value); setError('') }} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />

        {error && <p style={s.error}>{error}</p>}

        <button style={{ ...s.btn, opacity: loading ? .6 : 1 }} disabled={loading} onClick={handleSubmit}>
          {loading ? 'En cours de connexion...' : 'Connexion →'}
        </button>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', padding: '1rem', background: 'transparent' },
  logo: { width: 90, height: 90, background: 'rgba(56,189,248,.12)', border: '1.5px solid rgba(56,189,248,.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 },
  card: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: '1rem' },
  title: { fontSize: 20, fontWeight: 600, textAlign: 'center', color: '#f0f0f0' },
  sub: { fontSize: 13, color: '#888', textAlign: 'center' },
  input: { width: '100%', padding: '11px 14px', border: '1px solid #2e2e2e', borderRadius: 10, background: '#111', color: '#f0f0f0', fontSize: 15, outline: 'none' },
  error: { fontSize: 13, color: '#f87171', textAlign: 'center' },
  btn: { width: '100%', padding: 12, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
}
