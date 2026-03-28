// Types matching Supabase schema (001_initial_schema.sql)

export type CompanyStatus = 'active' | 'paused' | 'archived'
export type AgentStatus = 'active' | 'inactive' | 'fired'
export type MessageType = 'directive' | 'report' | 'question' | 'fyi' | 'system'
export type MessageStatus = 'unread' | 'read' | 'acted'
export type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked'
export type TaskPriority = 'P0' | 'P1' | 'P2'
export type TradeSide = 'long' | 'short'
export type TradeStatus = 'open' | 'closed' | 'stopped' | 'liquidated'
export type ActionStatus = 'success' | 'failed' | 'skipped'
export type ProductStatus = 'active' | 'inactive'
export type DecisionCategory = 'trading' | 'product' | 'strategy' | 'technical' | 'hiring' | 'other'

export interface Company {
  id: string
  user_id: string
  name: string
  emoji: string | null
  mission: string | null
  strategy: string | null
  status: CompanyStatus
  seed_money: number
  current_round: number
  treasury_usd: number
  trading_balance: number
  total_revenue: number
  github_repo_url: string | null
  storage_bucket: string | null
  created_at: string
  updated_at: string
}

export interface Agent {
  id: string
  company_id: string
  role: string
  name: string
  status: AgentStatus
  execution_order: number
  created_at: string
}

export interface Message {
  id: string
  company_id: string
  round: number
  from_agent_id: string | null
  to_agent_id: string | null
  from_role: string
  to_role: string | null
  message_type: MessageType
  content: string
  status: MessageStatus
  metadata: Record<string, unknown>
  created_at: string
}

export interface Task {
  id: string
  company_id: string
  title: string
  description: string | null
  assignee_agent_id: string | null
  assignee_role: string | null
  creator_agent_id: string | null
  status: TaskStatus
  priority: TaskPriority
  due_round: number | null
  round_created: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CompanySnapshot {
  id: string
  company_id: string
  round: number
  treasury_usd: number
  trading_balance: number
  open_positions: unknown[]
  active_products: number
  total_revenue: number
  total_pnl: number
  agent_count: number
  created_at: string
}

export interface TradingHistory {
  id: string
  company_id: string
  round: number
  agent_id: string | null
  symbol: string
  side: TradeSide
  amount_usd: number
  leverage: number
  entry_price: number | null
  exit_price: number | null
  stop_loss: number | null
  take_profit: number | null
  pnl: number
  pnl_percent: number
  status: TradeStatus
  order_id: string | null
  opened_at: string
  closed_at: string | null
}

export interface AgentAction {
  id: string
  company_id: string
  round: number
  agent_id: string | null
  agent_role: string
  action_type: string
  description: string
  result: Record<string, unknown> | null
  status: ActionStatus
  duration_ms: number | null
  created_at: string
}

export interface Product {
  id: string
  company_id: string
  name: string
  platform: 'gumroad' | 'buymeacoffee' | 'other'
  price_usd: number
  product_url: string | null
  total_sold: number
  total_revenue: number
  status: ProductStatus
  created_at: string
}

export interface RoundLog {
  id: string
  company_id: string
  round_number: number
  agent_summaries: Record<string, string>
  ai_summary: string | null
  treasury_snapshot: number | null
  trading_snapshot: number | null
  duration_seconds: number | null
  created_at: string
}

export interface Decision {
  id: string
  company_id: string
  round: number
  agent_id: string | null
  agent_role: string
  decision: string
  reasoning: string | null
  outcome: string | null
  category: DecisionCategory
  created_at: string
}
