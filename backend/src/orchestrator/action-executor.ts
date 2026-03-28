import type { AgentAction } from "../types/actions.js";
import { ACTION_TOOL_MAP } from "../types/actions.js";
import type { ActionResult } from "../types/agent.js";
import type { AgentConfig, CompanyConfig, CompanyState } from "../types/state.js";
import { validateAction } from "./validators.js";
import { ToolRegistry } from "../tools/registry.js";
import * as db from "../db/queries.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ActionExecutor");

/**
 * Converts agent JSON actions into actual tool calls + DB writes.
 * All actions are validated, then either handled internally or dispatched to tools.
 */
export class ActionExecutor {
  private tools: ToolRegistry;

  constructor() {
    this.tools = new ToolRegistry();
  }

  /** Execute all actions from an agent turn */
  async executeActions(
    actions: AgentAction[],
    agent: AgentConfig,
    company: CompanyConfig,
    state: CompanyState,
    round: number
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of actions) {
      // Validate
      const validation = validateAction(action, agent, state);
      if (!validation.valid) {
        logger.warn(`Action rejected: ${action.type} — ${validation.reason}`);
        results.push({
          action, success: false, error: validation.reason,
          executed_at: new Date().toISOString(),
        });
        continue;
      }

      // Execute
      const startMs = Date.now();
      let result: ActionResult;

      try {
        result = await this.execute(action, agent, company, state, round);
        logger.info(`Action executed: ${action.type} [${result.success ? "ok" : "fail"}]`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Action failed: ${action.type} — ${msg}`);
        result = { action, success: false, error: msg, executed_at: new Date().toISOString() };
      }

      results.push(result);

      // Log to agent_actions timeline
      try {
        await db.logAgentAction(
          company.id, round, agent.id, agent.role,
          action.type, this.describeAction(action),
          result.result, result.success ? "success" : "failed",
          Date.now() - startMs
        );
      } catch (logErr) {
        logger.warn(`Failed to log action: ${logErr}`);
      }
    }

    return results;
  }

  /** Route action to internal handler or external tool */
  private async execute(
    action: AgentAction,
    agent: AgentConfig,
    company: CompanyConfig,
    state: CompanyState,
    round: number
  ): Promise<ActionResult> {
    const ts = () => new Date().toISOString();

    switch (action.type) {
      // ── Internal DB operations (no tool needed) ──

      case "read_messages": {
        const msgs = await db.getUnreadMessages(company.id, agent.role);
        const ids = msgs.map((m) => m.id);
        if (ids.length > 0) await db.markMessagesRead(ids);
        return { action, success: true, result: msgs, executed_at: ts() };
      }

      case "send_message": {
        const id = await db.sendMessage(
          company.id, round, agent.id, agent.role,
          action.to_role, action.message_type, action.content
        );
        return { action, success: true, result: { message_id: id }, executed_at: ts() };
      }

      case "create_task": {
        const id = await db.createTask(company.id, round, agent.id, {
          title: action.title,
          assignee_role: action.assignee_role,
          priority: action.priority,
          due_round: action.due_round,
          description: action.description,
        });
        return { action, success: true, result: { task_id: id }, executed_at: ts() };
      }

      case "update_task": {
        await db.updateTask(action.task_id, action.status);
        return { action, success: true, executed_at: ts() };
      }

      case "log_decision": {
        await db.logDecision(
          company.id, round, agent.id, agent.role,
          action.decision, action.reasoning, action.category
        );
        return { action, success: true, executed_at: ts() };
      }

      case "update_company_state": {
        await db.updateCompany(company.id, action.changes as Partial<CompanyConfig>);
        return { action, success: true, executed_at: ts() };
      }

      case "hire_agent": {
        const template = action.template_id
          ? null  // TODO: load by ID
          : await db.getDefaultTemplate(action.role);
        const prompt = template?.system_prompt ?? `You are a ${action.role} at ${company.name}.`;
        const newAgent = await db.createAgent(company.id, {
          role: action.role,
          name: action.name,
          system_prompt: prompt,
          execution_order: 10,
        });
        // Assign default tools from template
        if (template?.default_tools) {
          for (const toolName of template.default_tools) {
            await db.assignToolToAgent(newAgent.id, toolName);
          }
        }
        await db.sendMessage(
          company.id, round, agent.id, agent.role, null, "system",
          `${action.name} (${action.role}) has been hired.`
        );
        return { action, success: true, result: { agent_id: newAgent.id }, executed_at: ts() };
      }

      case "fire_agent": {
        await db.fireAgent(action.agent_id);
        await db.sendMessage(
          company.id, round, agent.id, agent.role, null, "system",
          `Agent ${action.agent_id} has been fired. Reason: ${action.reason}`
        );
        return { action, success: true, executed_at: ts() };
      }

      // ── External tool operations ──

      default: {
        const toolName = ACTION_TOOL_MAP[action.type];
        if (!toolName) {
          return { action, success: false, error: `No tool mapping for: ${action.type}`, executed_at: ts() };
        }

        const tool = this.tools.get(toolName);
        if (!tool) {
          return { action, success: false, error: `Tool not registered: ${toolName}`, executed_at: ts() };
        }

        const toolResult = await tool.execute(action, {
          companyConfig: company,
          companyState: state,
          agentConfig: agent,
          round,
        });

        // Record trades in trading_history
        if (toolResult.success && (action.type === "trading_decision" || action.type === "execute_trade")) {
          await db.recordTrade(company.id, round, agent.id, {
            symbol: action.symbol,
            side: action.type === "trading_decision"
              ? (action.action === "open_long" ? "long" : "short")
              : action.side,
            amount_usd: action.amount_usd,
            leverage: action.leverage,
          });
        }

        return toolResult;
      }
    }
  }

  /** Human-readable description for timeline */
  private describeAction(action: AgentAction): string {
    switch (action.type) {
      case "send_message": return `sent ${action.message_type} to ${action.to_role}`;
      case "create_task": return `created task "${action.title}" for ${action.assignee_role}`;
      case "web_search": return `searched: "${action.query}"`;
      case "trading_decision": return `${action.action} ${action.symbol} $${action.amount_usd}`;
      case "execute_trade": return `executed ${action.side} ${action.symbol} $${action.amount_usd}`;
      case "hire_agent": return `hired ${action.name} as ${action.role}`;
      case "fire_agent": return `fired agent: ${action.reason}`;
      default: return action.type;
    }
  }
}
