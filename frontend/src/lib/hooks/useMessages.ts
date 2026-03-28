'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Message } from '@/types/database'

export function useMessages(companyId: string, initialMessages: Message[]) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`messages:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId])

  return messages
}
