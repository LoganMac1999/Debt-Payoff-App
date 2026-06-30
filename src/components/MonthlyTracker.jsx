import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { generateMonthlyTasks, formatMoney } from '../lib/payoff'

const LABEL_STYLES = {
  Minimum: { color: '#6FA8D8', border: '#6FA8D8' },
  Extra: { color: 'var(--gold)', border: 'var(--gold)' },
  Payoff: { color: '#B98CD9', border: '#B98CD9' },
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function MonthlyTracker({ debts, settings, householdId, onRefresh }) {
  const [completions, setCompletions] = useState({}) // key: `${debtId}_${period}` -> true
  const [loading, setLoading] = useState(true)
  const [showExtraForm, setShowExtraForm] = useState(false)
  const [extraDebtId, setExtraDebtId] = useState(debts[0]?.id ?? '')
  const [extraAmount, setExtraAmount] = useState('')
  const [extraSaving, setExtraSaving] = useState(false)

  const tasks = useMemo(
    () => generateMonthlyTasks(debts, settings.strategy, Number(settings.extra_monthly) || 0, 3),
    [debts, settings.strategy, settings.extra_monthly]
  )

  useEffect(() => { loadCompletions() }, [householdId])

  async function loadCompletions() {
    setLoading(true)
    const debtIds = debts.map(d => d.id)
    if (!debtIds.length) { setLoading(false); return }
    const { data } = await supabase
      .from('task_completions')
      .select('*')
      .in('debt_id', debtIds)
    const map = {}
    for (const row of data || []) {
      map[`${row.debt_id}_${row.period}`] = row.completed
    }
    setCompletions(map)
    setLoading(false)
  }

  async function toggle(task) {
    const key = `${task.debtId}_${task.period}`
    const next = !completions[key]
    setCompletions(prev => ({ ...prev, [key]: next }))
    await supabase.from('task_completions').upsert({
      debt_id: task.debtId,
      period: task.period,
      completed: next,
      completed_at: next ? new Date().toISOString() : null,
    }, { onConflict: 'debt_id,period' })
  }

  async function submitExtraPayment() {
    const debt = debts.find(d => d.id === extraDebtId)
    const amt = parseFloat(extraAmount)
    if (!debt || !amt || amt <= 0) return
    setExtraSaving(true)
    const newBalance = Math.max(0, Number(debt.balance) - amt)
    const { error } = await supabase.from('debts').update({ balance: newBalance }).eq('id', debt.id)
    if (!error) {
      await supabase.from('payments').insert({
        debt_id: debt.id,
        amount: amt,
        type: 'payment',
        note: 'Extra payment logged from Track',
      })
    }
    setExtraSaving(false)
    setShowExtraForm(false)
    setExtraAmount('')
    onRefresh?.()
  }

  if (loading) return <p style={{ color: 'var(--slate)' }}>Loading your tasks…</p>

  // group tasks by period, in chronological order
  const grouped = []
  const seen = new Set()
  for (const t of tasks) {
    if (!seen.has(t.period)) { seen.add(t.period); grouped.push({ period: t.period, items: [] }) }
    grouped.find(g => g.period === t.period).items.push(t)
  }

  return (
    <div>
      <button className="btn secondary" style={{ width: '100%', marginBottom: 16 }} onClick={() => { setShowExtraForm(v => !v); setExtraDebtId(debts[0]?.id ?? '') }}>
        {showExtraForm ? '✕ Cancel' : '+ Make an extra payment'}
      </button>

      {showExtraForm && (
        <div className="card" style={{ border: '1px solid var(--gold)', background: 'rgba(212,162,78,0.06)' }}>
          <div className="field">
            <label htmlFor="extraDebt">Which debt?</label>
            <select id="extraDebt" value={extraDebtId} onChange={e => setExtraDebtId(e.target.value)} style={{ fontFamily: 'var(--font-body)' }}>
              {debts.filter(d => d.balance > 0).map(d => (
                <option key={d.id} value={d.id}>{d.name} — {formatMoney(d.balance)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="extraAmt">How much extra?</label>
            <input id="extraAmt" type="number" min="0" step="0.01" autoFocus
              value={extraAmount} onChange={e => setExtraAmount(e.target.value)} placeholder="e.g. 200" />
          </div>
          <button className="btn" disabled={extraSaving || !extraAmount || !extraDebtId} onClick={submitExtraPayment}>
            {extraSaving ? 'Applying…' : 'Apply extra payment'}
          </button>
          <p style={{ color: 'var(--slate)', fontSize: 12, marginTop: 10 }}>
            This reduces the balance right away — your freedom date, chart, and upcoming tasks all recalculate immediately.
          </p>
        </div>
      )}

      {!grouped.length ? (
        <p style={{ color: 'var(--slate)' }}>Nothing to track yet — add a debt to generate your monthly plan.</p>
      ) : (
        grouped.map(group => (
        <div className="card" key={group.period}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>{monthLabel(group.period)}</p>
          {group.items.map(task => {
            const key = `${task.debtId}_${task.period}`
            const done = Boolean(completions[key])
            const style = LABEL_STYLES[task.label]
            return (
              <div
                key={key}
                className="debt-row"
                style={{ cursor: 'pointer', opacity: done ? 0.55 : 1 }}
                onClick={() => toggle(task)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${done ? 'var(--gold)' : 'var(--line)'}`,
                    background: done ? 'var(--gold)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, color: 'var(--ink)', fontWeight: 700,
                  }}>
                    {done ? '✓' : ''}
                  </span>
                  <div>
                    <div className="debt-name" style={{ textDecoration: done ? 'line-through' : 'none' }}>{task.debtName}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                      <span className="tag" style={{ color: style.color, borderColor: style.border }}>
                        {task.label}
                      </span>
                      <span className="debt-meta">
                        Due {task.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="debt-balance">{formatMoney(task.amount)}</span>
              </div>
            )
          })}
        </div>
        ))
      )}
    </div>
  )
}
