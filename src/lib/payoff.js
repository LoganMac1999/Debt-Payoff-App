// Core payoff simulation engine.
// Simulates month-by-month amortization across multiple debts under a chosen
// strategy, applying minimum payments to all debts plus a rolling extra
// payment to the targeted debt (avalanche: highest APR first, snowball:
// smallest balance first, efficiency: highest payment-to-balance ratio first).

export const STRATEGIES = {
  avalanche: 'avalanche',
  snowball: 'snowball',
  efficiency: 'efficiency',
}

/** Debt efficiency = min payment / balance. Higher means it clears faster
 * relative to its size, so paying it down first frees up cash flow sooner. */
export function debtEfficiency(debt) {
  if (!debt.balance || debt.balance <= 0) return 0
  return debt.min_payment / debt.balance
}

function orderDebts(debts, strategy) {
  const list = debts.filter(d => d.balance > 0)
  if (strategy === STRATEGIES.avalanche) {
    return [...list].sort((a, b) => b.apr - a.apr)
  }
  if (strategy === STRATEGIES.snowball) {
    return [...list].sort((a, b) => a.balance - b.balance)
  }
  // efficiency
  return [...list].sort((a, b) => debtEfficiency(b) - debtEfficiency(a))
}

/**
 * Simulate full payoff schedule.
 * @param {Array} debts - [{id, name, balance, apr, min_payment, sort_order}]
 * @param {string} strategy - one of STRATEGIES
 * @param {number} extraMonthly - additional $ thrown at the priority debt each month
 * @param {number} maxMonths - safety cap (default 600 = 50 years)
 * @returns {{months: number, totalInterest: number, totalPaid: number,
 *            payoffDates: {id: monthIndex}, timeline: Array<{month, balances, totalBalance}>}}
 */
export function simulatePayoff(debts, strategy, extraMonthly = 0, maxMonths = 600) {
  // Deep copy working balances
  const working = debts.map(d => ({ ...d, balance: Number(d.balance) }))
  const order = orderDebts(working, strategy).map(d => d.id)
  const byId = Object.fromEntries(working.map(d => [d.id, d]))

  let month = 0
  let totalInterest = 0
  let totalPaid = 0
  const payoffDates = {}
  const timeline = []

  const isDone = () => order.every(id => byId[id].balance <= 0.005)

  while (!isDone() && month < maxMonths) {
    month += 1
    let freedExtra = extraMonthly

    // accrue interest first — debts in an active no-interest promo period
    // accrue nothing until the promo expires, then revert to their stated APR
    for (const id of order) {
      const d = byId[id]
      if (d.balance <= 0) continue
      const inPromo = (d.promo_months ?? 0) >= month
      const monthlyRate = inPromo ? 0 : (d.apr / 100) / 12
      const interest = d.balance * monthlyRate
      d.balance += interest
      totalInterest += interest
    }

    // pay minimums on every active debt
    for (const id of order) {
      const d = byId[id]
      if (d.balance <= 0) continue
      const pay = Math.min(d.min_payment, d.balance)
      d.balance -= pay
      totalPaid += pay
      if (d.balance <= 0.005 && !(id in payoffDates)) {
        // overflow from this min payment becomes freed-up minimum,
        // rolls into next priority debt this same month (snowball effect)
        freedExtra += d.min_payment - pay
        payoffDates[id] = month
        d.balance = 0
      }
    }

    // apply extra payment to the highest-priority remaining debt
    for (const id of order) {
      const d = byId[id]
      if (d.balance <= 0) continue
      const pay = Math.min(freedExtra, d.balance)
      d.balance -= pay
      totalPaid += pay
      freedExtra -= pay
      if (d.balance <= 0.005 && !(id in payoffDates)) {
        payoffDates[id] = month
        d.balance = 0
      }
      if (freedExtra <= 0) break
    }

    const totalBalance = order.reduce((sum, id) => sum + byId[id].balance, 0)
    timeline.push({
      month,
      balances: Object.fromEntries(order.map(id => [id, Math.round(byId[id].balance * 100) / 100])),
      totalBalance: Math.round(totalBalance * 100) / 100,
    })
  }

  return {
    months: month,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    payoffDates,
    timeline,
  }
}

/**
 * Like simulatePayoff, but additionally returns a flat list of monthly
 * "actions" — one entry per debt per month it received any payment — so the
 * UI can render real, checkable monthly tasks labeled by what actually
 * happened (minimum, extra, or the final payoff payment).
 */
export function simulatePayoffWithActions(debts, strategy, extraMonthly = 0, maxMonths = 600) {
  const working = debts.map(d => ({ ...d, balance: Number(d.balance) }))
  const order = orderDebts(working, strategy).map(d => d.id)
  const byId = Object.fromEntries(working.map(d => [d.id, d]))
  const nameById = Object.fromEntries(debts.map(d => [d.id, d.name]))

  let month = 0
  let totalInterest = 0
  const payoffDates = {}
  const timeline = []
  // key: `${month}_${debtId}` -> { amount, isPayoff, isExtra }
  const monthly = {}

  const record = (m, id, amount, isPayoff, isExtra) => {
    const key = `${m}_${id}`
    if (!monthly[key]) monthly[key] = { month: m, debtId: id, debtName: nameById[id], amount: 0, isPayoff: false, isExtra: false }
    monthly[key].amount += amount
    if (isPayoff) monthly[key].isPayoff = true
    if (isExtra) monthly[key].isExtra = true
  }

  const isDone = () => order.every(id => byId[id].balance <= 0.005)

  while (!isDone() && month < maxMonths) {
    month += 1
    let freedExtra = extraMonthly

    for (const id of order) {
      const d = byId[id]
      if (d.balance <= 0) continue
      const inPromo = (d.promo_months ?? 0) >= month
      const monthlyRate = inPromo ? 0 : (d.apr / 100) / 12
      const interest = d.balance * monthlyRate
      d.balance += interest
      totalInterest += interest
    }

    for (const id of order) {
      const d = byId[id]
      if (d.balance <= 0) continue
      const pay = Math.min(d.min_payment, d.balance)
      d.balance -= pay
      const justPaidOff = d.balance <= 0.005 && !(id in payoffDates)
      if (pay > 0) record(month, id, pay, justPaidOff, false)
      if (justPaidOff) {
        freedExtra += d.min_payment - pay
        payoffDates[id] = month
        d.balance = 0
      }
    }

    for (const id of order) {
      const d = byId[id]
      if (d.balance <= 0) continue
      const pay = Math.min(freedExtra, d.balance)
      d.balance -= pay
      freedExtra -= pay
      const justPaidOff = d.balance <= 0.005 && !(id in payoffDates)
      if (pay > 0) record(month, id, pay, justPaidOff, true)
      if (justPaidOff) {
        payoffDates[id] = month
        d.balance = 0
      }
      if (freedExtra <= 0) break
    }

    const totalBalance = order.reduce((sum, id) => sum + byId[id].balance, 0)
    timeline.push({
      month,
      totalBalance: Math.round(totalBalance * 100) / 100,
    })
  }

  const actions = Object.values(monthly)
    .map(a => ({ ...a, amount: Math.round(a.amount * 100) / 100 }))
    .sort((a, b) => a.month - b.month)

  return { months: month, totalInterest: Math.round(totalInterest * 100) / 100, payoffDates, timeline, actions }
}

/**
 * Build a calendar-grouped monthly task list for the UI, covering the next
 * `monthsAhead` calendar months from today.
 */
export function generateMonthlyTasks(debts, strategy, extraMonthly, monthsAhead = 3, startDate = new Date()) {
  const { actions } = simulatePayoffWithActions(debts, strategy, extraMonthly)
  const dueDayById = Object.fromEntries(debts.map(d => [d.id, Math.min(Math.max(d.due_day || 1, 1), 28)]))
  // If a debt's due day has already passed this calendar month, its first
  // upcoming payment (simulation month 1) actually lands next month — so we
  // anchor each debt's whole sequence from there, rather than patching month 1
  // in isolation (which previously caused it to collide with month 2).
  const anchorOffsetById = Object.fromEntries(
    debts.map(d => [d.id, dueDayById[d.id] < startDate.getDate() ? 1 : 0])
  )
  const cutoffMonth = monthsAhead
  return actions
    .filter(a => a.month <= cutoffMonth)
    .map(a => {
      const monthOffset = anchorOffsetById[a.debtId] + (a.month - 1)
      const due = new Date(startDate.getFullYear(), startDate.getMonth() + monthOffset, dueDayById[a.debtId])
      const label = a.isPayoff ? 'Payoff' : a.isExtra ? 'Extra' : 'Minimum'
      const period = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`
      return { ...a, dueDate: due, period, label }
    })
    .sort((a, b) => a.dueDate - b.dueDate)
}
export function compareStrategies(debts, extraMonthly = 0) {
  return {
    avalanche: simulatePayoff(debts, STRATEGIES.avalanche, extraMonthly),
    snowball: simulatePayoff(debts, STRATEGIES.snowball, extraMonthly),
    efficiency: simulatePayoff(debts, STRATEGIES.efficiency, extraMonthly),
  }
}

/** Project a freedom date (calendar) from a month count. */
export function monthsToDate(months, startDate = new Date()) {
  const d = new Date(startDate)
  d.setMonth(d.getMonth() + months)
  return d
}

export function formatMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
