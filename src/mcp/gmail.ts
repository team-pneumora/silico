import { createLogger } from "../utils/logger.js";
import { config } from "../utils/config.js";

const logger = createLogger("MCP:Gmail");

/**
 * Gmail MCP wrapper.
 * TODO: Implement actual MCP client connection.
 */
export class GmailMCP {
  private mcpUrl: string;

  constructor() {
    this.mcpUrl = config.gmail.mcpUrl;
    logger.info(`Gmail MCP initialized (${this.mcpUrl})`);
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<{ messageId: string }> {
    logger.info(`Sending email to ${to}: ${subject}`);
    // TODO: MCP call to send email
    return { messageId: "email_placeholder" };
  }
}
