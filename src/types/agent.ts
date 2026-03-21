import type { AgentAction, AgentResponse } from "./actions.js";
import type { AgentRole, CompanyState } from "./state.js";

export interface AgentConfig {
  role: AgentRole;
  model: string;
  maxTokens: number;
  systemPrompt: string;
}

export interface AgentContext {
  currentRound: number;
  simulatedDate: string;
  companyState: CompanyState;
  unreadMessages: AgentMessage[];
  pendingTasks: AgentTask[];
  lastRoundSummary: string;
}

export interface AgentMessage {
  id: string;
  from: AgentRole;
  to: AgentRole;
  type: "directive" | "report" | "question" | "fyi";
  content: string;
  status: "unread" | "read" | "acted";
  round: number;
}

export interface AgentTask {
  id: string;
  title: string;
  assignee: AgentRole;
  priority: "P0" | "P1" | "P2";
  status: "pending" | "in_progress" | "done" | "blocked";
  due_round: number;
  description?: string;
}

export interface ActionResult {
  action: AgentAction;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface AgentTurnResult {
  role: AgentRole;
  response: AgentResponse;
  actionResults: ActionResult[];
}
