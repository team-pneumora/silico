import type { AgentConfig, CompanyConfig, CompanyState } from "./state.js";
import type { ActionResult } from "./agent.js";
import type { AgentAction } from "./actions.js";

// ── Tool Interface ──

export interface ToolDefinition {
  name: string;
  description: string;
}

export interface ToolContext {
  companyConfig: CompanyConfig;
  companyState: CompanyState;
  agentConfig: AgentConfig;
  round: number;
}

/**
 * Base interface for all tool executors.
 * Each tool implements this to handle specific action types.
 */
export interface ToolExecutor {
  /** Tool name matching the `tools` table */
  readonly name: string;

  /** Execute an action using this tool */
  execute(
    action: AgentAction,
    context: ToolContext
  ): Promise<ActionResult>;
}

// ── MCP Server Config ──

export interface McpServerConfig {
  type: "url";
  url: string;
  name: string;
  authorization_token?: string;
}
