import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { formatMoney } from '../lib/payoff'

export default function PayoffChart({ timeline }) {
  if (!timeline?.length) return null
  // sample down to ~60 points for render performance on long timelines
  const step = Math.max(1, Math.floor(timeline.length / 60))
  const data = timeline.filter((_, i) => i % step === 0 || i === timeline.length - 1)
    .map(t => ({ month: t.month, balance: t.totalBalance }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(242,240,235,0.08)" vertical={false} />
        <XAxis dataKey="month" stroke="#6B7686" fontSize={11} tickLine={false} axisLine={false}
          label={{ value: 'months', position: 'insideBottomRight', fill: '#6B7686', fontSize: 11, dy: 10 }} />
        <YAxis stroke="#6B7686" fontSize={11} tickLine={false} axisLine={false}
          tickFormatter={v => `$${Math.round(v / 1000)}k`} width={48} />
        <Tooltip
          contentStyle={{ background: '#131C2E', border: '1px solid rgba(242,240,235,0.1)', borderRadius: 8 }}
          labelStyle={{ color: '#6B7686' }}
          formatter={(v) => [formatMoney(v), 'Balance']}
          labelFormatter={(m) => `Month ${m}`}
        />
        <Line type="monotone" dataKey="balance" stroke="#D4A24E" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
