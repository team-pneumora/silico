import { NotionMCP } from "../mcp/notion.js";
import { ExchangeMCP } from "../mcp/exchange.js";
import type { CompanyState } from "../types/state.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("StateManager");

export class StateManager {
  private notion: NotionMCP;
  private exchange: ExchangeMCP;
  private state: CompanyState | null = null;

  constructor(notion: NotionMCP, exchange: ExchangeMCP) {
    this.notion = notion;
    this.exchange = exchange;
  }

  async load(): Promise<CompanyState> {
    logger.info("Loading company state from Notion");
    this.state = await this.notion.getCompanyState();
    return this.state;
  }

  async syncWithExchange(): Promise<CompanyState> {
    if (!this.state) {
      await this.load();
    }

    logger.info("Syncing state with exchange");

    const [positions, balance] = await Promise.all([
      this.exchange.getPositions(),
      this.exchange.getBalance(),
    ]);

    this.state!.open_positions = positions;
    if (balance > 0) {
      this.state!.trading_balance = balance;
    }

    return this.state!;
  }

  async advanceRound(): Promise<CompanyState> {
    if (!this.state) {
      await this.load();
    }

    this.state!.current_round += 1;

    const nextDate = new Date(this.state!.simulated_date);
    nextDate.setDate(nextDate.getDate() + 1);
    this.state!.simulated_date = nextDate.toISOString().split("T")[0];

    await this.notion.updateCompanyState({
      current_round: this.state!.current_round,
      simulated_date: this.state!.simulated_date,
    });

    logger.info(`Advanced to round ${this.state!.current_round}`);
    return this.state!;
  }

  async update(changes: Partial<CompanyState>): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    Object.assign(this.state!, changes);
    await this.notion.updateCompanyState(changes);
    logger.info("Company state updated", changes);
  }

  getState(): CompanyState {
    if (!this.state) {
      throw new Error("State not loaded. Call load() first.");
    }
    return this.state;
  }
}
