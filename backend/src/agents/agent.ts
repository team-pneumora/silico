import Anthropic from "@anthropic-ai/sdk";
import type { AgentConfig } from "../types/state.js";
import type { AgentContext, AgentTurnResult } from "../types/agent.js";
import type { AgentResponse } from "../types/actions.js";
import { buildAgentContext } from "./context-builder.js";
import { config } from "../utils/config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Agent");

/**
 * Single Agent class that works for any role.
 * Loads system prompt and tools from AgentConfig (sourced from DB).
 */
export class Agent {
  private client: Anthropic;
  private agentConfig: AgentConfig;

  constructor(client: Anthropic, agentConfig: AgentConfig) {
    this.client = client;
    this.agentConfig = agentConfig;
  }

  get id(): string { return this.agentConfig.id; }
  get role(): string { return this.agentConfig.role; }
  get name(): string { return this.agentConfig.name; }

  /** Run a full agent turn: build context → call Claude → parse response */
  async run(context: AgentContext): Promise<AgentTurnResult> {
    const startTime = Date.now();
    const maxRetries = config.orchestrator.maxRetries;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`[${this.role}] ${this.name}: calling Claude (attempt ${attempt})`);
        const contextPrompt = buildAgentContext(context);
        const response = await this.callClaude(contextPrompt);

        return {
          agent_id: this.agentConfig.id,
          role: this.role,
          round: context.currentRound,
          response,
          actionResults: [],  // filled by ActionExecutor
          duration_ms: Date.now() - startTime,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn(`[${this.role}] Attempt ${attempt} failed: ${lastError.message}`);
      }
    }

    logger.error(`[${this.role}] All ${maxRetries} attempts failed`);
    return {
      agent_id: this.agentConfig.id,
      role: this.role,
      round: context.currentRound,
      response: {
        thinking: `Agent call failed after ${maxRetries} retries: ${lastError!.message}`,
        actions: [],
      },
      actionResults: [],
      duration_ms: Date.now() - startTime,
    };
  }

  /** Call Claude API with system prompt + context */
  private async callClaude(contextPrompt: string): Promise<AgentResponse> {
    // Build MCP servers list from agent's assigned tools
    const { servers: mcpServers, unavailable } = this.buildMcpServers();

    // Append unavailable tools warning to context
    if (unavailable.length > 0) {
      contextPrompt += `\n\n## Unavailable Tools (not configured)\nThe following tools are NOT available this round. Do NOT use actions that require them: ${unavailable.join(", ")}`;
    }

    const mcpToolsets = mcpServers.map((s) => ({
      type: "mcp_toolset",
      mcp_server_name: s.name,
    }));

    let response: Anthropic.Message;

    if (mcpServers.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response = await (this.client.beta.messages.create as any)({
        model: this.agentConfig.model,
        max_tokens: this.agentConfig.max_tokens,
        betas: ["mcp-client-2025-11-20"],
        system: this.agentConfig.system_prompt,
        messages: [{ role: "user", content: contextPrompt }],
        mcp_servers: mcpServers,
        tools: mcpToolsets,
      }) as Anthropic.Message;
    } else {
      response = await this.client.messages.create({
        model: this.agentConfig.model,
        max_tokens: this.agentConfig.max_tokens,
        system: this.agentConfig.system_prompt,
        messages: [{ role: "user", content: contextPrompt }],
      });
    }

    // Extract text and parse JSON
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
    const jsonStr = jsonMatch[1]?.trim() ?? text.trim();

    try {
      return JSON.parse(jsonStr) as AgentResponse;
    } catch {
      logger.error(`[${this.role}] Failed to parse response as JSON`, { raw: text.slice(0, 200) });
      return {
        thinking: text,
        actions: [],
      };
    }
  }

  /** Build MCP server configs from agent's tool list.
   *  Only includes MCP tools that have valid auth tokens configured. */
  private buildMcpServers(): { servers: Array<Record<string, unknown>>; unavailable: string[] } {
    const servers: Array<Record<string, unknown>> = [];
    const unavailable: string[] = [];

    // MCP tools that require auth tokens — skip if token is missing
    const notionToken = process.env.NOTION_TOKEN;
    const githubToken = config.github.token;

    // GitHub MCP requires OAuth, not PAT — disabled until OAuth flow is implemented
    const mcpTools: Record<string, { url: string; token?: string; requiresToken?: boolean }> = {
      notion: { url: config.mcp.notion, token: notionToken, requiresToken: true },
      github: { url: "https://api.githubcopilot.com/mcp/", requiresToken: true },
      vercel: { url: config.mcp.vercel, requiresToken: true },
      gmail: { url: config.mcp.gmail, requiresToken: true },
      calendar: { url: config.mcp.calendar, requiresToken: true },
    };

    for (const tool of this.agentConfig.tools) {
      const mcp = mcpTools[tool.tool_name];
      if (mcp) {
        // Skip MCP tools that require auth but have no token configured
        if (mcp.requiresToken && !mcp.token) {
          logger.debug(`Skipping MCP ${tool.tool_name}: no auth token configured`);
          unavailable.push(tool.tool_name);
          continue;
        }
        const server: Record<string, unknown> = {
          type: "url",
          url: mcp.url,
          name: tool.tool_name,
        };
        if (mcp.token) server.authorization_token = mcp.token;
        servers.push(server);
      }
    }

    return { servers, unavailable };
  }
}
