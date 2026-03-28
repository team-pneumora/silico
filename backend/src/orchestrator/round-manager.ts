import Anthropic from "@anthropic-ai/sdk";
import { Agent } from "../agents/agent.js";
import { ActionExecutor } from "./action-executor.js";
import { ExchangeClient } from "../mcp/exchange.js";
import * as db from "../db/queries.js";
import { decrypt } from "../utils/crypto.js";
import type { AgentContext, AgentTurnResult } from "../types/agent.js";
import type { CompanyConfig, CompanyState, RoundLog } from "../types/state.js";
import { config } from "../utils/config.js";
import { createLogger, saveRoundLog as saveLocalRoundLog } from "../utils/logger.js";

const logger = createLogger("RoundManager");

/**
 * Manages the execution of a single round for a company.
 * Dynamically loads N agents from Supabase, runs them in execution_order.
 */
export class RoundManager {
  private client: Anthropic;
  private executor: ActionExecutor;
  private exchange: ExchangeClient;
  private consecutiveFailures = 0;

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropic.apiKey });
    this.executor = new ActionExecutor();
    this.exchange = new ExchangeClient();
  }

  /** Run a single round for a company */
  async runRound(company: CompanyConfig): Promise<RoundLog> {
    const round = company.current_round;
    const startTime = Date.now();
    logger.info(`=== ROUND ${round} START: ${company.emoji} ${company.name} ===`);

    try {
      // ── 1. Load fresh state from Supabase ──
      const freshCompany = await db.getCompany(company.id);
      const state = db.getCompanyState(freshCompany);

      // ── 2. Sync exchange positions (using per-company API keys) ──
      logger.info("Syncing exchange...");
      try {
        const exchange = this.getExchangeClient(freshCompany);
        await exchange.syncTime();
        const positions = await exchange.getPositions();
        const balance = await exchange.getBalance();
        state.open_positions = positions.map((p) => ({
          symbol: p.symbol as any,
          side: parseFloat(p.positionAmt) > 0 ? "long" as const : "short" as const,
          entry_price: parseFloat(p.entryPrice),
          amount_usd: Math.abs(parseFloat(p.positionAmt) * parseFloat(p.entryPrice)),
          leverage: parseInt(p.leverage),
          stop_loss: 0,
          take_profit: 0,
          order_id: "",
          opened_at_round: 0,
        }));
        state.trading_balance = balance;
      } catch (err) {
        logger.warn(`Exchange sync failed (continuing): ${err}`);
      }

      // ── 3. Load active agents ordered by execution_order ──
      const agents = await db.getActiveAgents(company.id);
      if (agents.length === 0) {
        throw new Error("No active agents for this company");
      }
      logger.info(`Agents: ${agents.map((a) => `${a.name}(${a.role})`).join(", ")}`);

      // ── 4. Run each agent in order ──
      const agentSummaries: Record<string, string> = {};
      const allResults: AgentTurnResult[] = [];

      for (const agentConfig of agents) {
        logger.info(`Running: ${agentConfig.name} (${agentConfig.role})...`);
        const agent = new Agent(this.client, agentConfig);

        // Build context from Supabase
        const unreadMessages = await db.getUnreadMessages(company.id, agentConfig.role);
        const pendingTasks = await db.getPendingTasks(company.id, agentConfig.role);
        const recentTrades = await db.getRecentTrades(company.id, 10);
        const lastRoundSummary = await db.getLastRoundSummary(company.id);

        const context: AgentContext = {
          currentRound: round,
          companyState: state,
          unreadMessages,
          pendingTasks,
          recentTrades,
          lastRoundSummary,
          agentConfig,
          allAgents: agents.map((a) => ({
            role: a.role, name: a.name, status: a.status,
          })),
        };

        const turnResult = await agent.run(context);

        // Execute actions
        turnResult.actionResults = await this.executor.executeActions(
          turnResult.response.actions,
          agentConfig, freshCompany, state, round
        );

        allResults.push(turnResult);
        const ok = turnResult.actionResults.filter((r) => r.success).length;
        agentSummaries[agentConfig.role] = `${turnResult.response.actions.length} actions, ${ok} ok`;
        logger.info(`  ${agentConfig.role}: ${ok}/${turnResult.response.actions.length} succeeded`);
      }

      // ── 5. Write round log ──
      const durationSec = Math.round((Date.now() - startTime) / 1000);

      // AI summary
      let aiSummary = `Round ${round}: ${agents.length} agents, ${Object.values(agentSummaries).join("; ")}`;
      try {
        const res = await this.client.messages.create({
          model: config.orchestrator.model,
          max_tokens: 512,
          messages: [{
            role: "user",
            content: `Summarize this round in 2-3 sentences:\n${JSON.stringify(agentSummaries)}\nCompany: ${company.name}, Treasury: $${state.treasury_usd}`,
          }],
        });
        aiSummary = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text).join("");
      } catch { /* use default */ }

      const roundLog: RoundLog = {
        round,
        agent_summaries: agentSummaries,
        ai_summary: aiSummary,
        treasury_snapshot: state.treasury_usd,
        trading_snapshot: state.trading_balance,
        duration_seconds: durationSec,
      };

      await db.saveRoundLog(company.id, roundLog);
      await db.saveSnapshot(company.id, round, state, agents.length);
      saveLocalRoundLog(round, { roundLog, agentResults: allResults });

      // ── 6. Advance round ──
      await db.updateCompany(company.id, {
        current_round: round + 1,
        treasury_usd: state.treasury_usd,
        trading_balance: state.trading_balance,
      } as any);

      this.consecutiveFailures = 0;
      logger.info(`=== ROUND ${round} END (${durationSec}s) ===`);
      return roundLog;

    } catch (err) {
      this.consecutiveFailures++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Round ${round} failed: ${msg}`);

      if (this.consecutiveFailures >= config.orchestrator.emergencyStop.consecutiveFailedRounds) {
        logger.error("EMERGENCY STOP: Too many consecutive failures");
        await db.updateCompany(company.id, { status: "paused" } as any);
      }
      throw err;
    }
  }

  /** Create an ExchangeClient using per-company encrypted API keys */
  private getExchangeClient(company: CompanyConfig): ExchangeClient {
    const encKey = (company as any).exchange_api_key_encrypted;
    const encSecret = (company as any).exchange_api_secret_encrypted;

    if (encKey && encSecret) {
      try {
        const apiKey = decrypt(encKey);
        const apiSecret = decrypt(encSecret);
        logger.info("Using company-specific exchange keys");
        return new ExchangeClient(apiKey, apiSecret);
      } catch (err) {
        logger.warn(`Failed to decrypt company keys, falling back to default: ${err}`);
      }
    }

    // Fallback to .env keys
    return new ExchangeClient();
  }
}
