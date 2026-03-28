-- Silico v2.2: Agent Journals + Shared Board
-- Long-term memory for agents

-- ============================================================
-- AGENT_JOURNALS: per-agent work diary (long-term memory)
-- ============================================================
CREATE TABLE agent_journals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  agent_role TEXT NOT NULL,
  round INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_journals_agent ON agent_journals(agent_id, round DESC);
CREATE INDEX idx_journals_company ON agent_journals(company_id, round DESC);

ALTER TABLE agent_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_journals" ON agent_journals
  FOR ALL USING (is_company_owner(company_id));

-- ============================================================
-- SHARED_BOARD: company-wide knowledge base
-- ============================================================
CREATE TABLE shared_board (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  author_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL,
  round INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general'
    CHECK (category IN ('general', 'research', 'strategy', 'technical', 'trading', 'report')),
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_board_company ON shared_board(company_id, created_at DESC);

ALTER TABLE shared_board ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_board" ON shared_board
  FOR ALL USING (is_company_owner(company_id));

-- Enable realtime for dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE agent_journals;
ALTER PUBLICATION supabase_realtime ADD TABLE shared_board;
