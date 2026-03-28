// ── Trading ──

export type TradingSide = "long" | "short";
export type TradingSymbol = "BTCUSDT" | "ETHUSDT";

export interface OpenPosition {
  symbol: TradingSymbol;
  side: TradingSide;
  entry_price: number;
  amount_usd: number;
  leverage: number;
  stop_loss: number;
  take_profit: number;
  order_id: string;
  opened_at_round: number;
}

/** Design doc §5.1 — hard limits enforced by both prompts and orchestrator */
export interface TradingLimits {
  max_single_position_ratio: number;
  max_total_exposure_ratio: number;
  max_leverage: number;
  max_stop_loss_pct: number;
  min_reward_risk_ratio: number;
  allowed_symbols: TradingSymbol[];
}

export const DEFAULT_TRADING_LIMITS: TradingLimits = {
  max_single_position_ratio: 0.3,
  max_total_exposure_ratio: 0.7,
  max_leverage: 10,
  max_stop_loss_pct: 5,
  min_reward_risk_ratio: 2,
  allowed_symbols: ["BTCUSDT", "ETHUSDT"],
};

// ── Company State (denormalized for fast reads) ──

export interface CompanyState {
  current_round: number;
  treasury_usd: number;
  trading_balance: number;
  open_positions: OpenPosition[];
  active_products: number;
  total_revenue: number;
}

export const SURVIVAL_MODE_THRESHOLD = 10;

// ── Company Config (loaded from Supabase) ──

export interface CompanyConfig {
  id: string;           // Supabase company UUID
  user_id: string;
  name: string;
  emoji: string;
  mission: string;
  strategy: string;
  status: "active" | "paused" | "archived";
  seed_money: number;
  current_round: number;
  treasury_usd: number;
  trading_balance: number;
  total_revenue: number;
  github_repo_url?: string;
  storage_bucket?: string;
}

// ── Agent (loaded from Supabase agents table) ──

export interface AgentConfig {
  id: string;           // Supabase agent UUID
  company_id: string;
  role: string;         // dynamic: "CEO", "Developer", "Trader", etc.
  name: string;
  status: "active" | "inactive" | "fired";
  system_prompt: string;
  model: string;
  max_tokens: number;
  personality: Record<string, unknown>;
  execution_order: number;
  tools: AgentToolConfig[];
}

export interface AgentToolConfig {
  tool_name: string;
  config: Record<string, unknown>;
  permissions: { read: boolean; write: boolean };
}

// ── Prompt Template ──

export interface PromptTemplate {
  id: string;
  role: string;
  name: string;
  system_prompt: string;
  default_tools: string[];
  description: string;
  is_default: boolean;
}

// ── Logging ──

export interface RoundLog {
  round: number;
  agent_summaries: Record<string, string>;
  ai_summary: string;
  treasury_snapshot: number;
  trading_snapshot: number;
  duration_seconds: number;
}

// ── Orchestrator Config ──

export interface EmergencyStopConfig {
  treasury_below: number;
  consecutive_failed_rounds: number;
}

export interface OrchestratorConfig {
  round_interval_minutes: number;
  max_rounds_per_day: number;
  model: string;
  max_tokens_per_agent_call: number;
  retry_on_failure: boolean;
  max_retries: number;
  emergency_stop: EmergencyStopConfig;
  trading_limits: TradingLimits;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  round_interval_minutes: 60,
  max_rounds_per_day: 24,
  model: "claude-sonnet-4-20250514",
  max_tokens_per_agent_call: 4096,
  retry_on_failure: true,
  max_retries: 3,
  emergency_stop: {
    treasury_below: 5,
    consecutive_failed_rounds: 5,
  },
  trading_limits: DEFAULT_TRADING_LIMITS,
};
