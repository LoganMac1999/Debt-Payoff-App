import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div style={{ paddingTop: '18vh' }}>
      <p className="eyebrow">MacPhail Freedom Calculator</p>
      <h1 className="hero-date" style={{ fontSize: 'clamp(32px, 8vw, 44px)' }}>
        Get out of debt on purpose.
      </h1>
      <p style={{ color: 'var(--slate)', marginTop: 12, marginBottom: 28 }}>
        Sign in with your email — no password, just a one-time link. You and your
        partner can share the same household.
      </p>

      {sent ? (
        <div className="card">
          <p>Check <strong>{email}</strong> for a sign-in link.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {error && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
      )}
    </div>
  )
}
