import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  anthropic: {
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
  },

  notion: {
    mcpUrl: requireEnv("NOTION_MCP_URL"),
    messagesDbId: requireEnv("NOTION_MESSAGES_DB_ID"),
    tasksDbId: requireEnv("NOTION_TASKS_DB_ID"),
    companyStateDbId: requireEnv("NOTION_COMPANY_STATE_DB_ID"),
    decisionsDbId: requireEnv("NOTION_DECISIONS_DB_ID"),
    roundLogDbId: requireEnv("NOTION_ROUND_LOG_DB_ID"),
  },

  exchange: {
    apiKey: requireEnv("EXCHANGE_API_KEY"),
    apiSecret: requireEnv("EXCHANGE_API_SECRET"),
    baseUrl: optionalEnv(
      "EXCHANGE_BASE_URL",
      "https://testnet.binancefuture.com"
    ),
  },

  vercel: {
    mcpUrl: optionalEnv("VERCEL_MCP_URL", "https://mcp.vercel.com"),
  },

  github: {
    mcpUrl: optionalEnv("GITHUB_MCP_URL", "https://api.github.com"),
    token: requireEnv("GITHUB_TOKEN"),
  },

  gmail: {
    mcpUrl: requireEnv("GMAIL_MCP_URL"),
  },

  calendar: {
    mcpUrl: requireEnv("GCAL_MCP_URL"),
  },

  orchestrator: {
    roundIntervalMinutes: Number(
      optionalEnv("ROUND_INTERVAL_MINUTES", "60")
    ),
    maxRoundsPerDay: Number(optionalEnv("MAX_ROUNDS_PER_DAY", "24")),
    model: optionalEnv("AGENT_MODEL", "claude-sonnet-4-20250514"),
    maxTokensPerAgentCall: 4096,
    maxRetries: 3,
    emergencyStop: {
      treasuryBelow: 5,
      consecutiveFailedRounds: 5,
    },
  },
} as const;
