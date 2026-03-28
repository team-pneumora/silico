'use client'

import { AgentAction } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTimeline } from '@/lib/hooks/useTimeline'

interface ActivityTimelineProps {
  companyId: string
  initialActions: AgentAction[]
}

const roleBadgeColors: Record<string, string> = {
  ceo: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  developer: 'bg-green-500/20 text-green-400 border-green-500/30',
  trader: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  analyst: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
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

export function ActivityTimeline({ companyId, initialActions }: ActivityTimelineProps) {
  const actions = useTimeline(companyId, initialActions)

  const sorted = [...actions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="bg-[#111] border border-zinc-800 rounded-lg flex flex-col h-[500px] overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-medium text-white">Activity Timeline</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {sorted.map((action, idx) => {
            const roleColor = roleBadgeColors[action.agent_role?.toLowerCase() ?? ''] ?? roleBadgeColors.system
            const isSuccess = action.status === 'success'
            const isFailed = action.status === 'failed'

            return (
              <div key={action.id} className="flex gap-3 py-2">
                {/* Timeline line and dot */}
                <div className="flex flex-col items-center">
                  <span
                    className={`h-2.5 w-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                      isSuccess ? 'bg-green-400' : isFailed ? 'bg-red-400' : 'bg-zinc-500'
                    }`}
                  />
                  {idx < sorted.length - 1 && (
                    <div className="w-px flex-1 bg-zinc-800 mt-1" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className={`text-xs ${roleColor}`}>
                      {action.agent_role}
                    </Badge>
                    <span className="text-xs text-zinc-600">
                      {formatTimestamp(action.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300">{action.description}</p>
                </div>
              </div>
            )
          })}
          {sorted.length === 0 && (
            <div className="text-center text-zinc-500 text-sm py-8">No activity yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
