'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TradingHistory } from '@/types/database'

export function usePositions(companyId: string, initialTrades: TradingHistory[]) {
  const [trades, setTrades] = useState<TradingHistory[]>(initialTrades)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`positions:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trading_history',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          setTrades((prev) => [payload.new as TradingHistory, ...prev])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trading_history',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          setTrades((prev) =>
            prev.map((t) =>
              t.id === (payload.new as TradingHistory).id
                ? (payload.new as TradingHistory)
                : t
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId])

  return trades
}
