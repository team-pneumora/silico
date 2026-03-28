import type { AgentAction, AgentResponse, MessageType, MessageStatus, TaskPriority, TaskStatus } from "./actions.js";
import type { AgentConfig, CompanyState } from "./state.js";

// ── Per-Round Context Injection ──

export interface RecentTrade {
  round: number;
  symbol: string;
  side: string;
  amount_usd: number;
  leverage: number;
  entry_price: number | null;
  pnl: number | null;
  status: string;
  created_at: string;
}

export interface AgentContext {
  currentRound: number;
  companyState: CompanyState;
  unreadMessages: AgentMessage[];
  pendingTasks: AgentTask[];
  recentTrades: RecentTrade[];
  lastRoundSummary: string;
  agentConfig: AgentConfig;  // this agent's config (role, tools, etc.)
  allAgents: { role: string; name: string; status: string }[];  // team roster
}

// ── Message Row ──

export interface AgentMessage {
  id: string;
  from_role: string;
  to_role: string | null;
  message_type: MessageType;
  content: string;
  status: MessageStatus;
  round: number;
  created_at: string;
}

// ── Task Row ──

export interface AgentTask {
  id: string;
  title: string;
  assignee_role: string | null;
  creator_role?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_round: number | null;
  description: string | null;
  round_created: number;
}

// ── Execution Results ──

export interface ActionResult {
  action: AgentAction;
  success: boolean;
  result?: unknown;
  error?: string;
  executed_at: string;
}

export interface AgentTurnResult {
  agent_id: string;
  role: string;
  round: number;
  response: AgentResponse;
  actionResults: ActionResult[];
  duration_ms: number;
}

// ── Round Lifecycle ──

export type RoundPhase =
  | "load_state"
  | "sync_exchange"
  | "run_agents"
  | "write_log"
  | "advance_round";

export interface RoundStatus {
  round: number;
  phase: RoundPhase;
  started_at: string;
  completed_at?: string;
  error?: string;
}
