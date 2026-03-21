import { createLogger } from "../utils/logger.js";
import { config } from "../utils/config.js";

const logger = createLogger("MCP:Calendar");

/**
 * Google Calendar MCP wrapper.
 * TODO: Implement actual MCP client connection.
 */
export class CalendarMCP {
  private mcpUrl: string;

  constructor() {
    this.mcpUrl = config.calendar.mcpUrl;
    logger.info(`Calendar MCP initialized (${this.mcpUrl})`);
  }

  async createEvent(
    title: string,
    date: string,
    description: string
  ): Promise<{ eventId: string }> {
    logger.info(`Creating calendar event: ${title} on ${date}`);
    // TODO: MCP call to create event
    return { eventId: "event_placeholder" };
  }
}
