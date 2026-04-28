import { useState, useEffect, useRef } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { format } from 'date-fns'
import { useInterval } from '../hooks/useWebSocket'

const WINDOW_SECONDS = 60

function buildChartData(bids, fairValue) {
  if (!bids || bids.length === 0) return []
  const now = Date.now()
  const windowStart = now - WINDOW_SECONDS * 1000

  // Filter to last 60 seconds
  const recent = bids.filter((b) => {
    const ts = b.timestamp ? new Date(b.timestamp).getTime() : now
    return ts >= windowStart
  })

  return recent.map((bid, i) => {
    const ts = bid.timestamp ? new Date(bid.timestamp).getTime() : now
    const prev = i > 0 ? recent[i - 1] : null
    const prevTs = prev ? new Date(prev.timestamp).getTime() : ts
    const deltaSeconds = Math.max((ts - prevTs) / 1000, 0.1)
    const velocity = prev ? (bid.amount - prev.amount) / deltaSeconds / 100000 : 0

    return {
      time: format(new Date(ts), 'HH:mm:ss'),
      amount: bid.amount / 100000,
      velocity: Math.max(velocity, 0),
      fairValue: fairValue ? fairValue / 100000 : null,
    }
  })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border-dark rounded-xl p-3 shadow-xl text-xs">
      <p className="text-text-muted mb-2 font-mono">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-text-secondary capitalize">{entry.name}:</span>
          <span className="text-text-primary font-semibold">
            {entry.dataKey === 'velocity'
              ? `${entry.value.toFixed(2)}L/s`
              : `₹${entry.value.toFixed(1)}L`}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function BidVelocityChart({ bids = [], fairValue }) {
  const [data, setData] = useState([])

  useInterval(() => {
    setData(buildChartData(bids, fairValue))
  }, 1000)

  useEffect(() => {
    setData(buildChartData(bids, fairValue))
  }, [bids, fairValue])

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-text-muted gap-2">
        <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm">Waiting for bids…</p>
      </div>
    )
  }

  const fairValueL = fairValue ? fairValue / 100000 : null

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="amount"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `₹${v}L`}
          />
          <YAxis
            yAxisId="velocity"
            orientation="right"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v.toFixed(1)}L/s`}
          />
          <Tooltip content={<CustomTooltip />} />

          {fairValueL && (
            <ReferenceLine
              yAxisId="amount"
              y={fairValueL}
              stroke="#10b981"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `Fair ₹${fairValueL.toFixed(1)}L`,
                position: 'insideTopRight',
                fill: '#10b981',
                fontSize: 10,
              }}
            />
          )}

          <Area
            yAxisId="amount"
            type="monotone"
            dataKey="amount"
            name="Bid (L)"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#bidGrad)"
          />
          <Line
            yAxisId="velocity"
            type="monotone"
            dataKey="velocity"
            name="Velocity (L/s)"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 2"
          />

          <defs>
            <linearGradient id="bidGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
