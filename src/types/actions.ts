import type { AgentRole } from "./state.js";

export type MessageType = "directive" | "report" | "question" | "fyi";
export type MessageStatus = "unread" | "read" | "acted";
export type TaskPriority = "P0" | "P1" | "P2";
export type TaskStatus = "pending" | "in_progress" | "done" | "blocked";

export interface ReadMessagesAction {
  type: "read_messages";
  filter: { to: AgentRole; status: MessageStatus };
}

export interface SendMessageAction {
  type: "send_message";
  to: AgentRole;
  message_type: MessageType;
  content: string;
}

export interface CreateTaskAction {
  type: "create_task";
  title: string;
  assignee: AgentRole;
  priority: TaskPriority;
  due_round: number;
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
  symbol: string;
  amount_usd: number;
  leverage: number;
  stop_loss_pct: number;
  take_profit_pct: number;
}

export interface ExecuteTradeAction {
  type: "execute_trade";
  directive_from: string;
  symbol: string;
  side: "long" | "short";
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
}

export interface UpdateCompanyStateAction {
  type: "update_company_state";
  changes: Record<string, unknown>;
}

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
  | UpdateCompanyStateAction;

export interface AgentResponse {
  thinking: string;
  actions: AgentAction[];
}
