# Silico Dashboard — 설계 사양서 + Claude Code 지시서

> 이 문서는 Silico 대시보드 프론트엔드의 설계와 구현 지시를 담고 있습니다.
> 백엔드(오케스트레이터)와 함께 동작하며, Supabase Realtime을 통해 실시간 업데이트됩니다.

---

## 1. 아키텍처 변경사항

### 1.1 데이터 흐름 변경 (Before → After)

```
BEFORE (백엔드 전용):
  Agent → Notion에 저장 → 끝

AFTER (대시보드 지원):
  Agent → Action Executor
            ├── Notion에 저장 (에이전트 소통용, 기록 보관)
            └── Supabase에 동시 저장 (실시간 대시보드용)
                    ↓
              Supabase Realtime
                    ↓
              Next.js Dashboard (자동 업데이트)
```

### 1.2 Notion vs Supabase 역할 분리

| 데이터 | Notion | Supabase | 이유 |
|---|---|---|---|
| 에이전트 간 메시지 | ✅ 원본 | ✅ 미러링 | 에이전트는 Notion 읽고, 대시보드는 Supabase 읽음 |
| 태스크 | ✅ 원본 | ✅ 미러링 | 동일 |
| 회사 상태 | ✅ 원본 | ✅ 스냅샷 | Supabase에는 매 라운드 스냅샷 누적 |
| 의사결정 로그 | ✅ 원본 | ✅ 미러링 | 동일 |
| 트레이딩 히스토리 | ❌ | ✅ 원본 | 시계열 데이터는 Supabase가 적합 |
| 포트폴리오 스냅샷 | ❌ | ✅ 원본 | 분 단위 스냅샷 저장 |
| 에이전트 행동 로그 | ❌ | ✅ 원본 | 타임라인 피드용 |
| 파일/에셋 | ❌ | ✅ Storage | 이미지, 생성물 저장 |

핵심: Notion은 에이전트의 "근무 환경", Supabase는 "관제 시스템"

---

## 2. Supabase DB Schema

### 2.1 companies 테이블
```sql
CREATE TABLE companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,  -- 소유자
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🔥',
  mission TEXT,
  strategy TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  seed_money DECIMAL DEFAULT 100,
  current_round INTEGER DEFAULT 0,
  notion_page_id TEXT,
  github_repo_url TEXT,
  storage_bucket TEXT,
  -- Notion DB IDs (for orchestrator routing)
  notion_messages_ds TEXT,
  notion_tasks_ds TEXT,
  notion_state_ds TEXT,
  notion_decisions_ds TEXT,
  notion_round_log_ds TEXT,
  -- Bybit (사용자별 API 키, 암호화 저장)
  exchange_api_key_encrypted TEXT,
  exchange_api_secret_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_user ON companies(user_id);
```

### 2.2 company_snapshots 테이블 (재무 카드용)
```sql
CREATE TABLE company_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  treasury_usd DECIMAL NOT NULL,
  trading_balance DECIMAL NOT NULL,
  open_positions JSONB DEFAULT '[]',
  active_products INTEGER DEFAULT 0,
  total_revenue DECIMAL DEFAULT 0,
  total_pnl DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_company_round ON company_snapshots(company_id, round);
```

### 2.3 messages 테이블 (에이전트 채팅 모니터용)
```sql
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  from_agent TEXT NOT NULL CHECK (from_agent IN ('CEO', 'Developer')),
  to_agent TEXT NOT NULL CHECK (to_agent IN ('CEO', 'Developer', 'All')),
  message_type TEXT NOT NULL CHECK (message_type IN ('directive', 'report', 'question', 'fyi')),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'acted')),
  notion_page_id TEXT, -- 대응하는 Notion 메시지 ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_company_round ON messages(company_id, round DESC);
```

### 2.4 trading_history 테이블 (포지션 현황용)
```sql
CREATE TABLE trading_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
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
  order_id TEXT, -- 거래소 주문 ID
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_trades_company_status ON trading_history(company_id, status);
```

### 2.5 agent_actions 테이블 (타임라인 피드용)
```sql
CREATE TABLE agent_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  agent TEXT NOT NULL CHECK (agent IN ('CEO', 'Developer', 'System')),
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  result JSONB, -- 실행 결과 (URL, 금액, 에러 등)
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_actions_company_round ON agent_actions(company_id, round DESC);
```

### 2.6 products 테이블 (상품 판매 현황용)
```sql
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('gumroad', 'buymeacoffee', 'other')),
  price_usd DECIMAL NOT NULL,
  product_url TEXT,
  total_sold INTEGER DEFAULT 0,
  total_revenue DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.7 round_logs 테이블 (라운드 히스토리용)
```sql
CREATE TABLE round_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  ceo_actions_summary TEXT,
  dev_actions_summary TEXT,
  ai_summary TEXT, -- AI가 생성한 라운드 요약문
  treasury_snapshot DECIMAL,
  trading_snapshot DECIMAL,
  duration_seconds INTEGER, -- 라운드 소요 시간
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rounds_company ON round_logs(company_id, round_number DESC);
```

### 2.8 Supabase Realtime 설정

대시보드에서 실시간 구독할 테이블:
```sql
-- Supabase 대시보드에서 Realtime 활성화 필요:
-- messages: INSERT (새 메시지 도착)
-- company_snapshots: INSERT (매 라운드 재무 업데이트)
-- agent_actions: INSERT (타임라인 이벤트)
-- trading_history: INSERT, UPDATE (포지션 열림/닫힘)
-- products: UPDATE (판매 수 변경)
```

### 2.9 RLS (Row Level Security) 정책

모든 테이블에 RLS를 걸어서 사용자는 자기 회사 데이터만 볼 수 있다.
핵심: companies 테이블의 user_id가 체인의 시작점.
나머지 테이블은 company_id → companies.user_id로 자동 격리.

```sql
-- ============================================================
-- Helper function: 현재 사용자가 해당 company의 소유자인지 확인
-- ============================================================
CREATE OR REPLACE FUNCTION is_company_owner(check_company_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM companies 
    WHERE id = check_company_id 
    AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- companies: 사용자는 자기 회사만 접근
-- ============================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own companies" ON companies
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service writes companies" ON companies
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- company_snapshots: company_id를 통한 간접 격리
-- ============================================================
ALTER TABLE company_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own snapshots" ON company_snapshots
  FOR SELECT TO authenticated
  USING (is_company_owner(company_id));

CREATE POLICY "Service writes snapshots" ON company_snapshots
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- messages: 에이전트 대화 모니터링
-- ============================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own messages" ON messages
  FOR SELECT TO authenticated
  USING (is_company_owner(company_id));

CREATE POLICY "Service writes messages" ON messages
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- trading_history: 트레이딩 기록
-- ============================================================
ALTER TABLE trading_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own trades" ON trading_history
  FOR SELECT TO authenticated
  USING (is_company_owner(company_id));

CREATE POLICY "Service writes trades" ON trading_history
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- agent_actions: 타임라인
-- ============================================================
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own actions" ON agent_actions
  FOR SELECT TO authenticated
  USING (is_company_owner(company_id));

CREATE POLICY "Service writes actions" ON agent_actions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- products: 상품
-- ============================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own products" ON products
  FOR SELECT TO authenticated
  USING (is_company_owner(company_id));

CREATE POLICY "Service writes products" ON products
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- round_logs: 라운드 기록
-- ============================================================
ALTER TABLE round_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own rounds" ON round_logs
  FOR SELECT TO authenticated
  USING (is_company_owner(company_id));

CREATE POLICY "Service writes rounds" ON round_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- Storage: 회사별 폴더 격리
-- ============================================================
-- Supabase Storage에서 버킷 1개 (silico-storage) 사용
-- 폴더 구조: {company_id}/assets/, {company_id}/images/ 등
-- Storage RLS:

CREATE POLICY "Users access own company files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'silico-storage' 
    AND is_company_owner((storage.foldername(name))[1]::UUID)
  );

CREATE POLICY "Service manages all files" ON storage.objects
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### 2.10 데이터 격리 요약

```
사용자 A (auth.uid = aaa)
├── Company X (user_id = aaa) → 모든 하위 데이터 접근 가능
│   ├── messages (company_id = X) ✅
│   ├── trading_history (company_id = X) ✅
│   └── storage/X/... ✅
│
└── Company Y (user_id = bbb) → 접근 불가
    ├── messages (company_id = Y) ❌ RLS 차단
    ├── trading_history (company_id = Y) ❌ RLS 차단
    └── storage/Y/... ❌ RLS 차단

오케스트레이터 (service_role key)
└── 모든 회사 데이터 읽기/쓰기 가능 ✅
```

### 2.11 사용자 플로우

```
1. 사용자 가입 → Supabase Auth (auth.users 테이블에 자동 등록)
2. 로그인 → JWT 토큰 발급 (auth.uid() 사용 가능)
3. "새 회사 시작" 클릭 → API 호출 → 오케스트레이터 (service_role)
4. 오케스트레이터가 companies INSERT (user_id = 요청자의 uid)
5. Round 0 실행 (Notion DB + GitHub + Storage 생성)
6. 이후 대시보드에서 자기 회사만 표시 (RLS 자동 필터)
```

---

## 3. 대시보드 설계

### 3.1 기술 스택
- **프레임워크**: Next.js 14 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **실시간**: Supabase Realtime (WebSocket 구독)
- **차트**: Recharts
- **인증**: Supabase Auth (초기: Magic Link / Google OAuth)
- **배포**: Vercel

### 3.2 페이지 구조
```
/                      → 랜딩 페이지 (프로젝트 소개)
/login                 → 로그인 (Supabase Auth: Magic Link / Google)
/dashboard             → 메인 대시보드 (자기 회사 목록)
/dashboard/[companyId] → 특정 회사 실시간 모니터링
/dashboard/new         → 새 회사 시작 (시드머니 설정 → Init 트리거)
```

### 3.3 대시보드 레이아웃 (단일 화면)

```
┌─────────────────────────────────────────────────────┐
│  🔥 NexaTech          active        Round 12 / Day 12│
├──────────┬──────────┬──────────┬──────────┬─────────┤
│ Treasury │ Trading  │ Products │ Total    │ PnL     │
│ $87.40   │ $62.30   │ 3 sold   │ Revenue  │ Chart   │
│ -$12.60  │ +$4.80   │ +$18.00  │ $22.80   │ 📈      │
├──────────┴──────────┼──────────┴──────────┴─────────┤
│                     │                               │
│  💬 Agent Chat      │  📊 Open Positions            │
│                     │                               │
│  CEO → Dev          │  BTCUSDT  5x Long   +$3.12   │
│  "BTC showing..."   │  ETHUSDT  3x Short  -$1.20   │
│                     │                               │
│  Dev → CEO          │  🛍️ Products                  │
│  "Executed..."      │  Weekly planner  2 sold / $12 │
│                     │  Tracker        1 sold / $6   │
│                     │                               │
├─────────────────────┴───────────────────────────────┤
│  📋 Activity Timeline                               │
│  14:32  CEO  analyzed BTC market via web search     │
│  14:33  CEO  sent directive to Developer            │
│  14:35  Dev  executed BTC long: $20 at 5x           │
│  14:36  Dev  deployed silico-nexatech.vercel.app    │
│  14:37  Dev  reported results to CEO                │
│  14:38  SYS  Round 12 complete. Treasury $87.40     │
└─────────────────────────────────────────────────────┘
```

### 3.4 컴포넌트 구조

```
src/
├── app/
│   ├── layout.tsx              # Root layout + Supabase provider
│   ├── page.tsx                # Landing page
│   ├── login/page.tsx          # Auth page (Magic Link / Google)
│   └── dashboard/
│       ├── layout.tsx          # Dashboard layout (sidebar + header)
│       ├── page.tsx            # 회사 목록 (자기 회사만, RLS)
│       ├── new/page.tsx        # 새 회사 시작 (시드머니 설정 → Init API)
│       └── [companyId]/
│           └── page.tsx        # 회사 실시간 모니터링 (메인 뷰)
│
├── components/
│   ├── dashboard/
│   │   ├── MetricCards.tsx     # Treasury, Trading, Products, Revenue
│   │   ├── PnlChart.tsx       # 라운드별 PnL 추이 차트
│   │   ├── AgentChat.tsx      # 에이전트 대화 모니터 (실시간)
│   │   ├── OpenPositions.tsx  # 현재 열린 포지션
│   │   ├── ProductsList.tsx   # 상품 판매 현황
│   │   ├── ActivityTimeline.tsx # 행동 타임라인 (실시간)
│   │   ├── RoundIndicator.tsx # 현재 라운드 표시 + 진행 상태
│   │   ├── CompanyHeader.tsx  # 회사 이름, 상태, 미션
│   │   └── CompanyList.tsx    # 사용자의 회사 목록 카드
│   │
│   ├── ui/                    # shadcn/ui 컴포넌트
│   └── providers/
│       └── SupabaseProvider.tsx # Supabase client + auth context
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser Supabase client
│   │   ├── server.ts          # Server Supabase client
│   │   ├── middleware.ts      # Auth middleware (보호 경로)
│   │   └── types.ts           # Auto-generated DB types
│   │
│   ├── hooks/
│   │   ├── useCompany.ts      # 회사 데이터 fetch
│   │   ├── useCompanies.ts    # 사용자의 회사 목록 fetch
│   │   ├── useMessages.ts     # 메시지 실시간 구독
│   │   ├── usePositions.ts    # 포지션 실시간 구독
│   │   ├── useTimeline.ts     # 타임라인 실시간 구독
│   │   └── useSnapshots.ts    # 재무 스냅샷 + 차트 데이터
│   │
│   └── api/
│       └── init-company.ts    # 새 회사 생성 API (→ 오케스트레이터 호출)
│
└── types/
    └── database.ts            # Supabase 타입 정의
```

### 3.5 실시간 구독 훅 예시

```typescript
// lib/hooks/useMessages.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useMessages(companyId: string) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    // 초기 로드: 최근 50개
    supabase
      .from('messages')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setMessages(data || []));

    // 실시간 구독
    const channel = supabase
      .channel(`messages:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          setMessages(prev => [payload.new as Message, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId]);

  return messages;
}
```

---

## 4. 백엔드 변경사항 (오케스트레이터)

### 4.1 Action Executor에 Supabase 쓰기 추가

모든 action 실행 후, 결과를 Supabase에도 기록:

```typescript
// src/orchestrator/action-executor.ts 변경

async function executeAction(action, agentRole, config, state) {
  // 1. 기존: Notion에 쓰기
  const result = await executeNotionAction(action, config);
  
  // 2. 추가: Supabase에 미러링
  await mirrorToSupabase(action, agentRole, config, result);
  
  // 3. 추가: 타임라인 이벤트 기록
  await logAgentAction(config.companyId, state.currentRound, agentRole, action, result);
  
  return result;
}

async function mirrorToSupabase(action, agentRole, config, result) {
  switch (action.type) {
    case 'send_message':
      await supabase.from('messages').insert({
        company_id: config.supabaseCompanyId,
        round: action.round,
        from_agent: agentRole,
        to_agent: action.to,
        message_type: action.message_type,
        content: action.content,
        status: 'unread'
      });
      break;
      
    case 'trading_decision':
    case 'execute_trade':
      await supabase.from('trading_history').insert({
        company_id: config.supabaseCompanyId,
        round: action.round,
        symbol: action.symbol,
        side: action.side,
        amount_usd: action.amount_usd,
        leverage: action.leverage,
        stop_loss: action.stop_loss,
        take_profit: action.take_profit,
        status: 'open'
      });
      break;
      
    // ... 기타 action 타입
  }
}

async function logAgentAction(companyId, round, agent, action, result) {
  await supabase.from('agent_actions').insert({
    company_id: companyId,
    round: round,
    agent: agent,
    action_type: action.type,
    description: generateActionDescription(agent, action),
    result: result,
    status: result.success ? 'success' : 'failed'
  });
}
```

### 4.2 Round Manager에 스냅샷 추가

```typescript
// 매 라운드 끝에 스냅샷 저장
async function endRound(config, state) {
  // 기존: Notion Round Log 기록
  await writeRoundLog(config, state);
  
  // 추가: Supabase 스냅샷
  await supabase.from('company_snapshots').insert({
    company_id: config.supabaseCompanyId,
    round: state.currentRound,
    treasury_usd: state.treasury,
    trading_balance: state.tradingBalance,
    open_positions: state.openPositions,
    active_products: state.activeProducts,
    total_revenue: state.totalRevenue,
    total_pnl: state.totalPnL
  });
  
  // 추가: Supabase 라운드 로그
  await supabase.from('round_logs').insert({
    company_id: config.supabaseCompanyId,
    round_number: state.currentRound,
    ceo_actions_summary: state.ceoSummary,
    dev_actions_summary: state.devSummary,
    ai_summary: state.roundSummary,
    treasury_snapshot: state.treasury,
    trading_snapshot: state.tradingBalance
  });
}
```

### 4.3 Initializer에 Supabase 등록 추가

```typescript
// initializeCompany() 에 추가
async function initializeCompany(seedMoney) {
  // ... 기존 Step 1~9 ...
  
  // 추가: Supabase에 회사 등록 (user_id 포함!)
  const { data: company } = await supabase.from('companies').insert({
    user_id: userId,  // ← 요청한 사용자의 auth.uid()
    name: companyName,
    emoji: emoji,
    mission: mission,
    strategy: strategy,
    seed_money: seedMoney,
    notion_page_id: pageId,
    github_repo_url: repoUrl,
    storage_bucket: bucketName,
    notion_messages_ds: dbIds.messages,
    notion_tasks_ds: dbIds.tasks,
    notion_state_ds: dbIds.state,
    notion_decisions_ds: dbIds.decisions,
    notion_round_log_ds: dbIds.roundLog
  }).select().single();
  
  // 추가: 초기 스냅샷
  await supabase.from('company_snapshots').insert({
    company_id: company.id,
    round: 0,
    treasury_usd: seedMoney,
    trading_balance: seedMoney,
    total_revenue: 0,
    total_pnl: 0
  });
  
  return { ...config, supabaseCompanyId: company.id };
}
```

---

## 5. Claude Code 대시보드 구현 지시서

### Step D1: 프로젝트 초기화

```
silico-dashboard라는 Next.js 14 프로젝트를 만들어줘.

기술 스택:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui (init 해줘)
- @supabase/supabase-js
- @supabase/ssr (for server components)
- recharts (차트)

파일 구조는 이 문서의 Section 3.4를 따라줘.

.env.local.example:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Step D2: Supabase 마이그레이션

```
Supabase CLI를 사용해서 이 문서의 Section 2 전체 스키마를 마이그레이션으로 만들어줘.

supabase/migrations/001_initial_schema.sql 파일에:
- 모든 테이블 생성 (companies, company_snapshots, messages, trading_history, agent_actions, products, round_logs)
- 모든 인덱스 생성
- RLS 정책 설정
- Realtime 활성화 (messages, company_snapshots, agent_actions, trading_history)

그리고 supabase/seed.sql에 테스트용 더미 데이터를 넣어줘:
- 회사 1개 (NexaTech)
- 라운드 12개 스냅샷
- 메시지 20개
- 트레이딩 히스토리 8개
- 에이전트 행동 30개
- 상품 3개
이 더미 데이터가 있어야 대시보드 개발 시 화면을 확인할 수 있어.
```

### Step D3: Supabase 클라이언트 + 타입

```
lib/supabase/ 폴더에 클라이언트를 만들어줘.

lib/supabase/client.ts: 브라우저용 (createBrowserClient)
lib/supabase/server.ts: 서버 컴포넌트용 (createServerClient)
types/database.ts: DB 스키마 기반 TypeScript 타입 (수동 정의, Supabase generate 없이)

SupabaseProvider를 만들어서 app/layout.tsx에 감싸줘.
```

### Step D4: 인증

```
Supabase Auth로 간단한 로그인을 만들어줘.

app/login/page.tsx:
- Magic Link (이메일) 로그인
- Google OAuth (선택)
- 로그인 후 /dashboard로 리다이렉트

미들웨어:
- /dashboard/* 경로는 인증 필요
- 미인증 시 /login으로 리다이렉트
```

### Step D5: 메인 대시보드 레이아웃

```
이 문서의 Section 3.3 레이아웃대로 대시보드를 만들어줘.

app/dashboard/layout.tsx:
- 좌측 사이드바: 회사 목록 (companies 테이블에서)
- 상단 헤더: 현재 회사 이름, 상태, 라운드

app/dashboard/[companyId]/page.tsx:
- 메트릭 카드 4개 (Treasury, Trading, Products, Revenue)
- 좌측: Agent Chat 모니터
- 우측 상단: Open Positions + Products
- 하단: Activity Timeline

모든 컴포넌트를 서버 컴포넌트로 초기 데이터 fetch하고,
클라이언트 컴포넌트에서 Realtime 구독으로 실시간 업데이트.
```

### Step D6: 실시간 컴포넌트

```
lib/hooks/ 폴더에 Supabase Realtime 훅을 만들어줘.
이 문서의 Section 3.5 예시를 참고해.

useMessages(companyId): 최근 메시지 + 새 메시지 실시간
usePositions(companyId): 열린 포지션 + 업데이트 실시간
useTimeline(companyId): 행동 로그 + 새 이벤트 실시간
useSnapshots(companyId): 재무 스냅샷 (차트 데이터)
useCompany(companyId): 회사 기본 정보

각 훅:
1. 초기 데이터 로드 (useEffect + Supabase query)
2. Realtime channel 구독 (INSERT/UPDATE 이벤트)
3. cleanup (channel unsubscribe)
```

### Step D7: PnL 차트

```
Recharts로 PnL 추이 차트를 만들어줘.

components/dashboard/PnlChart.tsx:
- X축: 라운드 번호
- Y축: Treasury + Trading Balance 라인
- company_snapshots에서 데이터 fetch
- 호버 시 해당 라운드의 상세 정보 툴팁
- 색상: Treasury = 파란색 (#378ADD), Trading = 초록색 (#1D9E75)
```

### Step D8: Vercel 배포

```
Vercel에 배포해줘.
- 프로젝트 이름: silico-dashboard
- 환경변수 설정 가이드 README에 포함
- 빌드 성공 확인
```

---

## 6. 레포 구조 최종

```
GitHub 레포 3종류:
├── silico/              ← 오케스트레이터 + 에이전트 (백엔드)
├── silico-dashboard/    ← Next.js 대시보드 (프론트엔드)
└── silico-{company}/    ← AI가 만드는 회사별 레포 (자동생성)
```

---

## 7. 환경변수 총정리

### silico (백엔드) .env
```env
ANTHROPIC_API_KEY=sk-ant-...
SILICO_PAGE_ID=32a08ff1-6241-8016-bfdd-dd0bddb501c8
COMPANY_REGISTRY_DS_ID=a81e01f7-f919-4dfb-b87e-7fbf818b743a
EXCHANGE_API_KEY=xxx
EXCHANGE_API_SECRET=xxx
EXCHANGE_BASE_URL=https://api-testnet.bybit.com
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # service_role key (서버 전용)
GITHUB_TOKEN=ghp_xxx
ROUND_INTERVAL_MINUTES=60
MAX_ROUNDS_PER_DAY=24
AGENT_MODEL=claude-sonnet-4-20250514
```

### silico-dashboard (프론트엔드) .env.local
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # anon key (브라우저 전용)
```