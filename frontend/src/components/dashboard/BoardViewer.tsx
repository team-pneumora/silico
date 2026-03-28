'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface BoardPost {
  id: string
  company_id: string
  agent_id: string | null
  author_role: string
  round: number
  title: string
  content: string
  category: string
  pinned: boolean
  created_at: string
}

interface BoardViewerProps {
  posts: BoardPost[]
}

const CATEGORIES = [
  'All',
  'Research',
  'Strategy',
  'Technical',
  'Trading',
  'Report',
]

const categoryBadgeColors: Record<string, string> = {
  research: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  strategy: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  technical: 'bg-green-500/20 text-green-400 border-green-500/30',
  trading: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  report: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
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

export function BoardViewer({ posts }: BoardViewerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

  const filteredPosts =
    selectedCategory === 'All'
      ? posts
      : posts.filter(
          (p) =>
            p.category?.toLowerCase() === selectedCategory.toLowerCase()
        )

  return (
    <div className="space-y-6">
      {/* Category filter buttons */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const isActive = cat === selectedCategory
          return (
            <Button
              key={cat}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className={
                isActive
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 bg-transparent'
              }
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          )
        })}
      </div>

      {/* Posts */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          No posts found
          {selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const catColor =
              categoryBadgeColors[post.category?.toLowerCase() ?? ''] ??
              'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
            const roleColor =
              roleBadgeColors[post.author_role?.toLowerCase() ?? ''] ??
              roleBadgeColors.system

            return (
              <Card
                key={post.id}
                className={`bg-[#111] border-zinc-800 text-white ${
                  post.pinned ? 'ring-1 ring-yellow-500/30' : ''
                }`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {post.pinned && (
                        <span className="text-sm" title="Pinned">
                          📌
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs border ${roleColor}`}
                      >
                        {post.author_role}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-zinc-600 text-zinc-300 text-xs"
                      >
                        Round {post.round}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs border ${catColor}`}
                      >
                        {post.category}
                      </Badge>
                    </div>
                    <span className="text-xs text-zinc-500 shrink-0 ml-2">
                      {formatTimestamp(post.created_at)}
                    </span>
                  </div>

                  <h4 className="text-sm font-medium text-white mb-1">
                    {post.title}
                  </h4>

                  <p className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
