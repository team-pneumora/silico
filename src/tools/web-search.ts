import Anthropic from "@anthropic-ai/sdk";
import type { AgentAction } from "../types/actions.js";
import type { ActionResult } from "../types/agent.js";
import type { ToolContext } from "../types/tools.js";
import { BaseTool } from "./base-tool.js";
import { config } from "../utils/config.js";

/**
 * Web search tool — uses Claude API with web_search built-in tool.
 */
export class WebSearchTool extends BaseTool {
  readonly name = "web_search";
  private client = new Anthropic({ apiKey: config.anthropic.apiKey });

  async execute(action: AgentAction, _context: ToolContext): Promise<ActionResult> {
    if (action.type !== "web_search") {
      return this.failure(action, `WebSearch tool cannot handle: ${action.type}`);
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (this.client.messages.create as any)({
        model: config.orchestrator.model,
        max_tokens: 2048,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: action.query }],
      }) as Anthropic.Message;

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      return this.success(action, text);
    } catch (err) {
      return this.failure(action, err instanceof Error ? err.message : String(err));
    }
  }
}
