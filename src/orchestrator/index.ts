import Anthropic from "@anthropic-ai/sdk";
import { RoundManager } from "./round-manager.js";
import { ActionExecutor } from "./action-executor.js";
import { StateManager } from "./state-manager.js";
import { NotionMCP } from "../mcp/notion.js";
import { ExchangeMCP } from "../mcp/exchange.js";
import { GitHubMCP } from "../mcp/github.js";
import { VercelMCP } from "../mcp/vercel.js";
import { GmailMCP } from "../mcp/gmail.js";
import { CalendarMCP } from "../mcp/calendar.js";
import { config } from "../utils/config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Orchestrator");

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  logger.info("Silico Orchestrator starting...");

  // Initialize services
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const notion = new NotionMCP();
  const exchange = new ExchangeMCP();
  const github = new GitHubMCP();
  const vercel = new VercelMCP();
  const gmail = new GmailMCP();
  const calendar = new CalendarMCP();

  const executor = new ActionExecutor(
    notion,
    exchange,
    github,
    vercel,
    gmail,
    calendar
  );
  const stateManager = new StateManager(notion, exchange);
  const roundManager = new RoundManager(client, executor, stateManager, notion);

  // Load initial state
  await stateManager.load();
  const state = stateManager.getState();
  logger.info(`Loaded state: Round ${state.current_round}, Treasury $${state.treasury_usd}`);

  // Main loop
  let consecutiveFailures = 0;
  let roundsToday = 0;

  while (true) {
    // Emergency stop checks
    const currentState = stateManager.getState();
    if (currentState.treasury_usd < config.orchestrator.emergencyStop.treasuryBelow) {
      logger.error(
        `EMERGENCY STOP: Treasury ($${currentState.treasury_usd}) below minimum ($${config.orchestrator.emergencyStop.treasuryBelow})`
      );
      break;
    }

    if (consecutiveFailures >= config.orchestrator.emergencyStop.consecutiveFailedRounds) {
      logger.error(
        `EMERGENCY STOP: ${consecutiveFailures} consecutive failed rounds`
      );
      break;
    }

    if (roundsToday >= config.orchestrator.maxRoundsPerDay) {
      logger.info(`Max rounds per day (${config.orchestrator.maxRoundsPerDay}) reached. Resetting.`);
      roundsToday = 0;
    }

    // Run round
    try {
      logger.info(`Starting round ${currentState.current_round}...`);
      await roundManager.runRound();
      consecutiveFailures = 0;
      roundsToday++;
    } catch (err) {
      consecutiveFailures++;
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Round failed (${consecutiveFailures} consecutive): ${message}`);
    }

    // Wait for next round
    const intervalMs = config.orchestrator.roundIntervalMinutes * 60 * 1000;
    logger.info(
      `Waiting ${config.orchestrator.roundIntervalMinutes} minutes until next round...`
    );
    await sleep(intervalMs);
  }

  logger.info("Orchestrator stopped.");
}

main().catch((err) => {
  logger.error("Fatal error", err);
  process.exit(1);
});
