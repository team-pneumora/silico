'use client'

import { useEffect, useRef } from 'react'
import { Message } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMessages } from '@/lib/hooks/useMessages'

interface AgentChatProps {
  companyId: string
  initialMessages: Message[]
}

const roleBadgeColors: Record<string, string> = {
  ceo: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  developer: 'bg-green-500/20 text-green-400 border-green-500/30',
  trader: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  analyst: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  system: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

const typeBgColors: Record<string, string> = {
  directive: 'border-l-red-500/60 bg-red-500/5',
  report: 'border-l-blue-500/60 bg-blue-500/5',
  question: 'border-l-yellow-500/60 bg-yellow-500/5',
  fyi: 'border-l-zinc-500/60 bg-zinc-500/5',
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function AgentChat({ companyId, initialMessages }: AgentChatProps) {
  const messages = useMessages(companyId, initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)

  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sorted.length])

  return (
    <div className="bg-[#111] border border-zinc-800 rounded-lg flex flex-col h-[500px] overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-medium text-white">Agent Chat</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {sorted.map((msg) => {
            const roleColor = roleBadgeColors[msg.from_role?.toLowerCase() ?? ''] ?? roleBadgeColors.system
            const typeBg = typeBgColors[msg.message_type?.toLowerCase() ?? ''] ?? typeBgColors.fyi

            return (
              <div
                key={msg.id}
                className={`border-l-2 rounded-r-lg px-3 py-2 ${typeBg}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={`text-xs ${roleColor}`}>
                    {msg.from_role}
                  </Badge>
                  {msg.to_role && (
                    <>
                      <span className="text-zinc-600 text-xs">→</span>
                      <Badge variant="outline" className="text-xs bg-zinc-800 text-zinc-400 border-zinc-700">
                        {msg.to_role}
                      </Badge>
                    </>
                  )}
                  <span className="text-xs text-zinc-600 ml-auto">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{msg.content}</p>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
