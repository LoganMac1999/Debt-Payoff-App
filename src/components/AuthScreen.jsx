import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendCode(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setStep('code')
  }

  async function verifyCode(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    })
    setLoading(false)
    if (error) setError('Invalid or expired code — try again.')
  }

  return (
    <div style={{ paddingTop: '18vh' }}>
      <p className="eyebrow">MacPhail Freedom Calculator</p>
      <h1 className="hero-date" style={{ fontSize: 'clamp(32px, 8vw, 44px)' }}>
        Get out of debt on purpose.
      </h1>
      <p style={{ color: 'var(--slate)', marginTop: 12, marginBottom: 28 }}>
        {step === 'email'
          ? 'Sign in with your email — we\'ll send you a 6-digit code.'
          : `Enter the 6-digit code sent to ${email}.`}
      </p>

      {step === 'email' ? (
        <form onSubmit={sendCode}>
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
            {loading ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <div className="field">
            <label htmlFor="code">6-digit code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="123456"
            />
          </div>
          {error && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Verifying…' : 'Sign in'}
          </button>
          <button type="button" className="btn secondary" style={{ marginTop: 10, width: '100%' }}
            onClick={() => { setStep('email'); setCode(''); setError('') }}>
            Use a different email
          </button>
        </form>
      )}
    </div>
  )
}
