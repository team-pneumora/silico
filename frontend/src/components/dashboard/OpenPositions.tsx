'use client'

import { TradingHistory } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { usePositions } from '@/lib/hooks/usePositions'

interface OpenPositionsProps {
  companyId: string
  initialTrades: TradingHistory[]
}

function formatUSD(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function OpenPositions({ companyId, initialTrades }: OpenPositionsProps) {
  const trades = usePositions(companyId, initialTrades)
  const openPositions = trades.filter((t) => t.status === 'open')

  return (
    <Card className="bg-[#111] border-zinc-800 h-[500px] flex flex-col overflow-hidden">
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-white">Open Positions</h3>
        </div>
        {openPositions.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 text-sm">No open positions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-medium">Symbol</th>
                  <th className="text-left px-4 py-2 font-medium">Side</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                  <th className="text-right px-4 py-2 font-medium">Leverage</th>
                  <th className="text-right px-4 py-2 font-medium">Entry</th>
                  <th className="text-right px-4 py-2 font-medium">PnL</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((trade) => {
                  const pnl = trade.pnl ?? 0
                  const isLong = trade.side?.toLowerCase() === 'long'

                  return (
                    <tr key={trade.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                      <td className="px-4 py-2 text-white font-medium">{trade.symbol}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={
                            isLong
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                          }
                        >
                          {trade.side}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-300">{formatUSD(trade.amount_usd ?? 0)}</td>
                      <td className="px-4 py-2 text-right text-zinc-300">{trade.leverage ?? 1}x</td>
                      <td className="px-4 py-2 text-right text-zinc-300">{formatUSD(trade.entry_price ?? 0)}</td>
                      <td className={`px-4 py-2 text-right font-medium ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}{formatUSD(pnl)}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">
                          {trade.status}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
