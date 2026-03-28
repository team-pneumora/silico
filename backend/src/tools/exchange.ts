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

  /** Normalize symbol: BTC → BTCUSDT, ETH → ETHUSDT */
  private normalizeSymbol(symbol: string): string {
    const s = symbol.toUpperCase().trim();
    if (s.endsWith("USDT")) return s;
    return `${s}USDT`;
  }

  /** Round quantity to Bybit's minimum step size, returns clean number */
  private roundQty(symbol: string, qty: number): number {
    const stepSizes: Record<string, { step: number; decimals: number }> = {
      BTCUSDT: { step: 0.001, decimals: 3 },
      ETHUSDT: { step: 0.01, decimals: 2 },
      SOLUSDT: { step: 0.1, decimals: 1 },
      XRPUSDT: { step: 1, decimals: 0 },
    };
    const { step, decimals } = stepSizes[symbol] ?? { step: 0.001, decimals: 3 };
    return parseFloat((Math.floor(qty / step) * step).toFixed(decimals));
  }

  /** Round price to 2 decimal places to avoid floating point issues */
  private roundPrice(price: number): number {
    return parseFloat(price.toFixed(2));
  }

  async execute(action: AgentAction, context: ToolContext): Promise<ActionResult> {
    try {
      // Normalize symbol if present
      if ("symbol" in action && typeof action.symbol === "string") {
        (action as any).symbol = this.normalizeSymbol(action.symbol);
      }

      switch (action.type) {
        case "trading_decision": {
          if (action.action === "close") {
            const result = await this.client.closePosition(action.symbol);
            return this.success(action, result);
          }
          const side = action.action === "open_long" ? "BUY" : "SELL";
          const price = await this.client.getPrice(action.symbol);
          const quantity = this.roundQty(action.symbol, action.amount_usd / price);
          if (quantity <= 0) return this.failure(action, `Quantity too small for ${action.symbol}`);
          const stopLoss = this.roundPrice(side === "BUY"
            ? price * (1 - action.stop_loss_pct / 100)
            : price * (1 + action.stop_loss_pct / 100));
          const takeProfit = this.roundPrice(side === "BUY"
            ? price * (1 + action.take_profit_pct / 100)
            : price * (1 - action.take_profit_pct / 100));
          const result = await this.client.openPosition(
            action.symbol, side as "BUY" | "SELL", quantity,
            action.leverage, stopLoss, takeProfit
          );
          return this.success(action, result);
        }

        case "execute_trade": {
          const side = action.side === "long" ? "BUY" : "SELL";
          const price = await this.client.getPrice(action.symbol);
          const qty = this.roundQty(action.symbol, action.amount_usd / price);
          if (qty <= 0) return this.failure(action, `Quantity too small for ${action.symbol}`);
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
