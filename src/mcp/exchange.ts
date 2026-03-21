import { createLogger } from "../utils/logger.js";
import { config } from "../utils/config.js";
import type { OpenPosition } from "../types/state.js";

const logger = createLogger("MCP:Exchange");

export interface OrderParams {
  symbol: string;
  side: "long" | "short";
  amount_usd: number;
  leverage: number;
  stop_loss: number;
  take_profit: number;
}

export interface OrderResult {
  order_id: string;
  entry_price: number;
  status: string;
}

/**
 * Exchange (Binance Futures) MCP wrapper.
 * TODO: Implement actual exchange API integration.
 */
export class ExchangeMCP {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.exchange.baseUrl;
    logger.info(`Exchange MCP initialized (${this.baseUrl})`);
  }

  async getPositions(): Promise<OpenPosition[]> {
    logger.info("Fetching open positions");
    // TODO: API call to get positions
    return [];
  }

  async getBalance(): Promise<number> {
    logger.info("Fetching trading balance");
    // TODO: API call to get account balance
    return 0;
  }

  async placeOrder(params: OrderParams): Promise<OrderResult> {
    logger.info(`Placing order: ${params.side} ${params.symbol} $${params.amount_usd}`, params);
    // TODO: API call to place futures order
    return {
      order_id: "order_placeholder",
      entry_price: 0,
      status: "pending",
    };
  }

  async closePosition(symbol: string): Promise<OrderResult> {
    logger.info(`Closing position: ${symbol}`);
    // TODO: API call to close position
    return {
      order_id: "close_placeholder",
      entry_price: 0,
      status: "closed",
    };
  }

  async getPrice(symbol: string): Promise<number> {
    logger.info(`Fetching price for ${symbol}`);
    // TODO: API call to get current price
    return 0;
  }
}
