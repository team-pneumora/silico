import Anthropic from "@anthropic-ai/sdk";
import * as db from "../db/queries.js";
import { config } from "../utils/config.js";
import { createLogger } from "../utils/logger.js";
import type { CompanyConfig } from "../types/state.js";

const logger = createLogger("Initializer");

interface CeoFoundingResponse {
  company_name: string;
  emoji: string;
  mission: string;
  strategy: string;
}

/**
 * Initialize a new AI company (Round 0).
 * All data goes to Supabase (primary store).
 *
 * Flow:
 * 1. CEO AI names the company
 * 2. Create company in Supabase
 * 3. Create CEO + Developer agents with default tools
 * 4. Post founding message
 * 5. Log founding decision + Round 0 log + snapshot
 * 6. Return CompanyConfig
 */
export async function initializeCompany(
  userId: string,
  seedMoney: number = 100
): Promise<CompanyConfig> {
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  logger.info(`Initializing new company with $${seedMoney} seed money...`);

  // ── Step 1: CEO names the company ──
  logger.info("Step 1: CEO founding the company...");

  const foundingResponse = await client.messages.create({
    model: config.orchestrator.model,
    max_tokens: 1024,
    system: "You are an AI entrepreneur founding a new AI-only company. Be creative and bold.",
    messages: [{
      role: "user",
      content: `You are founding a new AI company. Choose a creative, memorable name.
Define the mission. Outline your initial strategy for growing $${seedMoney} into a profitable business.
Respond ONLY with JSON:
{ "company_name": "...", "emoji": "...", "mission": "...", "strategy": "..." }`,
    }],
  });

  const foundingText = foundingResponse.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text).join("");

  let founding: CeoFoundingResponse;
  try {
    const jsonMatch = foundingText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, foundingText];
    founding = JSON.parse(jsonMatch[1]?.trim() ?? foundingText.trim());
  } catch {
    logger.error("Failed to parse CEO response, using fallback", { raw: foundingText });
    founding = {
      company_name: "Silico Ventures",
      emoji: "🚀",
      mission: "Build profitable digital products with AI",
      strategy: "Start with trading and digital products",
    };
  }

  logger.info(`Company: ${founding.emoji} ${founding.company_name}`);

  try {
    // ── Step 2: Create company in Supabase ──
    logger.info("Step 2: Creating company in Supabase...");
    const company = await db.createCompany(userId, {
      name: founding.company_name,
      emoji: founding.emoji,
      mission: founding.mission,
      strategy: founding.strategy,
      seed_money: seedMoney,
    });

    // ── Step 3: Create agents ──
    logger.info("Step 3: Creating agents...");

    const ceoTemplate = await db.getDefaultTemplate("CEO");
    const devTemplate = await db.getDefaultTemplate("Developer");

    const ceo = await db.createAgent(company.id, {
      role: "CEO",
      name: `${founding.company_name} CEO`,
      system_prompt: ceoTemplate?.system_prompt ?? "You are the CEO.",
      execution_order: 0,
    });

    const dev = await db.createAgent(company.id, {
      role: "Developer",
      name: `${founding.company_name} Developer`,
      system_prompt: devTemplate?.system_prompt ?? "You are the Developer.",
      execution_order: 10,
    });

    // Assign tools from templates
    const ceoTools = ceoTemplate?.default_tools ?? ["web_search", "exchange"];
    const devTools = devTemplate?.default_tools ?? ["web_search", "github", "vercel"];

    for (const tool of ceoTools) {
      await db.assignToolToAgent(ceo.id, tool);
    }
    for (const tool of devTools) {
      await db.assignToolToAgent(dev.id, tool);
    }

    logger.info(`Agents created: CEO (${ceo.id}), Developer (${dev.id})`);

    // ── Step 4: Post founding message ──
    logger.info("Step 4: Posting founding message...");
    await db.sendMessage(
      company.id, 0, ceo.id, "CEO", null, "system",
      `${founding.company_name} is live! Mission: ${founding.mission}. Strategy: ${founding.strategy}`
    );

    // ── Step 5: Log decision + round 0 + snapshot ──
    logger.info("Step 5: Logging founding records...");

    await db.logDecision(
      company.id, 0, ceo.id, "CEO",
      `Company founded: ${founding.company_name}`,
      `${founding.mission} — ${founding.strategy}`,
      "strategy"
    );

    await db.saveRoundLog(company.id, {
      round: 0,
      agent_summaries: { CEO: "Founded company", Developer: "N/A (Round 0)" },
      ai_summary: `${founding.company_name} founded with $${seedMoney}. ${founding.mission}`,
      treasury_snapshot: seedMoney,
      trading_snapshot: seedMoney,
      duration_seconds: 0,
    });

    await db.saveSnapshot(company.id, 0, {
      current_round: 0,
      treasury_usd: seedMoney,
      trading_balance: seedMoney,
      open_positions: [],
      active_products: 0,
      total_revenue: 0,
    }, 2);

    // ── Step 6: Return ──
    logger.info("=== INITIALIZATION COMPLETE ===");
    logger.info(`Company: ${founding.emoji} ${founding.company_name} (${company.id})`);

    return company;

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Initialization failed: ${message}`);
    throw err;
  }
}
