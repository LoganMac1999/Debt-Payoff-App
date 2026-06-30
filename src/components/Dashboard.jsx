import { useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { supabase } from '../lib/supabaseClient'
import DebtForm from './DebtForm'
import PayoffChart from './PayoffChart'
import { compareStrategies, simulatePayoff, generateMonthlyTasks, monthsToDate, formatMoney, debtEfficiency, STRATEGIES } from '../lib/payoff'
import MonthlyTracker from './MonthlyTracker'

const STRATEGY_LABELS = { avalanche: 'Avalanche', snowball: 'Snowball', efficiency: 'Efficiency' }

export default function Dashboard({ user, householdId }) {
  const [debts, setDebts] = useState([])
  const [settings, setSettings] = useState({ strategy: 'avalanche', extra_monthly: 0 })
  const [editing, setEditing] = useState(null) // null | 'new' | debt object
  const [loading, setLoading] = useState(true)
  const [chargingFor, setChargingFor] = useState(null) // debt id with open quick-charge form
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeNote, setChargeNote] = useState('')
  const [chargeSaving, setChargeSaving] = useState(false)
  const [view, setView] = useState('plan') // 'plan' | 'track'
  const [celebrating, setCelebrating] = useState(null) // debt name currently being celebrated
  const prevDebtsRef = useRef(null)

  useEffect(() => {
    const prev = prevDebtsRef.current
    if (prev) {
      for (const d of debts) {
        const before = prev.find(p => p.id === d.id)
        // fired only on the transition from a positive balance to zero/paid
        if (before && Number(before.balance) > 0 && Number(d.balance) <= 0) {
          fireFireworks()
          setCelebrating(d.name)
          setTimeout(() => setCelebrating(null), 4500)
        }
      }
    }
    prevDebtsRef.current = debts
  }, [debts])

  function fireFireworks() {
    const colors = ['#D4A24E', '#F2F0EB', '#C75C4A']
    const duration = 3000
    const end = Date.now() + duration
    ;(function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 70,
        startVelocity: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      })
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 70,
        startVelocity: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    })()
    // a couple of bigger center bursts to read as "fireworks" rather than a sideways stream
    confetti({ particleCount: 80, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.5 }, colors })
    setTimeout(() => confetti({ particleCount: 80, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.4 }, colors }), 600)
    setTimeout(() => confetti({ particleCount: 80, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.6 }, colors }), 1200)
  }

  useEffect(() => { loadAll() }, [householdId])

  async function loadAll() {
    setLoading(true)
    const [{ data: debtRows }, { data: settingsRow }] = await Promise.all([
      supabase.from('debts').select('*').eq('household_id', householdId).order('sort_order'),
      supabase.from('household_settings').select('*').eq('household_id', householdId).single(),
    ])
    setDebts(debtRows || [])
    if (settingsRow) setSettings(settingsRow)
    setLoading(false)
  }

  async function updateSettings(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    await supabase.from('household_settings').upsert({ household_id: householdId, ...next })
  }

  async function logCharge(debt) {
    const amt = parseFloat(chargeAmount)
    if (!amt || amt <= 0) return
    setChargeSaving(true)
    const newBalance = Number(debt.balance) + amt
    const { error } = await supabase.from('debts').update({ balance: newBalance }).eq('id', debt.id)
    if (!error) {
      await supabase.from('payments').insert({
        debt_id: debt.id,
        amount: amt,
        type: 'charge',
        note: chargeNote.trim() || null,
      })
    }
    setChargeSaving(false)
    setChargingFor(null)
    setChargeAmount('')
    setChargeNote('')
    loadAll()
  }

  const result = useMemo(() => {
    if (!debts.length) return null
    return simulatePayoff(debts, settings.strategy, Number(settings.extra_monthly) || 0)
  }, [debts, settings])

  const comparison = useMemo(() => {
    if (!debts.length) return null
    return compareStrategies(debts, Number(settings.extra_monthly) || 0)
  }, [debts, settings.extra_monthly])

  const totalBalance = debts.reduce((s, d) => s + Number(d.balance), 0)
  const totalMin = debts.reduce((s, d) => s + (Number(d.balance) > 0 ? Number(d.min_payment) : 0), 0)

  if (loading) return <p style={{ color: 'var(--slate)', paddingTop: 40 }}>Loading your household…</p>

  if (editing === 'new' || editing) {
    return (
      <div style={{ paddingTop: 24 }}>
        <button className="btn secondary" onClick={() => setEditing(null)} style={{ marginBottom: 16 }}>← Back</button>
        <DebtForm
          householdId={householdId}
          existing={editing === 'new' ? null : editing}
          onDone={() => { setEditing(null); loadAll() }}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  return (
    <div>
      {celebrating && (
        <div className="card" style={{ textAlign: 'center', border: '1px solid var(--gold)', background: 'rgba(212,162,78,0.1)' }}>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Paid off 🎉</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: 0 }}>{celebrating} is debt-free!</p>
        </div>
      )}
      <header className="app-header">
        <span className="app-title">MacPhail Freedom Calculator</span>
        <button className="btn secondary" onClick={() => supabase.auth.signOut()} style={{ fontSize: 13, padding: '8px 14px' }}>Sign out</button>
      </header>

      {debts.length > 0 && (
        <div className="strategy-tabs" style={{ marginBottom: 20 }}>
          <button className={`strategy-tab ${view === 'plan' ? 'active' : ''}`} onClick={() => setView('plan')}>Plan</button>
          <button className={`strategy-tab ${view === 'track' ? 'active' : ''}`} onClick={() => setView('track')}>Track</button>
        </div>
      )}

      {view === 'track' && debts.length > 0 ? (
        <MonthlyTracker debts={debts} settings={settings} householdId={householdId} onRefresh={loadAll} />
      ) : null}

      {debts.length === 0 ? (
        <div className="empty-state">
          <p>No debts added yet. Add your first one to see your freedom date.</p>
          <button className="btn" onClick={() => setEditing('new')}>Add a debt</button>
        </div>
      ) : view === 'plan' ? (
        <>
          <div className="card">
            <p className="eyebrow">Debt-free on</p>
            <p className="hero-date">
              {result.months >= 600 ? 'Add a payment plan' : monthsToDate(result.months).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
            <div className="row" style={{ marginTop: 16 }}>
              <div>
                <p className="debt-meta" style={{ margin: 0 }}>Total interest paid</p>
                <p className="debt-balance" style={{ margin: 0 }}>{formatMoney(result.totalInterest)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="debt-meta" style={{ margin: 0 }}>Months to freedom</p>
                <p className="debt-balance" style={{ margin: 0 }}>{result.months}</p>
              </div>
            </div>
            <PayoffChart timeline={result.timeline} />
          </div>

          <div className="card">
            <p className="eyebrow" style={{ marginBottom: 10 }}>Strategy</p>
            <div className="strategy-tabs">
              {Object.values(STRATEGIES).map(s => (
                <button key={s} className={`strategy-tab ${settings.strategy === s ? 'active' : ''}`}
                  onClick={() => updateSettings({ strategy: s })}>
                  {STRATEGY_LABELS[s]}
                </button>
              ))}
            </div>

            <label htmlFor="extra">
              Extra payments in addition to {formatMoney(totalMin)} in minimum payments
            </label>
            <div className="slider-row">
              <span className="debt-balance" style={{ fontSize: 18 }}>$</span>
              <input id="extra" type="number" min="0" step="10" placeholder="0"
                value={settings.extra_monthly} onChange={e => updateSettings({ extra_monthly: e.target.value })} />
            </div>
            <p style={{ color: 'var(--slate)', fontSize: 12, marginTop: 6 }}>
              Total you're committing monthly: {formatMoney(totalMin + (Number(settings.extra_monthly) || 0))}
            </p>

            {comparison && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {Object.entries(comparison).map(([key, r]) => (
                  <div key={key} style={{ fontSize: 12, color: settings.strategy === key ? 'var(--gold)' : 'var(--slate)' }}>
                    <div style={{ fontWeight: 600 }}>{STRATEGY_LABELS[key]}</div>
                    <div className="debt-meta">{r.months}mo · {formatMoney(r.totalInterest)} interest</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="row" style={{ marginBottom: 8 }}>
              <p className="eyebrow" style={{ margin: 0 }}>Your debts</p>
              <span className="debt-meta">{formatMoney(totalBalance)} total</span>
            </div>
            {debts.map((d, i) => (
              <div key={d.id}>
                <div className="debt-row">
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setEditing(d)}>
                    <div className="debt-name">{d.name}</div>
                    <div className="debt-meta">
                      {d.promo_months > 0 ? (
                        <>0% promo · {d.promo_months}mo left, then {d.apr}% APR</>
                      ) : (
                        <>{d.apr}% APR</>
                      )} · {formatMoney(d.min_payment)}/mo min · due {d.due_day || 1}th
                      {settings.strategy === 'efficiency' && (
                        <> · {(debtEfficiency(d) * 100).toFixed(1)}% efficiency</>
                      )}
                    </div>
                    <div className="debt-meta" style={{ color: 'var(--gold)', marginTop: 2 }}>
                      {d.balance <= 0
                        ? 'Already paid off'
                        : result.payoffDates[d.id]
                          ? `Paid off ${monthsToDate(result.payoffDates[d.id]).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
                          : 'Beyond current plan — add extra payment or change strategy'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="debt-balance">{formatMoney(d.balance)}</span>
                    <button
                      className="btn secondary"
                      style={{ padding: '6px 10px', fontSize: 13, lineHeight: 1 }}
                      onClick={() => { setChargingFor(chargingFor === d.id ? null : d.id); setChargeAmount(''); setChargeNote('') }}
                      aria-label={`Update balance after using ${d.name}`}
                    >
                      + Update balance after use
                    </button>
                  </div>
                </div>
                {chargingFor === d.id && (
                  <div style={{ background: 'rgba(212,162,78,0.06)', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--slate)' }}>
                      Add what you charged this month — your balance and payoff date update right away.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="number" min="0" step="0.01" autoFocus
                        placeholder="Amount"
                        value={chargeAmount}
                        onChange={e => setChargeAmount(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="text"
                        placeholder="Note (optional)"
                        value={chargeNote}
                        onChange={e => setChargeNote(e.target.value)}
                        style={{ flex: 1, fontFamily: 'var(--font-body)' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="btn" style={{ padding: '8px 16px', fontSize: 13 }} disabled={chargeSaving || !chargeAmount} onClick={() => logCharge(d)}>
                        {chargeSaving ? 'Adding…' : 'Add to balance'}
                      </button>
                      <button className="btn secondary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setChargingFor(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button className="btn secondary" style={{ marginTop: 14, width: '100%' }} onClick={() => setEditing('new')}>+ Add another debt</button>
          </div>

          <div className="card" style={{ textAlign: 'center' }}>
            <p className="eyebrow">Household code (share with your partner)</p>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>{householdId}</code>
          </div>
        </>
      ) : null}
    </div>
  )
}
