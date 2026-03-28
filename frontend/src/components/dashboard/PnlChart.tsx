'use client'

import { CompanySnapshot } from '@/types/database'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface PnlChartProps {
  snapshots: CompanySnapshot[]
}

function formatUSD(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: number
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-zinc-400 mb-1">Round {label}</p>
      {payload.map((entry: TooltipPayloadItem) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatUSD(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function PnlChart({ snapshots }: PnlChartProps) {
  const data = [...snapshots]
    .sort((a, b) => a.round - b.round)
    .map((s) => ({
      round: s.round,
      treasury_usd: s.treasury_usd,
      trading_balance: s.trading_balance,
    }))

  return (
    <div className="bg-[#111] border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-white mb-4">PnL Over Time</h3>
      {data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-zinc-500 text-sm">
          No snapshot data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="round"
              stroke="#52525b"
              tick={{ fill: '#71717a', fontSize: 12 }}
              label={{ value: 'Round', position: 'insideBottom', offset: -5, fill: '#71717a' }}
            />
            <YAxis
              stroke="#52525b"
              tick={{ fill: '#71717a', fontSize: 12 }}
              tickFormatter={(v: number) => `$${v.toLocaleString()}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ color: '#a1a1aa', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="treasury_usd"
              name="Treasury USD"
              stroke="#378ADD"
              strokeWidth={2}
              dot={{ fill: '#378ADD', r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="trading_balance"
              name="Trading Balance"
              stroke="#1D9E75"
              strokeWidth={2}
              dot={{ fill: '#1D9E75', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
