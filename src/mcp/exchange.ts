import * as crypto from "node:crypto";
import { config } from "../utils/config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("MCP:Exchange");

interface BybitResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
}

/**
 * Bybit V5 Unified API wrapper.
 * Uses HMAC SHA256 signature for authentication.
 * Defaults to testnet — switch via EXCHANGE_BASE_URL.
 *
 * Docs: https://bybit-exchange.github.io/docs/v5/intro
 */
export class ExchangeClient {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private recvWindow = 20000;
  private timeOffset = 0;  // server time - local time (ms)

  constructor() {
    this.baseUrl = config.exchange.baseUrl;
    this.apiKey = config.exchange.apiKey;
    this.apiSecret = config.exchange.apiSecret;
    logger.info(`Bybit exchange client initialized (${this.baseUrl})`);
  }

  /** Sync local clock with Bybit server time */
  async syncTime(): Promise<void> {
    const localBefore = Date.now();
    const res = await fetch(`${this.baseUrl}/v5/market/time`);
    const data = await res.json() as { result: { timeSecond: string; timeNano: string } };
    const localAfter = Date.now();
    const serverTime = parseInt(data.result.timeSecond) * 1000;
    const localMid = (localBefore + localAfter) / 2;
    this.timeOffset = serverTime - localMid;
    logger.info(`Time sync: offset=${this.timeOffset}ms`);
  }

  /** Get current timestamp adjusted for server clock */
  private getTimestamp(): string {
    return String(Math.round(Date.now() + this.timeOffset));
  }

  /**
   * Bybit V5 signature:
   * sign = HMAC_SHA256(timestamp + apiKey + recvWindow + queryString_or_body)
   */
  private sign(timestamp: string, payload: string): string {
    const preSign = timestamp + this.apiKey + String(this.recvWindow) + payload;
    return crypto
      .createHmac("sha256", this.apiSecret)
      .update(preSign)
      .digest("hex");
  }

  /** Make authenticated GET request */
  private async get<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const timestamp = this.getTimestamp();
    const queryString = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString();

    const signature = this.sign(timestamp, queryString);
    const url = `${this.baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`;

    logger.debug(`GET ${endpoint}`, { params });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-BAPI-API-KEY": this.apiKey,
        "X-BAPI-SIGN": signature,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": String(this.recvWindow),
      },
    });

    const data = (await response.json()) as BybitResponse<T>;
    if (data.retCode !== 0) {
      throw new Error(`Bybit API error ${data.retCode}: ${data.retMsg}`);
    }
    return data.result;
  }

  /** Make authenticated POST request (JSON body) */
  private async post<T>(endpoint: string, body: Record<string, unknown> = {}): Promise<T> {
    const timestamp = this.getTimestamp();
    const bodyStr = JSON.stringify(body);

    const signature = this.sign(timestamp, bodyStr);
    const url = `${this.baseUrl}${endpoint}`;

    logger.debug(`POST ${endpoint}`, { body });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-BAPI-API-KEY": this.apiKey,
        "X-BAPI-SIGN": signature,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": String(this.recvWindow),
        "Content-Type": "application/json",
      },
      body: bodyStr,
    });

    const data = (await response.json()) as BybitResponse<T>;
    if (data.retCode !== 0) {
      throw new Error(`Bybit API error ${data.retCode}: ${data.retMsg}`);
    }
    return data.result;
  }

  // ── Public Methods ──

  /** Get USDT wallet balance */
  async getBalance(): Promise<number> {
    logger.info("Fetching wallet balance");
    const result = await this.get<{
      list: Array<{
        coin: Array<{ coin: string; walletBalance: string }>;
      }>;
    }>("/v5/account/wallet-balance", { accountType: "UNIFIED" });

    const coins = result.list?.[0]?.coin ?? [];
    const usdt = coins.find((c) => c.coin === "USDT");
    return usdt ? parseFloat(usdt.walletBalance) : 0;
  }

  /** Get open positions */
  async getPositions(): Promise<Array<{
    symbol: string;
    positionAmt: string;
    entryPrice: string;
    unRealizedProfit: string;
    leverage: string;
  }>> {
    logger.info("Fetching open positions");
    const result = await this.get<{
      list: Array<{
        symbol: string;
        size: string;
        avgPrice: string;
        unrealisedPnl: string;
        leverage: string;
        side: string;
      }>;
    }>("/v5/position/list", { category: "linear", settleCoin: "USDT" });

    // Map Bybit fields to our normalized format & filter zero positions
    return (result.list ?? [])
      .filter((p) => parseFloat(p.size) !== 0)
      .map((p) => ({
        symbol: p.symbol,
        positionAmt: p.side === "Sell" ? `-${p.size}` : p.size,
        entryPrice: p.avgPrice,
        unRealizedProfit: p.unrealisedPnl,
        leverage: p.leverage,
      }));
  }

  /** Set leverage for a symbol */
  async setLeverage(symbol: string, leverage: number): Promise<void> {
    logger.info(`Setting leverage: ${symbol} ${leverage}x`);
    try {
      await this.post("/v5/position/set-leverage", {
        category: "linear",
        symbol,
        buyLeverage: String(leverage),
        sellLeverage: String(leverage),
      });
    } catch (err) {
      // Bybit returns error if leverage is already set to the same value — ignore
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("110043")) {
        throw err;
      }
      logger.debug(`Leverage already set to ${leverage}x for ${symbol}`);
    }
  }

  /** Open a futures position with stop-loss and take-profit */
  async openPosition(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    leverage: number,
    stopLoss: number,
    takeProfit: number
  ): Promise<{ orderId: string; entryPrice: string }> {
    logger.info(`Opening ${side} ${symbol} qty=${quantity} leverage=${leverage}x`);

    // Set leverage first
    await this.setLeverage(symbol, leverage);

    // Place market order with SL/TP
    const bybitSide = side === "BUY" ? "Buy" : "Sell";
    const result = await this.post<{ orderId: string }>("/v5/order/create", {
      category: "linear",
      symbol,
      side: bybitSide,
      orderType: "Market",
      qty: String(quantity),
      stopLoss: String(stopLoss),
      takeProfit: String(takeProfit),
      slTriggerBy: "LastPrice",
      tpTriggerBy: "LastPrice",
    });

    logger.info(`Position opened: orderId=${result.orderId}`);

    // Fetch entry price from position
    const positions = await this.getPositions();
    const pos = positions.find((p) => p.symbol === symbol);
    const entryPrice = pos?.entryPrice ?? "0";

    return { orderId: result.orderId, entryPrice };
  }

  /** Close position for a symbol */
  async closePosition(symbol: string): Promise<{ orderId: string }> {
    logger.info(`Closing position: ${symbol}`);

    const positions = await this.getPositions();
    const pos = positions.find((p) => p.symbol === symbol);
    if (!pos) {
      throw new Error(`No open position for ${symbol}`);
    }

    const amt = parseFloat(pos.positionAmt);
    const side = amt > 0 ? "Sell" : "Buy";
    const qty = Math.abs(amt);

    const result = await this.post<{ orderId: string }>("/v5/order/create", {
      category: "linear",
      symbol,
      side,
      orderType: "Market",
      qty: String(qty),
      reduceOnly: true,
    });

    logger.info(`Position closed: orderId=${result.orderId}`);
    return { orderId: result.orderId };
  }

  /** Get order status */
  async getOrderStatus(symbol: string, orderId: string): Promise<{
    status: string;
    avgPrice: string;
    executedQty: string;
  }> {
    const result = await this.get<{
      list: Array<{
        orderStatus: string;
        avgPrice: string;
        cumExecQty: string;
      }>;
    }>("/v5/order/realtime", { category: "linear", symbol, orderId });

    const order = result.list?.[0];
    if (!order) {
      throw new Error(`Order ${orderId} not found for ${symbol}`);
    }

    return {
      status: order.orderStatus,
      avgPrice: order.avgPrice,
      executedQty: order.cumExecQty,
    };
  }

  /** Get current price for a symbol */
  async getPrice(symbol: string): Promise<number> {
    const result = await this.get<{
      list: Array<{ lastPrice: string }>;
    }>("/v5/market/tickers", { category: "linear", symbol });

    const ticker = result.list?.[0];
    if (!ticker) {
      throw new Error(`No ticker data for ${symbol}`);
    }
    return parseFloat(ticker.lastPrice);
  }
}
