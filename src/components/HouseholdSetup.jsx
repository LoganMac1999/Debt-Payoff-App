import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function HouseholdSetup({ user, onReady }) {
  const [mode, setMode] = useState('create')
  const [householdId, setHouseholdId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function createHousehold() {
    setLoading(true)
    setError('')
    const newId = crypto.randomUUID()
    const { error: hErr } = await supabase
      .from('households')
      .insert({ id: newId, name: 'Our Household' })
    if (hErr) { setError(hErr.message); setLoading(false); return }

    const { error: mErr } = await supabase
      .from('household_members')
      .insert({ household_id: newId, user_id: user.id })
    if (mErr) { setError(mErr.message); setLoading(false); return }

    await supabase.from('household_settings').insert({ household_id: newId })
    setLoading(false)
    onReady(newId)
  }

  async function joinHousehold() {
    setLoading(true)
    setError('')
    const { error } = await supabase
      .from('household_members')
      .insert({ household_id: householdId.trim(), user_id: user.id })
    setLoading(false)
    if (error) setError('Could not join — check the household code.')
    else onReady(householdId.trim())
  }

  return (
    <div style={{ paddingTop: '14vh' }}>
      <p className="eyebrow">One more step</p>
      <h1 className="hero-date" style={{ fontSize: 'clamp(28px, 7vw, 36px)' }}>
        Set up your household
      </h1>
      <p style={{ color: 'var(--slate)', margin: '12px 0 24px' }}>
        Create a new household, or join one your partner already started.
      </p>

      <div className="strategy-tabs">
        <button className={`strategy-tab ${mode === 'create' ? 'active' : ''}`} onClick={() => setMode('create')}>Create new</button>
        <button className={`strategy-tab ${mode === 'join' ? 'active' : ''}`} onClick={() => setMode('join')}>Join existing</button>
      </div>

      {mode === 'create' ? (
        <div className="card">
          <p style={{ marginTop: 0 }}>This creates a new shared household. You'll get a code to share with your partner.</p>
          <button className="btn" onClick={createHousehold} disabled={loading}>
            {loading ? 'Creating…' : 'Create household'}
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="field">
            <label htmlFor="code">Household code (ask your partner for it)</label>
            <input id="code" value={householdId} onChange={e => setHouseholdId(e.target.value)} placeholder="paste code here" />
          </div>
          <button className="btn" onClick={joinHousehold} disabled={loading || !householdId.trim()}>
            {loading ? 'Joining…' : 'Join household'}
          </button>
        </div>
      )}
      {error && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{error}</p>}
    </div>
  )
}
