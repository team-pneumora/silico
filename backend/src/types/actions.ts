import type { TradingSide, TradingSymbol } from "./state.js";

// ── Shared Enums ──

export type MessageType = "directive" | "report" | "question" | "fyi" | "system";
export type MessageStatus = "unread" | "read" | "acted";
export type TaskPriority = "P0" | "P1" | "P2";
export type TaskStatus = "todo" | "doing" | "done" | "blocked";

// ── Action Definitions ──

export interface ReadMessagesAction {
  type: "read_messages";
  filter?: { status?: MessageStatus };
}

export interface SendMessageAction {
  type: "send_message";
  to_role: string;       // target agent role (e.g., "Developer", "CEO", "All")
  message_type: MessageType;
  content: string;
}

export interface CreateTaskAction {
  type: "create_task";
  title: string;
  assignee_role: string;
  priority: TaskPriority;
  due_round?: number;
  description?: string;
}

export interface UpdateTaskAction {
  type: "update_task";
  task_id: string;
  status: TaskStatus;
}

export interface WebSearchAction {
  type: "web_search";
  query: string;
}

export interface TradingDecisionAction {
  type: "trading_decision";
  action: "open_long" | "open_short" | "close";
  symbol: TradingSymbol;
  amount_usd: number;
  leverage: number;
  stop_loss_pct: number;
  take_profit_pct: number;
}

export interface ExecuteTradeAction {
  type: "execute_trade";
  directive_from: string;
  symbol: TradingSymbol;
  side: TradingSide;
  amount_usd: number;
  leverage: number;
  stop_loss: number;
  take_profit: number;
}

export interface CheckPositionsAction {
  type: "check_positions";
}

export interface GitHubCreateRepoAction {
  type: "github_create_repo";
  name: string;
  description: string;
}

export interface VercelDeployAction {
  type: "vercel_deploy";
  repo: string;
  framework: string;
}

export interface SendEmailAction {
  type: "send_email";
  to: string;
  subject: string;
  body: string;
}

export interface CalendarEventAction {
  type: "calendar_event";
  title: string;
  date: string;
  description: string;
}

export interface LogDecisionAction {
  type: "log_decision";
  decision: string;
  reasoning: string;
  category?: "trading" | "product" | "strategy" | "technical" | "hiring" | "other";
}

export interface UpdateCompanyStateAction {
  type: "update_company_state";
  changes: Record<string, unknown>;
}

export interface HireAgentAction {
  type: "hire_agent";
  role: string;
  name: string;
  template_id?: string;  // prompt template to use
}

export interface FireAgentAction {
  type: "fire_agent";
  agent_id: string;
  reason: string;
}

// ── Union ──

export type AgentAction =
  | ReadMessagesAction
  | SendMessageAction
  | CreateTaskAction
  | UpdateTaskAction
  | WebSearchAction
  | TradingDecisionAction
  | ExecuteTradeAction
  | CheckPositionsAction
  | GitHubCreateRepoAction
  | VercelDeployAction
  | SendEmailAction
  | CalendarEventAction
  | LogDecisionAction
  | UpdateCompanyStateAction
  | HireAgentAction
  | FireAgentAction;

export type AgentActionType = AgentAction["type"];

export interface AgentResponse {
  thinking: string;
  actions: AgentAction[];
}

// ── Tool → Action mapping (which tool is needed for which action) ──

export const ACTION_TOOL_MAP: Record<AgentActionType, string | null> = {
  read_messages: null,       // internal DB read
  send_message: null,        // internal DB write
  create_task: null,         // internal DB write
  update_task: null,         // internal DB write
  log_decision: null,        // internal DB write
  update_company_state: null,// internal DB write
  hire_agent: null,          // internal DB write (CEO privilege)
  fire_agent: null,          // internal DB write (CEO privilege)
  web_search: "web_search",
  trading_decision: "exchange",
  execute_trade: "exchange",
  check_positions: "exchange",
  github_create_repo: "github",
  vercel_deploy: "vercel",
  send_email: "gmail",
  calendar_event: "calendar",
};
