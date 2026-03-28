import Anthropic from "@anthropic-ai/sdk";
import type { AgentAction } from "../types/actions.js";
import type { ActionResult } from "../types/agent.js";
import type { ToolContext } from "../types/tools.js";
import { BaseTool } from "./base-tool.js";
import { config } from "../utils/config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Tool:MCP");

/**
 * Generic MCP tool — handles any action that routes through a Claude MCP server.
 * Used for: Notion, GitHub, Vercel, Gmail, Calendar.
 */
export class McpTool extends BaseTool {
  readonly name: string;
  private serverUrl: string;
  private authToken?: string;
  private client = new Anthropic({ apiKey: config.anthropic.apiKey });

  constructor(name: string, serverUrl: string, authToken?: string) {
    super();
    this.name = name;
    this.serverUrl = serverUrl;
    this.authToken = authToken;
  }

  async execute(action: AgentAction, _context: ToolContext): Promise<ActionResult> {
    try {
      const prompt = this.buildPrompt(action);
      const text = await this.callMcp(prompt);
      return this.success(action, text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`MCP ${this.name} failed: ${msg}`);
      return this.failure(action, msg);
    }
  }

  /** Call Claude API with this MCP server attached */
  private async callMcp(prompt: string): Promise<string> {
    const server: Record<string, unknown> = {
      type: "url",
      url: this.serverUrl,
      name: this.name,
    };
    if (this.authToken) server.authorization_token = this.authToken;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (this.client.beta.messages.create as any)({
      model: config.orchestrator.model,
      max_tokens: 2048,
      betas: ["mcp-client-2025-11-20"],
      messages: [{ role: "user", content: prompt }],
      mcp_servers: [server],
      tools: [{ type: "mcp_toolset", mcp_server_name: this.name }],
    }) as Anthropic.Message;

    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }

  /** Convert action to a natural-language prompt for the MCP */
  private buildPrompt(action: AgentAction): string {
    switch (action.type) {
      case "github_create_repo":
        return `Create a new public GitHub repository named "${action.name}" with description "${action.description}".`;
      case "vercel_deploy":
        return `Deploy the repository "${action.repo}" using framework "${action.framework}" to Vercel.`;
      case "send_email":
        return `Send an email to "${action.to}" with subject "${action.subject}" and body:\n${action.body}`;
      case "calendar_event":
        return `Create a calendar event titled "${action.title}" on ${action.date}. Description: ${action.description}`;
      default:
        return `Perform this action: ${JSON.stringify(action)}`;
    }
  }
}
