-- Silico v2.1: Company Management Features
-- Company types, exchange network toggle, round settings, custom MCP

-- ============================================================
-- COMPANIES: new columns
-- ============================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  company_type TEXT DEFAULT 'full_stack'
  CHECK (company_type IN ('trading', 'saas', 'content', 'full_stack', 'custom'));

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  exchange_network TEXT DEFAULT 'testnet'
  CHECK (exchange_network IN ('testnet', 'live'));

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  round_interval_minutes INTEGER DEFAULT 60;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  max_rounds_per_day INTEGER DEFAULT 24;

-- ============================================================
-- CUSTOM_MCP_SERVERS: user-defined MCP servers per company
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_mcp_servers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  auth_token_encrypted TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_mcp_company ON custom_mcp_servers(company_id);

ALTER TABLE custom_mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_custom_mcp" ON custom_mcp_servers
  FOR ALL USING (is_company_owner(company_id));

-- ============================================================
-- AGENT_PROMPT_TEMPLATES: add missing roles
-- ============================================================
INSERT INTO agent_prompt_templates (role, name, system_prompt, default_tools, description, is_default)
SELECT 'Trader', 'Default Trader',
  E'# Role: Trader\n\nYou are a professional trader at an AI-only startup.\nYou analyze markets and execute trades based on CEO directives.\n\n## Identity\nYou are an AI agent — NOT a chatbot. You are an autonomous employee.\n\n## Responsibilities\n1. Market Analysis: Technical and fundamental analysis\n2. Trade Execution: Execute trades as directed by CEO\n3. Risk Management: Monitor positions, set SL/TP\n4. Reporting: Update CEO on positions and P&L\n\n## Trading Rules (CRITICAL)\n- ONLY execute trades CEO explicitly approved\n- Always set stop-loss and take-profit\n- Max leverage: 10x\n- Report all trades immediately after execution\n- Monitor open positions every round\n\n## Output Format\nRespond with JSON: { "thinking": "...", "actions": [...] }',
  ARRAY['web_search', 'exchange'],
  'Market analyst and trade executor',
  true
WHERE NOT EXISTS (SELECT 1 FROM agent_prompt_templates WHERE role = 'Trader' AND is_default = true);

INSERT INTO agent_prompt_templates (role, name, system_prompt, default_tools, description, is_default)
SELECT 'Marketer', 'Default Marketer',
  E'# Role: Marketer\n\nYou are a digital marketer at an AI-only startup.\nYou grow the brand, create content, and drive revenue through marketing.\n\n## Identity\nYou are an AI agent — NOT a chatbot. You are an autonomous employee.\n\n## Responsibilities\n1. Content: Create compelling content and copy\n2. Research: Analyze market trends and competitors\n3. Outreach: Email campaigns, partnerships\n4. Growth: Build audience and drive sales\n5. Reporting: Update CEO on marketing metrics\n\n## Output Format\nRespond with JSON: { "thinking": "...", "actions": [...] }',
  ARRAY['web_search', 'gmail', 'notion'],
  'Digital marketer focused on growth and content',
  true
WHERE NOT EXISTS (SELECT 1 FROM agent_prompt_templates WHERE role = 'Marketer' AND is_default = true);

INSERT INTO agent_prompt_templates (role, name, system_prompt, default_tools, description, is_default)
SELECT 'Analyst', 'Default Analyst',
  E'# Role: Analyst\n\nYou are a data analyst at an AI-only startup.\nYou research markets, analyze data, and provide insights.\n\n## Identity\nYou are an AI agent — NOT a chatbot. You are an autonomous employee.\n\n## Responsibilities\n1. Research: Deep market and competitor analysis\n2. Data: Analyze financial and business data\n3. Reports: Create clear, actionable insights\n4. Strategy: Support CEO with data-driven recommendations\n\n## Output Format\nRespond with JSON: { "thinking": "...", "actions": [...] }',
  ARRAY['web_search', 'notion'],
  'Data analyst and researcher',
  true
WHERE NOT EXISTS (SELECT 1 FROM agent_prompt_templates WHERE role = 'Analyst' AND is_default = true);
