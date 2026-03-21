import Anthropic from "@anthropic-ai/sdk";
import { BaseAgent } from "../agents/base-agent.js";
import { CEO_SYSTEM_PROMPT } from "../agents/ceo/system-prompt.js";
import { buildCeoContext } from "../agents/ceo/context-builder.js";
import { DEVELOPER_SYSTEM_PROMPT } from "../agents/developer/system-prompt.js";
import { buildDeveloperContext } from "../agents/developer/context-builder.js";
import { ActionExecutor } from "./action-executor.js";
import { StateManager } from "./state-manager.js";
import { NotionMCP } from "../mcp/notion.js";
import type { AgentContext, AgentTurnResult } from "../types/agent.js";
import type { RoundLog } from "../types/state.js";
import { createLogger, saveRoundLog } from "../utils/logger.js";
import { config } from "../utils/config.js";

const logger = createLogger("RoundManager");

class CeoAgent extends BaseAgent {
  buildContext(ctx: AgentContext): string {
    return buildCeoContext(ctx);
  }
}

class DeveloperAgent extends BaseAgent {
  buildContext(ctx: AgentContext): string {
    return buildDeveloperContext(ctx);
  }
}

export class RoundManager {
  private client: Anthropic;
  private ceo: CeoAgent;
  private developer: DeveloperAgent;
  private executor: ActionExecutor;
  private stateManager: StateManager;
  private notion: NotionMCP;

  constructor(
    client: Anthropic,
    executor: ActionExecutor,
    stateManager: StateManager,
    notion: NotionMCP
  ) {
    this.client = client;
    this.executor = executor;
    this.stateManager = stateManager;
    this.notion = notion;

    const model = config.orchestrator.model;
    const maxTokens = config.orchestrator.maxTokensPerAgentCall;

    this.ceo = new CeoAgent(client, {
      role: "CEO",
      model,
      maxTokens,
      systemPrompt: CEO_SYSTEM_PROMPT,
    });

    this.developer = new DeveloperAgent(client, {
      role: "Developer",
      model,
      maxTokens,
      systemPrompt: DEVELOPER_SYSTEM_PROMPT,
    });
  }

  async runRound(): Promise<RoundLog> {
    // 1. Load & sync state
    const state = await this.stateManager.syncWithExchange();
    const round = state.current_round;
    logger.setRound(round);
    logger.info(`=== ROUND ${round} START ===`);

    // 2. Run CEO
    const ceoContext = await this.buildAgentContext("CEO", state);
    const ceoResult = await this.ceo.run(ceoContext);
    ceoResult.actionResults = await this.executor.executeActions(
      ceoResult.response.actions,
      "CEO",
      state,
      round
    );
    logger.info(`CEO completed: ${ceoResult.actionResults.length} actions executed`);

    // 3. Run Developer (with CEO's new messages available)
    const devContext = await this.buildAgentContext("Developer", state);
    const devResult = await this.developer.run(devContext);
    devResult.actionResults = await this.executor.executeActions(
      devResult.response.actions,
      "Developer",
      state,
      round
    );
    logger.info(`Developer completed: ${devResult.actionResults.length} actions executed`);

    // 4. Build round log
    const roundLog = this.buildRoundLog(round, state, ceoResult, devResult);

    // 5. Save logs
    await this.notion.saveRoundLog(roundLog);
    saveRoundLog(round, {
      roundLog,
      ceoRaw: ceoResult.response,
      devRaw: devResult.response,
    });

    // 6. Advance round
    await this.stateManager.advanceRound();

    logger.info(`=== ROUND ${round} END ===`);
    return roundLog;
  }

  private async buildAgentContext(
    role: "CEO" | "Developer",
    state: typeof this.stateManager extends { getState(): infer S } ? S : never
  ): Promise<AgentContext> {
    const [messages, tasks] = await Promise.all([
      this.notion.queryMessages(role, "unread"),
      this.notion.queryTasks(role, "pending"),
    ]);

    return {
      currentRound: state.current_round,
      simulatedDate: state.simulated_date,
      companyState: state,
      unreadMessages: messages,
      pendingTasks: tasks,
      lastRoundSummary: "",
    };
  }

  private buildRoundLog(
    round: number,
    state: ReturnType<StateManager["getState"]>,
    ceoResult: AgentTurnResult,
    devResult: AgentTurnResult
  ): RoundLog {
    const ceoSummary = ceoResult.response.actions
      .map((a) => a.type)
      .join(", ");
    const devSummary = devResult.response.actions
      .map((a) => a.type)
      .join(", ");

    return {
      round,
      date: state.simulated_date,
      ceo_actions_summary: `CEO actions: ${ceoSummary || "none"}`,
      developer_actions_summary: `Developer actions: ${devSummary || "none"}`,
      company_state_snapshot: { ...state },
      round_summary: `Round ${round}: CEO performed ${ceoResult.response.actions.length} actions, Developer performed ${devResult.response.actions.length} actions.`,
    };
  }
}
