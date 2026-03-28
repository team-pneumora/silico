import type { ToolExecutor } from "../types/tools.js";
import type { AgentToolConfig } from "../types/state.js";
import { ExchangeTool } from "./exchange.js";
import { WebSearchTool } from "./web-search.js";
import { McpTool } from "./mcp-tool.js";
import { config } from "../utils/config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ToolRegistry");

/**
 * Maps tool names to executor instances.
 * Executors are created lazily on first use.
 */
export class ToolRegistry {
  private executors = new Map<string, ToolExecutor>();

  constructor() {
    // Register built-in tools
    this.register(new ExchangeTool());
    this.register(new WebSearchTool());
    this.register(new McpTool("notion", config.mcp.notion));
    this.register(new McpTool("github", "https://api.githubcopilot.com/mcp/", config.github.token));
    this.register(new McpTool("vercel", config.mcp.vercel));
    this.register(new McpTool("gmail", config.mcp.gmail));
    this.register(new McpTool("calendar", config.mcp.calendar));

    logger.info(`Tool registry initialized: ${[...this.executors.keys()].join(", ")}`);
  }

  register(executor: ToolExecutor): void {
    this.executors.set(executor.name, executor);
  }

  get(name: string): ToolExecutor | undefined {
    return this.executors.get(name);
  }

  /** Check if an agent has access to a tool */
  hasAccess(agentTools: AgentToolConfig[], toolName: string): boolean {
    return agentTools.some((t) => t.tool_name === toolName);
  }

  /** Check write permission for a tool */
  canWrite(agentTools: AgentToolConfig[], toolName: string): boolean {
    const tool = agentTools.find((t) => t.tool_name === toolName);
    return tool?.permissions.write ?? false;
  }
}
