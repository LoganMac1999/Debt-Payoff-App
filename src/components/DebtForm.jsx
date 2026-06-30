import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function DebtForm({ householdId, existing, onDone, onCancel }) {
  const [name, setName] = useState(existing?.name ?? '')
  const [balance, setBalance] = useState(existing?.balance ?? '')
  const [apr, setApr] = useState(existing?.apr ?? '')
  const [minPayment, setMinPayment] = useState(existing?.min_payment ?? '')
  const [dueDay, setDueDay] = useState(existing?.due_day ?? 1)
  const [hasPromo, setHasPromo] = useState(Boolean(existing?.promo_months))
  const [promoMonths, setPromoMonths] = useState(existing?.promo_months || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      household_id: householdId,
      name: name.trim(),
      balance: parseFloat(balance) || 0,
      apr: parseFloat(apr) || 0,
      min_payment: parseFloat(minPayment) || 0,
      promo_months: hasPromo ? (parseInt(promoMonths, 10) || 0) : 0,
      due_day: Math.min(Math.max(parseInt(dueDay, 10) || 1, 1), 28),
    }
    const { error } = existing
      ? await supabase.from('debts').update(payload).eq('id', existing.id)
      : await supabase.from('debts').insert(payload)
    setSaving(false)
    if (error) setError(error.message)
    else onDone()
  }

  async function handleDelete() {
    if (!confirm(`Delete ${existing.name}? This removes its payment history too.`)) return
    await supabase.from('debts').delete().eq('id', existing.id)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="field">
        <label htmlFor="name">Debt name</label>
        <input id="name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Capital One card" style={{ fontFamily: 'var(--font-body)' }} />
      </div>
      <div className="field">
        <label htmlFor="balance">Current balance ($)</label>
        <input id="balance" required type="number" min="0" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="apr">{hasPromo ? 'APR after promo ends (%)' : 'APR (%)'}</label>
        <input id="apr" required type="number" min="0" step="0.01" value={apr} onChange={e => setApr(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="min">Minimum monthly payment ($)</label>
        <input id="min" required type="number" min="0" step="0.01" value={minPayment} onChange={e => setMinPayment(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="dueDay">Day of month it's due</label>
        <input id="dueDay" required type="number" min="1" max="28" value={dueDay} onChange={e => setDueDay(e.target.value)} />
        <p style={{ color: 'var(--slate)', fontSize: 12, marginTop: 4 }}>
          Use 1–28 so it lands cleanly in every month, even February.
        </p>
      </div>
      <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          id="hasPromo"
          type="checkbox"
          checked={hasPromo}
          onChange={e => setHasPromo(e.target.checked)}
          style={{ width: 'auto' }}
        />
        <label htmlFor="hasPromo" style={{ marginBottom: 0 }}>This has a 0% interest promo period</label>
      </div>
      {hasPromo && (
        <div className="field">
          <label htmlFor="promoMonths">Months remaining at 0%</label>
          <input
            id="promoMonths"
            type="number"
            min="1"
            step="1"
            required={hasPromo}
            value={promoMonths}
            onChange={e => setPromoMonths(e.target.value)}
            placeholder="e.g. 12"
          />
          <p style={{ color: 'var(--slate)', fontSize: 12, marginTop: 4 }}>
            No interest accrues during this window. After it ends, the APR above kicks in automatically.
          </p>
        </div>
      )}
      {error && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : existing ? 'Save changes' : 'Add debt'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
        {existing && <button className="btn danger" type="button" onClick={handleDelete} style={{ marginLeft: 'auto' }}>Delete</button>}
      </div>
    </form>
  )
}
