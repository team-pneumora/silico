export interface CompanyState {
  current_round: number;
  simulated_date: string;
  treasury_usd: number;
  trading_balance: number;
  open_positions: OpenPosition[];
  active_products: string[];
  total_revenue: number;
}

export interface OpenPosition {
  symbol: string;
  side: "long" | "short";
  entry_price: number;
  amount_usd: number;
  leverage: number;
  stop_loss: number;
  take_profit: number;
  order_id: string;
  opened_at_round: number;
}

export interface RoundLog {
  round: number;
  date: string;
  ceo_actions_summary: string;
  developer_actions_summary: string;
  company_state_snapshot: CompanyState;
  round_summary: string;
}

export interface DecisionLog {
  round: number;
  agent: AgentRole;
  decision: string;
  reasoning: string;
  outcome: string;
}

export type AgentRole = "CEO" | "Developer";
