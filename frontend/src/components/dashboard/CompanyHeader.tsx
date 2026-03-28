'use client'

import { Company, Agent } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface CompanyHeaderProps {
  company: Company
  agents: Pick<Agent, 'id' | 'role' | 'name' | 'status' | 'execution_order'>[]
}

export function CompanyHeader({ company, agents }: CompanyHeaderProps) {
  const statusColor = company.status === 'active'
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : company.status === 'paused'
      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'

  const roleColors: Record<string, string> = {
    ceo: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    developer: 'bg-green-500/20 text-green-400 border-green-500/30',
    trader: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    analyst: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    marketer: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  }

  return (
    <Card className="bg-[#111] border-zinc-800">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{company.emoji}</span>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{company.name}</h1>
                <Badge variant="outline" className={statusColor}>
                  {company.status}
                </Badge>
                <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-700">
                  Round {company.current_round}
                </Badge>
              </div>
              <p className="text-zinc-400 mt-1 max-w-2xl">{company.mission}</p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-zinc-500 mb-3">Agent Roster</h3>
          <div className="flex flex-wrap gap-3">
            {agents.map((agent) => {
              const colorClass = roleColors[agent.role?.toLowerCase() ?? ''] ?? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
              const agentStatusDot = agent.status === 'active'
                ? 'bg-green-400'
                : agent.status === 'inactive'
                  ? 'bg-yellow-400'
                  : 'bg-zinc-500'

              return (
                <div key={agent.id} className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-800">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs bg-zinc-700 text-white">
                      {agent.role?.charAt(0).toUpperCase() ?? 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <Badge variant="outline" className={`text-xs ${colorClass}`}>
                    {agent.role}
                  </Badge>
                  <span className={`h-2 w-2 rounded-full ${agentStatusDot}`} />
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
