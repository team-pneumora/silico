import type { AgentAction } from "../types/actions.js";
import type { ActionResult } from "../types/agent.js";
import type { ToolContext } from "../types/tools.js";
import { BaseTool } from "./base-tool.js";
import { ExchangeClient } from "../mcp/exchange.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Tool:Exchange");

/**
 * Bybit exchange tool — wraps the existing ExchangeClient.
 * Handles trading_decision, execute_trade, check_positions.
 */
export class ExchangeTool extends BaseTool {
  readonly name = "exchange";
  private client = new ExchangeClient();

  async execute(action: AgentAction, context: ToolContext): Promise<ActionResult> {
    try {
      switch (action.type) {
        case "trading_decision": {
          if (action.action === "close") {
            const result = await this.client.closePosition(action.symbol);
            return this.success(action, result);
          }
          const side = action.action === "open_long" ? "BUY" : "SELL";
          const price = await this.client.getPrice(action.symbol);
          const quantity = action.amount_usd / price;
          const stopLoss = side === "BUY"
            ? price * (1 - action.stop_loss_pct / 100)
            : price * (1 + action.stop_loss_pct / 100);
          const takeProfit = side === "BUY"
            ? price * (1 + action.take_profit_pct / 100)
            : price * (1 - action.take_profit_pct / 100);
          const result = await this.client.openPosition(
            action.symbol, side as "BUY" | "SELL", quantity,
            action.leverage, stopLoss, takeProfit
          );
          return this.success(action, result);
        }

        case "execute_trade": {
          const side = action.side === "long" ? "BUY" : "SELL";
          const price = await this.client.getPrice(action.symbol);
          const qty = action.amount_usd / price;
          const result = await this.client.openPosition(
            action.symbol, side as "BUY" | "SELL", qty,
            action.leverage, action.stop_loss, action.take_profit
          );
          return this.success(action, result);
        }

        case "check_positions": {
          const positions = await this.client.getPositions();
          const balance = await this.client.getBalance();
          return this.success(action, { positions, balance });
        }

        default:
          return this.failure(action, `Exchange tool cannot handle: ${action.type}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Exchange action failed: ${msg}`);
      return this.failure(action, msg);
    }
  }
}
