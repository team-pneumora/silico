import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Copy .env.example to .env and fill in your keys.`
    );
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  // Claude API
  anthropic: {
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
  },

  // Supabase (PRIMARY data store)
  supabase: {
    url: requireEnv("SUPABASE_URL"),
    anonKey: requireEnv("SUPABASE_ANON_KEY"),
    serviceKey: requireEnv("SUPABASE_SERVICE_KEY"),
  },

  // Exchange (Bybit Testnet)
  exchange: {
    apiKey: requireEnv("EXCHANGE_API_KEY"),
    apiSecret: requireEnv("EXCHANGE_API_SECRET"),
    baseUrl: optionalEnv("EXCHANGE_BASE_URL", "https://api-testnet.bybit.com"),
  },

  // GitHub
  github: {
    token: optionalEnv("GITHUB_TOKEN", ""),
  },

  // MCP server URLs (for Claude API mcp_servers — optional tools)
  mcp: {
    notion: "https://mcp.notion.com/mcp",
    vercel: "https://mcp.vercel.com",
    gmail: "https://gmail.mcp.claude.com/mcp",
    calendar: "https://gcal.mcp.claude.com/mcp",
  },

  // Orchestrator
  orchestrator: {
    roundIntervalMinutes: Number(optionalEnv("ROUND_INTERVAL_MINUTES", "60")),
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
