'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AgentAction } from '@/types/database'

const MAX_ACTIONS = 100

export function useTimeline(companyId: string, initialActions: AgentAction[]) {
  const [actions, setActions] = useState<AgentAction[]>(initialActions)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`timeline:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_actions',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          setActions((prev) => [payload.new as AgentAction, ...prev].slice(0, MAX_ACTIONS))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId])

  return actions
}
