import Anthropic from "@anthropic-ai/sdk";
import type { AgentConfig, AgentContext, AgentTurnResult } from "../types/agent.js";
import type { AgentResponse } from "../types/actions.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("BaseAgent");

export abstract class BaseAgent {
  protected client: Anthropic;
  protected config: AgentConfig;

  constructor(client: Anthropic, config: AgentConfig) {
    this.client = client;
    this.config = config;
  }

  abstract buildContext(ctx: AgentContext): string;

  async run(ctx: AgentContext): Promise<AgentTurnResult> {
    const contextPrompt = this.buildContext(ctx);

    logger.info(`Running ${this.config.role} agent for round ${ctx.currentRound}`);

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system: this.config.systemPrompt,
      messages: [{ role: "user", content: contextPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    let parsed: AgentResponse;
    try {
      parsed = JSON.parse(text) as AgentResponse;
    } catch {
      logger.error(`Failed to parse ${this.config.role} response`, { raw: text });
      parsed = { thinking: text, actions: [] };
    }

    logger.info(`${this.config.role} produced ${parsed.actions.length} actions`);

    return {
      role: this.config.role,
      response: parsed,
      actionResults: [], // filled by action-executor
    };
  }
}
