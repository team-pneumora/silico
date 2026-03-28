-- Silico v2: Supabase-Primary Schema
-- All agent communication, state, and data lives here.
-- Notion is demoted to an optional tool.

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🔥',
  mission TEXT,
  strategy TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  seed_money DECIMAL DEFAULT 100,
  current_round INTEGER DEFAULT 0,
  treasury_usd DECIMAL DEFAULT 100,
  trading_balance DECIMAL DEFAULT 100,
  total_revenue DECIMAL DEFAULT 0,
  github_repo_url TEXT,
  storage_bucket TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_user ON companies(user_id);
CREATE INDEX idx_companies_status ON companies(status);

-- ============================================================
-- AGENTS: dynamic roster per company
-- ============================================================
CREATE TABLE agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'fired')),
  system_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'claude-sonnet-4-20250514',
  max_tokens INTEGER DEFAULT 4096,
  personality JSONB DEFAULT '{}',
  execution_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agents_company ON agents(company_id);
CREATE INDEX idx_agents_company_active ON agents(company_id, status) WHERE status = 'active';

-- ============================================================
-- TOOLS: global tool catalog
-- ============================================================
CREATE TABLE tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  config_schema JSONB DEFAULT '{}',
  is_builtin BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AGENT_TOOLS: which tools each agent can use
-- ============================================================
CREATE TABLE agent_tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE NOT NULL,
  config JSONB DEFAULT '{}',
  permissions JSONB DEFAULT '{"read": true, "write": true}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, tool_id)
);

CREATE INDEX idx_agent_tools_agent ON agent_tools(agent_id);

-- ============================================================
-- MESSAGES: agent communication
-- ============================================================
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  round INTEGER NOT NULL,
  from_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  to_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  from_role TEXT NOT NULL,
  to_role TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN ('directive', 'report', 'question', 'fyi', 'system')),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'acted')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_company_round ON messages(company_id, round DESC);
CREATE INDEX idx_messages_to_status ON messages(to_agent_id, status) WHERE status = 'unread';

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  assignee_role TEXT,
  creator_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done', 'blocked')),
  priority TEXT DEFAULT 'P2' CHECK (priority IN ('P0', 'P1', 'P2')),
  due_round INTEGER,
  round_created INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_company ON tasks(company_id);
CREATE INDEX idx_tasks_assignee_status ON tasks(assignee_agent_id, status) WHERE status != 'done';

-- ============================================================
-- DECISIONS
-- ============================================================
CREATE TABLE decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  round INTEGER NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  agent_role TEXT NOT NULL,
  decision TEXT NOT NULL,
  reasoning TEXT,
  outcome TEXT,
  category TEXT CHECK (category IN ('trading', 'product', 'strategy', 'technical', 'hiring', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decisions_company_round ON decisions(company_id, round DESC);

-- ============================================================
-- COMPANY_SNAPSHOTS: per-round financial snapshot
-- ============================================================
CREATE TABLE company_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  round INTEGER NOT NULL,
  treasury_usd DECIMAL NOT NULL,
  trading_balance DECIMAL NOT NULL,
  open_positions JSONB DEFAULT '[]',
  active_products INTEGER DEFAULT 0,
  total_revenue DECIMAL DEFAULT 0,
  total_pnl DECIMAL DEFAULT 0,
  agent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, round)
);

CREATE INDEX idx_snapshots_company ON company_snapshots(company_id, round DESC);

-- ============================================================
-- TRADING_HISTORY
-- ============================================================
CREATE TABLE trading_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  round INTEGER NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  amount_usd DECIMAL NOT NULL,
  leverage INTEGER NOT NULL,
  entry_price DECIMAL,
  exit_price DECIMAL,
  stop_loss DECIMAL,
  take_profit DECIMAL,
  pnl DECIMAL DEFAULT 0,
  pnl_percent DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'stopped', 'liquidated')),
  order_id TEXT,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_trades_company_status ON trading_history(company_id, status);

-- ============================================================
-- AGENT_ACTIONS: activity timeline
-- ============================================================
CREATE TABLE agent_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  round INTEGER NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  agent_role TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  result JSONB,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped')),
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_actions_company_round ON agent_actions(company_id, round DESC);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('gumroad', 'buymeacoffee', 'other')),
  price_usd DECIMAL NOT NULL,
  product_url TEXT,
  total_sold INTEGER DEFAULT 0,
  total_revenue DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROUND_LOGS
-- ============================================================
CREATE TABLE round_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  round_number INTEGER NOT NULL,
  agent_summaries JSONB DEFAULT '{}',
  ai_summary TEXT,
  treasury_snapshot DECIMAL,
  trading_snapshot DECIMAL,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, round_number)
);

CREATE INDEX idx_rounds_company ON round_logs(company_id, round_number DESC);

-- ============================================================
-- AGENT_PROMPT_TEMPLATES: reusable role templates
-- ============================================================
CREATE TABLE agent_prompt_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  default_tools TEXT[] DEFAULT '{}',
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_prompt_templates ENABLE ROW LEVEL SECURITY;

-- Helper: check if user owns company
CREATE OR REPLACE FUNCTION is_company_owner(cid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM companies WHERE id = cid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Companies: user sees own
CREATE POLICY "users_own_companies" ON companies
  FOR ALL USING (user_id = auth.uid());

-- Child tables: user sees via company ownership
CREATE POLICY "users_own_agents" ON agents
  FOR ALL USING (is_company_owner(company_id));

CREATE POLICY "users_own_agent_tools" ON agent_tools
  FOR ALL USING (
    EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_tools.agent_id AND is_company_owner(a.company_id))
  );

CREATE POLICY "users_own_messages" ON messages
  FOR ALL USING (is_company_owner(company_id));

CREATE POLICY "users_own_tasks" ON tasks
  FOR ALL USING (is_company_owner(company_id));

CREATE POLICY "users_own_decisions" ON decisions
  FOR ALL USING (is_company_owner(company_id));

CREATE POLICY "users_own_snapshots" ON company_snapshots
  FOR ALL USING (is_company_owner(company_id));

CREATE POLICY "users_own_trades" ON trading_history
  FOR ALL USING (is_company_owner(company_id));

CREATE POLICY "users_own_actions" ON agent_actions
  FOR ALL USING (is_company_owner(company_id));

CREATE POLICY "users_own_products" ON products
  FOR ALL USING (is_company_owner(company_id));

CREATE POLICY "users_own_rounds" ON round_logs
  FOR ALL USING (is_company_owner(company_id));

-- Global catalogs: anyone can read
CREATE POLICY "tools_public_read" ON tools
  FOR SELECT USING (true);

CREATE POLICY "templates_public_read" ON agent_prompt_templates
  FOR SELECT USING (true);

-- ============================================================
-- REALTIME: enable for dashboard subscriptions
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE company_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE trading_history;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE agents;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
