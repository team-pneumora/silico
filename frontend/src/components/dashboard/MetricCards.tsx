'use client'

import { Company, CompanySnapshot } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'

interface MetricCardsProps {
  company: Company
  snapshot: CompanySnapshot | null
}

function formatUSD(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function DeltaBadge({ current, seed }: { current: number; seed: number }) {
  const delta = current - seed
  const pct = seed !== 0 ? ((delta / seed) * 100).toFixed(1) : '0.0'
  const isPositive = delta >= 0

  return (
    <span className={`text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
      {isPositive ? '+' : ''}{formatUSD(delta)} ({isPositive ? '+' : ''}{pct}%)
    </span>
  )
}

export function MetricCards({ company, snapshot }: MetricCardsProps) {
  const treasury = snapshot?.treasury_usd ?? company.treasury_usd ?? 0
  const tradingBalance = snapshot?.trading_balance ?? 0
  const activeProducts = snapshot?.active_products ?? 0
  const totalRevenue = snapshot?.total_revenue ?? 0
  const seedMoney = company.seed_money ?? 0

  const metrics = [
    {
      label: 'Treasury USD',
      value: formatUSD(treasury),
      showDelta: true,
      current: treasury,
    },
    {
      label: 'Trading Balance',
      value: formatUSD(tradingBalance),
      showDelta: true,
      current: tradingBalance,
    },
    {
      label: 'Active Products',
      value: activeProducts.toString(),
      showDelta: false,
      current: 0,
    },
    {
      label: 'Total Revenue',
      value: formatUSD(totalRevenue),
      showDelta: true,
      current: totalRevenue,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="bg-[#111] border-zinc-800">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
              {metric.label}
            </p>
            <p className="text-2xl font-bold text-white mt-1">{metric.value}</p>
            {metric.showDelta && (
              <div className="mt-1">
                <DeltaBadge current={metric.current} seed={seedMoney} />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
