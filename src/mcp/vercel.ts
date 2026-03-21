import { createLogger } from "../utils/logger.js";
import { config } from "../utils/config.js";

const logger = createLogger("MCP:Vercel");

/**
 * Vercel MCP wrapper.
 * TODO: Implement actual MCP client connection.
 */
export class VercelMCP {
  private mcpUrl: string;

  constructor() {
    this.mcpUrl = config.vercel.mcpUrl;
    logger.info(`Vercel MCP initialized (${this.mcpUrl})`);
  }

  async deploy(
    repo: string,
    framework: string
  ): Promise<{ url: string; deploymentId: string }> {
    logger.info(`Deploying ${repo} (${framework})`);
    // TODO: MCP call to deploy
    return {
      url: `https://${repo}.vercel.app`,
      deploymentId: "deploy_placeholder",
    };
  }

  async getDeployments(): Promise<Array<{ id: string; url: string; status: string }>> {
    logger.info("Fetching deployments");
    // TODO: MCP call to list deployments
    return [];
  }
}
