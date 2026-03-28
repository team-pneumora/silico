'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Agent {
  id: string
  role: string
  name: string
}

interface JournalEntry {
  id: string
  agent_id: string
  company_id: string
  round: number
  title: string
  content: string
  tags: string[] | null
  created_at: string
}

interface JournalViewerProps {
  agents: Agent[]
  journals: JournalEntry[]
}

const roleBadgeColors: Record<string, string> = {
  ceo: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  developer: 'bg-green-500/20 text-green-400 border-green-500/30',
  trader: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  analyst: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  researcher: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  strategist: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  system: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function JournalViewer({ agents, journals }: JournalViewerProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    agents[0]?.id ?? ''
  )

  const filteredJournals = journals.filter(
    (j) => j.agent_id === selectedAgentId
  )

  const selectedAgent = agents.find((a) => a.id === selectedAgentId)

  return (
    <div className="space-y-6">
      {/* Agent selector tabs */}
      <div className="flex flex-wrap gap-2">
        {agents.map((agent) => {
          const isActive = agent.id === selectedAgentId
          const roleColor =
            roleBadgeColors[agent.role?.toLowerCase() ?? ''] ??
            roleBadgeColors.system
          return (
            <Button
              key={agent.id}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className={
                isActive
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 bg-transparent'
              }
              onClick={() => setSelectedAgentId(agent.id)}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full mr-2 ${roleColor.split(' ')[0]}`}
              />
              {agent.name || agent.role}
            </Button>
          )
        })}
      </div>

      {/* Journal entries */}
      {filteredJournals.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          No journal entries for{' '}
          {selectedAgent?.name || selectedAgent?.role || 'this agent'}.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJournals.map((entry) => (
            <Card
              key={entry.id}
              className="bg-[#111] border-zinc-800 text-white"
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="border-zinc-600 text-zinc-300 text-xs"
                    >
                      Round {entry.round}
                    </Badge>
                    <h4 className="text-sm font-medium text-white">
                      {entry.title}
                    </h4>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {formatTimestamp(entry.created_at)}
                  </span>
                </div>

                <p className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
                  {entry.content}
                </p>

                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {entry.tags.map((tag, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="bg-zinc-800 text-zinc-400 text-[10px] border-zinc-700"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
