import { RoundManager } from "./round-manager.js";
import { initializeCompany } from "./initializer.js";
import * as db from "../db/queries.js";
import { config } from "../utils/config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Orchestrator");

/** Parse CLI arguments */
function parseArgs(): {
  mode: "auto" | "init" | "once" | "rounds";
  roundCount?: number;
  userId?: string;
} {
  const args = process.argv.slice(2);

  if (args.includes("--init")) {
    const userIdx = args.indexOf("--user");
    const userId = userIdx >= 0 ? args[userIdx + 1] : undefined;
    return { mode: "init", userId };
  }
  if (args.includes("--once")) return { mode: "once" };
  const roundIdx = args.indexOf("--round");
  if (roundIdx >= 0) {
    return { mode: "rounds", roundCount: parseInt(args[roundIdx + 1]) || 1 };
  }
  return { mode: "auto" };
}

/** Main orchestrator loop */
async function main(): Promise<void> {
  const { mode, roundCount, userId } = parseArgs();
  logger.info(`Silico Orchestrator starting in "${mode}" mode`);

  // Init mode: create a new company
  if (mode === "init") {
    if (!userId) {
      logger.error("--user <user_id> is required for --init mode");
      logger.error("Usage: pnpm init -- --user <supabase-user-uuid>");
      process.exit(1);
    }
    const company = await initializeCompany(userId);
    console.log("\n✅ Company initialized:");
    console.log(JSON.stringify(company, null, 2));
    return;
  }

  // Load active companies from Supabase
  logger.info("Loading active companies...");
  const companies = await db.getActiveCompanies();

  if (companies.length === 0) {
    logger.warn("No active companies found. Use --init to create one.");
    return;
  }

  logger.info(`Found ${companies.length} active companies`);

  const roundManager = new RoundManager();

  // Determine how many rounds to run
  const maxRounds = mode === "once" ? 1 : (roundCount ?? Infinity);
  let roundsRun = 0;

  while (roundsRun < maxRounds) {
    for (const company of companies) {
      try {
        // After init, current_round is 0 but Round 0 log already exists.
        // Advance to 1 before running if needed.
        if (company.current_round === 0) {
          await db.updateCompany(company.id, { current_round: 1 } as any);
          company.current_round = 1;
        }
        await roundManager.runRound(company);
        const fresh = await db.getCompany(company.id);
        company.current_round = fresh.current_round;
        company.treasury_usd = fresh.treasury_usd;
        company.trading_balance = fresh.trading_balance;
      } catch (err) {
        logger.error(`Round failed for ${company.name}: ${err}`);
      }
    }

    roundsRun++;

    if (roundsRun < maxRounds) {
      const waitMs = config.orchestrator.roundIntervalMinutes * 60 * 1000;
      logger.info(`Waiting ${config.orchestrator.roundIntervalMinutes} minutes before next round...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  logger.info("Orchestrator finished.");
}

main().catch((err) => {
  logger.error("Fatal error", { error: String(err) });
  process.exit(1);
});
