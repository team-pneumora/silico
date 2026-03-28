import { getServiceClient } from "./client.js";
import type { AgentMessage, AgentTask } from "../types/agent.js";
import type {
  CompanyConfig,
  CompanyState,
  AgentConfig,
  AgentToolConfig,
  PromptTemplate,
  RoundLog,
} from "../types/state.js";
import type { MessageType, TaskPriority, TaskStatus } from "../types/actions.js";

const db = () => getServiceClient();

// ══════════════════════════════════════════════════════════════
// COMPANIES
// ══════════════════════════════════════════════════════════════

/** Get all active companies (for orchestrator loop) */
export async function getActiveCompanies(): Promise<CompanyConfig[]> {
  const { data, error } = await db()
    .from("companies")
    .select("*")
    .eq("status", "active");
  if (error) throw new Error(`getActiveCompanies: ${error.message}`);
  return data ?? [];
}

/** Get a single company by ID */
export async function getCompany(companyId: string): Promise<CompanyConfig> {
  const { data, error } = await db()
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();
  if (error) throw new Error(`getCompany: ${error.message}`);
  return data;
}

/** Create a new company */
export async function createCompany(
  userId: string,
  params: {
    name: string;
    emoji: string;
    mission: string;
    strategy: string;
    seed_money: number;
  }
): Promise<CompanyConfig> {
  const { data, error } = await db()
    .from("companies")
    .insert({
      user_id: userId,
      name: params.name,
      emoji: params.emoji,
      mission: params.mission,
      strategy: params.strategy,
      seed_money: params.seed_money,
      treasury_usd: params.seed_money,
      trading_balance: params.seed_money,
    })
    .select()
    .single();
  if (error) throw new Error(`createCompany: ${error.message}`);
  return data;
}

/** Valid columns for company updates */
const COMPANY_UPDATE_FIELDS = new Set([
  "name", "emoji", "mission", "strategy", "status", "current_round",
  "treasury_usd", "trading_balance", "total_revenue",
  "github_repo_url", "storage_bucket",
]);

/** Update company fields (only valid columns) */
export async function updateCompany(
  companyId: string,
  changes: Record<string, unknown>
): Promise<void> {
  // Filter to only valid columns
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (COMPANY_UPDATE_FIELDS.has(key)) {
      safe[key] = value;
    }
  }
  if (Object.keys(safe).length === 0) return;

  const { error } = await db()
    .from("companies")
    .update(safe)
    .eq("id", companyId);
  if (error) throw new Error(`updateCompany: ${error.message}`);
}

/** Get company state (financial data) */
export function getCompanyState(company: CompanyConfig): CompanyState {
  return {
    current_round: company.current_round,
    treasury_usd: company.treasury_usd,
    trading_balance: company.trading_balance,
    open_positions: [],  // synced from exchange
    active_products: 0,  // count from products table
    total_revenue: company.total_revenue,
  };
}

// ══════════════════════════════════════════════════════════════
// AGENTS
// ══════════════════════════════════════════════════════════════

/** Get active agents for a company, ordered by execution_order */
export async function getActiveAgents(companyId: string): Promise<AgentConfig[]> {
  const { data: agents, error } = await db()
    .from("agents")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("execution_order", { ascending: true });
  if (error) throw new Error(`getActiveAgents: ${error.message}`);

  // Load tools for each agent
  const result: AgentConfig[] = [];
  for (const agent of agents ?? []) {
    const tools = await getAgentTools(agent.id);
    result.push({ ...agent, tools });
  }
  return result;
}

/** Get tools assigned to an agent */
async function getAgentTools(agentId: string): Promise<AgentToolConfig[]> {
  const { data, error } = await db()
    .from("agent_tools")
    .select("config, permissions, tools(name)")
    .eq("agent_id", agentId);
  if (error) throw new Error(`getAgentTools: ${error.message}`);
  return (data ?? []).map((row: any) => ({
    tool_name: row.tools?.name ?? "unknown",
    config: row.config ?? {},
    permissions: row.permissions ?? { read: true, write: true },
  }));
}

/** Create a new agent */
export async function createAgent(
  companyId: string,
  params: {
    role: string;
    name: string;
    system_prompt: string;
    model?: string;
    max_tokens?: number;
    execution_order?: number;
    personality?: Record<string, unknown>;
  }
): Promise<AgentConfig> {
  const { data, error } = await db()
    .from("agents")
    .insert({
      company_id: companyId,
      role: params.role,
      name: params.name,
      system_prompt: params.system_prompt,
      model: params.model ?? "claude-sonnet-4-20250514",
      max_tokens: params.max_tokens ?? 4096,
      execution_order: params.execution_order ?? 0,
      personality: params.personality ?? {},
    })
    .select()
    .single();
  if (error) throw new Error(`createAgent: ${error.message}`);
  return { ...data, tools: [] };
}

/** Assign a tool to an agent */
export async function assignToolToAgent(
  agentId: string,
  toolName: string,
  permissions?: { read: boolean; write: boolean }
): Promise<void> {
  // Look up tool ID by name
  const { data: tool, error: toolErr } = await db()
    .from("tools")
    .select("id")
    .eq("name", toolName)
    .single();
  if (toolErr) throw new Error(`Tool not found: ${toolName}`);

  const { error } = await db()
    .from("agent_tools")
    .insert({
      agent_id: agentId,
      tool_id: tool.id,
      permissions: permissions ?? { read: true, write: true },
    });
  if (error && !error.message.includes("duplicate"))
    throw new Error(`assignTool: ${error.message}`);
}

/** Fire (soft-delete) an agent */
export async function fireAgent(agentId: string): Promise<void> {
  const { error } = await db()
    .from("agents")
    .update({ status: "fired" })
    .eq("id", agentId);
  if (error) throw new Error(`fireAgent: ${error.message}`);
}

// ══════════════════════════════════════════════════════════════
// MESSAGES
// ══════════════════════════════════════════════════════════════

/** Get unread messages for an agent (by role or broadcast) */
export async function getUnreadMessages(
  companyId: string,
  agentRole: string
): Promise<AgentMessage[]> {
  const { data, error } = await db()
    .from("messages")
    .select("id, from_role, to_role, message_type, content, status, round, created_at")
    .eq("company_id", companyId)
    .eq("status", "unread")
    .or(`to_role.eq.${agentRole},to_role.is.null`)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getUnreadMessages: ${error.message}`);
  return data ?? [];
}

const VALID_MESSAGE_TYPES = new Set(["directive", "report", "question", "fyi", "system"]);

/** Send a message (insert into messages table) */
export async function sendMessage(
  companyId: string,
  round: number,
  fromAgentId: string,
  fromRole: string,
  toRole: string | null,
  messageType: string,
  content: string
): Promise<string> {
  // Normalize unknown message types to 'fyi'
  const safeType = VALID_MESSAGE_TYPES.has(messageType) ? messageType : "fyi";
  const { data, error } = await db()
    .from("messages")
    .insert({
      company_id: companyId,
      round,
      from_agent_id: fromAgentId,
      from_role: fromRole,
      to_role: toRole === "All" ? null : toRole,
      message_type: safeType,
      content,
    })
    .select("id")
    .single();
  if (error) throw new Error(`sendMessage: ${error.message}`);
  return data.id;
}

/** Mark messages as read */
export async function markMessagesRead(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  const { error } = await db()
    .from("messages")
    .update({ status: "read" })
    .in("id", messageIds);
  if (error) throw new Error(`markMessagesRead: ${error.message}`);
}

// ══════════════════════════════════════════════════════════════
// TASKS
// ══════════════════════════════════════════════════════════════

/** Get pending tasks for an agent */
export async function getPendingTasks(
  companyId: string,
  agentRole: string
): Promise<AgentTask[]> {
  const { data, error } = await db()
    .from("tasks")
    .select("id, title, assignee_role, priority, status, due_round, description, round_created")
    .eq("company_id", companyId)
    .eq("assignee_role", agentRole)
    .in("status", ["todo", "doing", "blocked"])
    .order("priority", { ascending: true });
  if (error) throw new Error(`getPendingTasks: ${error.message}`);
  return data ?? [];
}

/** Create a task */
export async function createTask(
  companyId: string,
  round: number,
  creatorAgentId: string,
  params: {
    title: string;
    assignee_role: string;
    priority: TaskPriority;
    due_round?: number;
    description?: string;
  }
): Promise<string> {
  const { data, error } = await db()
    .from("tasks")
    .insert({
      company_id: companyId,
      title: params.title,
      assignee_role: params.assignee_role,
      creator_agent_id: creatorAgentId,
      priority: params.priority,
      due_round: params.due_round,
      description: params.description,
      round_created: round,
    })
    .select("id")
    .single();
  if (error) throw new Error(`createTask: ${error.message}`);
  return data.id;
}

/** Update task status */
export async function updateTask(
  taskId: string,
  status: TaskStatus
): Promise<void> {
  // Normalize status to valid values
  const validStatuses: TaskStatus[] = ["todo", "doing", "done", "blocked"];
  const normalizedStatus = status.toLowerCase().trim() as TaskStatus;
  const statusMap: Record<string, TaskStatus> = {
    "in_progress": "doing", "in-progress": "doing", "working": "doing", "started": "doing",
    "complete": "done", "completed": "done", "finished": "done",
    "pending": "todo", "open": "todo", "new": "todo",
    "block": "blocked", "stuck": "blocked",
  };
  const finalStatus = validStatuses.includes(normalizedStatus)
    ? normalizedStatus
    : (statusMap[normalizedStatus] ?? "todo");

  // Check if it looks like a UUID (loose check — allows minor formatting issues)
  const looksLikeUuid = /^[0-9a-f-]{20,}$/i.test(taskId);

  if (looksLikeUuid) {
    // Try direct ID match first
    const { data, error } = await db()
      .from("tasks")
      .update({ status: finalStatus })
      .eq("id", taskId)
      .select("id");
    if (!error && data && data.length > 0) return;
    // If no match, fall through to title search
  }

  // Fallback: match by title
  const { data, error: findError } = await db()
    .from("tasks")
    .select("id")
    .ilike("title", `%${taskId}%`)
    .limit(1)
    .single();
  if (findError || !data) throw new Error(`updateTask: task not found for "${taskId}"`);
  const { error } = await db()
    .from("tasks")
    .update({ status: finalStatus })
    .eq("id", data.id);
  if (error) throw new Error(`updateTask: ${error.message}`);
}

// ══════════════════════════════════════════════════════════════
// DECISIONS
// ══════════════════════════════════════════════════════════════

export async function logDecision(
  companyId: string,
  round: number,
  agentId: string,
  agentRole: string,
  decision: string,
  reasoning: string,
  category?: string
): Promise<void> {
  const { error } = await db()
    .from("decisions")
    .insert({
      company_id: companyId,
      round,
      agent_id: agentId,
      agent_role: agentRole,
      decision,
      reasoning,
      category: ["trading", "product", "strategy", "technical", "hiring", "other"].includes(category ?? "")
        ? category
        : "other",
    });
  if (error) throw new Error(`logDecision: ${error.message}`);
}

// ══════════════════════════════════════════════════════════════
// SNAPSHOTS & ROUND LOGS
// ══════════════════════════════════════════════════════════════

export async function saveSnapshot(
  companyId: string,
  round: number,
  state: CompanyState,
  agentCount: number
): Promise<void> {
  const { error } = await db()
    .from("company_snapshots")
    .insert({
      company_id: companyId,
      round,
      treasury_usd: state.treasury_usd,
      trading_balance: state.trading_balance,
      open_positions: state.open_positions,
      active_products: state.active_products,
      total_revenue: state.total_revenue,
      total_pnl: 0,
      agent_count: agentCount,
    });
  if (error) throw new Error(`saveSnapshot: ${error.message}`);
}

export async function saveRoundLog(
  companyId: string,
  log: RoundLog
): Promise<void> {
  const { error } = await db()
    .from("round_logs")
    .insert({
      company_id: companyId,
      round_number: log.round,
      agent_summaries: log.agent_summaries,
      ai_summary: log.ai_summary,
      treasury_snapshot: log.treasury_snapshot,
      trading_snapshot: log.trading_snapshot,
      duration_seconds: log.duration_seconds,
    });
  if (error) throw new Error(`saveRoundLog: ${error.message}`);
}

// ══════════════════════════════════════════════════════════════
// TRADING HISTORY
// ══════════════════════════════════════════════════════════════

export async function recordTrade(
  companyId: string,
  round: number,
  agentId: string,
  trade: {
    symbol: string;
    side: "long" | "short";
    amount_usd: number;
    leverage: number;
    entry_price?: number;
    stop_loss?: number;
    take_profit?: number;
    order_id?: string;
  }
): Promise<void> {
  const { error } = await db()
    .from("trading_history")
    .insert({
      company_id: companyId,
      round,
      agent_id: agentId,
      symbol: trade.symbol,
      side: trade.side,
      amount_usd: trade.amount_usd,
      leverage: trade.leverage,
      entry_price: trade.entry_price,
      stop_loss: trade.stop_loss,
      take_profit: trade.take_profit,
      order_id: trade.order_id,
    });
  if (error) throw new Error(`recordTrade: ${error.message}`);
}

/** Get recent trades for a company (for agent context feedback) */
export async function getRecentTrades(
  companyId: string,
  limit = 10
): Promise<Array<{
  round: number;
  symbol: string;
  side: string;
  amount_usd: number;
  leverage: number;
  entry_price: number | null;
  pnl: number | null;
  status: string;
  created_at: string;
}>> {
  const { data, error } = await db()
    .from("trading_history")
    .select("round, symbol, side, amount_usd, leverage, entry_price, pnl, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getRecentTrades: ${error.message}`);
  return data ?? [];
}

/** Get last round summary from round_logs */
export async function getLastRoundSummary(
  companyId: string
): Promise<string> {
  const { data } = await db()
    .from("round_logs")
    .select("summary")
    .eq("company_id", companyId)
    .order("round_number", { ascending: false })
    .limit(1)
    .single();
  return data?.summary ?? "";
}

// ══════════════════════════════════════════════════════════════
// AGENT ACTIONS (timeline)
// ══════════════════════════════════════════════════════════════

export async function logAgentAction(
  companyId: string,
  round: number,
  agentId: string,
  agentRole: string,
  actionType: string,
  description: string,
  result: unknown,
  status: "success" | "failed" | "skipped",
  durationMs?: number
): Promise<void> {
  const { error } = await db()
    .from("agent_actions")
    .insert({
      company_id: companyId,
      round,
      agent_id: agentId,
      agent_role: agentRole,
      action_type: actionType,
      description,
      result: result as Record<string, unknown> | null,
      status,
      duration_ms: durationMs,
    });
  if (error) throw new Error(`logAgentAction: ${error.message}`);
}

// ══════════════════════════════════════════════════════════════
// PROMPT TEMPLATES
// ══════════════════════════════════════════════════════════════

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  const { data, error } = await db()
    .from("agent_prompt_templates")
    .select("*")
    .order("role");
  if (error) throw new Error(`getPromptTemplates: ${error.message}`);
  return data ?? [];
}

export async function getDefaultTemplate(role: string): Promise<PromptTemplate | null> {
  const { data, error } = await db()
    .from("agent_prompt_templates")
    .select("*")
    .eq("role", role)
    .eq("is_default", true)
    .single();
  if (error) return null;
  return data;
}
