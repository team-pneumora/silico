import { createLogger } from "../utils/logger.js";
import { config } from "../utils/config.js";
import type { AgentMessage, AgentTask } from "../types/agent.js";
import type { CompanyState, DecisionLog, RoundLog } from "../types/state.js";

const logger = createLogger("MCP:Notion");

/**
 * Notion MCP wrapper.
 * Communicates with the Notion MCP server for all database operations.
 * TODO: Implement actual MCP client connection.
 */
export class NotionMCP {
  private mcpUrl: string;

  constructor() {
    this.mcpUrl = config.notion.mcpUrl;
    logger.info(`Notion MCP initialized (${this.mcpUrl})`);
  }

  async queryMessages(
    to: string,
    status: string
  ): Promise<AgentMessage[]> {
    logger.info(`Querying messages: to=${to}, status=${status}`);
    // TODO: MCP call to query Notion Messages DB
    return [];
  }

  async createMessage(message: Omit<AgentMessage, "id">): Promise<string> {
    logger.info(`Creating message: ${message.from} → ${message.to}`);
    // TODO: MCP call to create page in Messages DB
    return "msg_placeholder";
  }

  async updateMessageStatus(id: string, status: string): Promise<void> {
    logger.info(`Updating message ${id} status to ${status}`);
    // TODO: MCP call to update page
  }

  async queryTasks(assignee: string, status?: string): Promise<AgentTask[]> {
    logger.info(`Querying tasks: assignee=${assignee}, status=${status}`);
    // TODO: MCP call to query Tasks DB
    return [];
  }

  async createTask(task: Omit<AgentTask, "id">): Promise<string> {
    logger.info(`Creating task: ${task.title} → ${task.assignee}`);
    // TODO: MCP call to create page in Tasks DB
    return "task_placeholder";
  }

  async updateTaskStatus(id: string, status: string): Promise<void> {
    logger.info(`Updating task ${id} status to ${status}`);
    // TODO: MCP call to update page
  }

  async getCompanyState(): Promise<CompanyState> {
    logger.info("Fetching company state");
    // TODO: MCP call to read Company State DB
    return {
      current_round: 1,
      simulated_date: new Date().toISOString().split("T")[0],
      treasury_usd: 100,
      trading_balance: 100,
      open_positions: [],
      active_products: [],
      total_revenue: 0,
    };
  }

  async updateCompanyState(
    changes: Partial<CompanyState>
  ): Promise<void> {
    logger.info("Updating company state", changes);
    // TODO: MCP call to update Company State page
  }

  async logDecision(entry: Omit<DecisionLog, "outcome">): Promise<string> {
    logger.info(`Logging decision by ${entry.agent}: ${entry.decision}`);
    // TODO: MCP call to create page in Decisions DB
    return "decision_placeholder";
  }

  async saveRoundLog(log: RoundLog): Promise<string> {
    logger.info(`Saving round ${log.round} log`);
    // TODO: MCP call to create page in Round Log DB
    return "roundlog_placeholder";
  }
}
