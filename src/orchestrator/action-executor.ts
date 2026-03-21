import type { AgentAction } from "../types/actions.js";
import type { ActionResult } from "../types/agent.js";
import type { AgentRole, CompanyState } from "../types/state.js";
import { validateAction } from "./validators.js";
import { NotionMCP } from "../mcp/notion.js";
import { ExchangeMCP } from "../mcp/exchange.js";
import { GitHubMCP } from "../mcp/github.js";
import { VercelMCP } from "../mcp/vercel.js";
import { GmailMCP } from "../mcp/gmail.js";
import { CalendarMCP } from "../mcp/calendar.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ActionExecutor");

export class ActionExecutor {
  private notion: NotionMCP;
  private exchange: ExchangeMCP;
  private github: GitHubMCP;
  private vercel: VercelMCP;
  private gmail: GmailMCP;
  private calendar: CalendarMCP;

  constructor(
    notion: NotionMCP,
    exchange: ExchangeMCP,
    github: GitHubMCP,
    vercel: VercelMCP,
    gmail: GmailMCP,
    calendar: CalendarMCP
  ) {
    this.notion = notion;
    this.exchange = exchange;
    this.github = github;
    this.vercel = vercel;
    this.gmail = gmail;
    this.calendar = calendar;
  }

  async executeActions(
    actions: AgentAction[],
    role: AgentRole,
    state: CompanyState,
    round: number
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of actions) {
      const validation = validateAction(action, role, state);

      if (!validation.valid) {
        logger.warn(`Action rejected: ${action.type} — ${validation.reason}`);
        results.push({
          action,
          success: false,
          error: validation.reason,
        });
        continue;
      }

      try {
        const result = await this.execute(action, role, round);
        results.push({ action, success: true, result });
        logger.info(`Action executed: ${action.type}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Action failed: ${action.type} — ${message}`);
        results.push({ action, success: false, error: message });
      }
    }

    return results;
  }

  private async execute(
    action: AgentAction,
    role: AgentRole,
    round: number
  ): Promise<unknown> {
    switch (action.type) {
      case "read_messages":
        return this.notion.queryMessages(action.filter.to, action.filter.status);

      case "send_message":
        return this.notion.createMessage({
          from: role,
          to: action.to,
          type: action.message_type,
          content: action.content,
          status: "unread",
          round,
        });

      case "create_task":
        return this.notion.createTask({
          title: action.title,
          assignee: action.assignee,
          priority: action.priority,
          status: "pending",
          due_round: action.due_round,
        });

      case "update_task":
        return this.notion.updateTaskStatus(action.task_id, action.status);

      case "web_search":
        // Handled via Claude API built-in tool
        logger.info(`Web search requested: ${action.query}`);
        return { query: action.query, note: "Handled via Claude API tool_use" };

      case "trading_decision":
        return this.notion.logDecision({
          round,
          agent: role,
          decision: `${action.action} ${action.symbol} $${action.amount_usd} @ ${action.leverage}x`,
          reasoning: `SL: ${action.stop_loss_pct}%, TP: ${action.take_profit_pct}%`,
        });

      case "execute_trade":
        return this.exchange.placeOrder({
          symbol: action.symbol,
          side: action.side,
          amount_usd: action.amount_usd,
          leverage: action.leverage,
          stop_loss: action.stop_loss,
          take_profit: action.take_profit,
        });

      case "check_positions":
        return this.exchange.getPositions();

      case "github_create_repo":
        return this.github.createRepository(action.name, action.description);

      case "vercel_deploy":
        return this.vercel.deploy(action.repo, action.framework);

      case "send_email":
        return this.gmail.sendEmail(action.to, action.subject, action.body);

      case "calendar_event":
        return this.calendar.createEvent(
          action.title,
          action.date,
          action.description
        );

      case "log_decision":
        return this.notion.logDecision({
          round,
          agent: role,
          decision: action.decision,
          reasoning: action.reasoning,
        });

      case "update_company_state":
        return this.notion.updateCompanyState(action.changes as Record<string, unknown>);

      default:
        throw new Error(`Unhandled action type: ${(action as AgentAction).type}`);
    }
  }
}
